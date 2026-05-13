## Diagnóstico de rendimiento

Hice una revisión del código y encontré una causa raíz clara de la lentitud (y de un crash que también está afectando al render), además de varios costos secundarios.

### 1. Problema crítico: el store causa renders infinitos

`src/lib/store.ts` expone los datos con `useSyncExternalStore`:

```ts
export function useStore<T>(selector) {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),       // getSnapshot
    () => selector(state),       // getServerSnapshot
  );
}
```

`useSyncExternalStore` exige que `getSnapshot` devuelva **siempre la misma referencia** mientras el estado no cambie. Pero la app llama el store con selectores que crean arrays/objetos nuevos en cada llamada, por ejemplo:

```ts
useStore((s) => s.harvestTickets.filter((t) => t.kind === "harvest"))
useStore((s) => s.lots.find((l) => l.id === id))
useStore((s) => s.phases.filter((p) => p.process_instance_id === lot.process_instance_id))
useStore((s) => (s).qualitySamples ?? [])
```

Cada render produce un array distinto → React cree que el store cambió → vuelve a renderizar → vuelve a crear un array nuevo → bucle. Esto:

- Dispara el error que ya estás viendo en consola: `Maximum update depth exceeded` dentro de un `<button>` (Radix Sheet/Slot, que se rompe cuando el padre se re-renderiza sin parar).
- En las pantallas que no llegan a romperse, igual quema CPU constante haciendo renders inútiles → sensación de "todo carga lento".

Hay **~50 selectores así** repartidos en casi todas las rutas (`lots`, `lots/$id`, `inventory`, `traceability`, `process-control`, `variables.log`, `waste`, `customers`, `reservations`, etc.).

### 2. Problemas secundarios de carga

- **`_app.dashboard.tsx` (520 líneas, 20 KB) y `_app.reports.tsx` (51 KB)** importan `recharts` directamente. Recharts es uno de los chunks más pesados del bundle. Con render infinito + chart se siente especialmente lento al entrar al inicio.
- **`_app.lots.$id.tsx` (1182 líneas, 43 KB)** y **`_app.processes.custom-builder.tsx` (32 KB)** son rutas grandes; TanStack ya las code-splittea por defecto, pero solo si los componentes **no** están exportados. Hay que confirmar que ningún `function ...Page` esté exportado.
- **`src/lib/store.ts` (1418 líneas)** vive en el bundle principal y hoy se importa desde casi toda la app.

## Plan de arreglo (en este orden)

### Paso 1 — Arreglar `useStore` para que no cause renders infinitos

En `src/lib/store.ts`:

1. Memorizar el último snapshot por suscriptor con comparación estructural superficial sobre arrays/objetos. Implementación concreta:
   - Cambiar `useStore` para que mantenga un `useRef` con el último valor calculado.
   - Recalcular el selector solo cuando `version` (un contador incrementado en `emit()`) cambia, devolviendo siempre la misma referencia entre cambios reales.
   - O alternativa equivalente: aceptar un `isEqual` opcional y, por defecto, usar comparación referencial sobre el array de "slices" (el patrón estándar `useSyncExternalStoreWithSelector` de `use-sync-external-store/with-selector`, que ya viene con React).
2. Usar exactamente esa utilidad oficial:

```ts
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

let version = 0;
const emit = () => { version++; listeners.forEach((l) => l()); };

export function useStore<T>(selector: (s: State) => T, isEqual?: (a: T, b: T) => boolean): T {
  return useSyncExternalStoreWithSelector(
    subscribe,
    () => state,
    () => state,
    selector,
    isEqual ?? shallowEqual,
  );
}
```

Con esto, un selector como `s.lots.filter(...)` se vuelve a calcular en cada notificación, pero la salida se compara superficialmente y **solo dispara render si cambió de verdad**. Esto elimina el bucle infinito y baja el uso de CPU drásticamente.

3. No hace falta tocar las ~50 llamadas existentes: siguen funcionando igual, pero dejan de causar renders.

### Paso 2 — Validar que el crash desaparece

- Reabrir `/dashboard` y `/lots/lot-1` y confirmar que no aparece más `Maximum update depth exceeded` en consola.
- Verificar con `browser--performance_profile` que el "Scripting time" baja a niveles normales.

### Paso 3 — Aligerar la carga inicial

- En `_app.dashboard.tsx`: cargar `recharts` con `React.lazy` + `Suspense` solo cuando hay datos para el gráfico, para que el bundle inicial del inicio no incluya recharts.
- Revisar que `function DashboardPage`, `function LotDetailPage`, `function ReportsPage`, etc. **no estén exportadas** — si lo están, quitar el `export` para que el code-splitter de TanStack las separe del bundle principal.
- Revisar imports pesados en `__root.tsx` y `_app.tsx`.

### Paso 4 — Medición final

- Volver a correr `browser--performance_profile` en `/dashboard` y `/lots`.
- Reportar antes/después: tiempo de scripting, número de renders, tamaño de chunk inicial.

## Lo que NO voy a tocar

- No voy a reescribir el store ni migrar a Zustand/Redux: el arreglo del Paso 1 es de ~15 líneas y resuelve el síntoma.
- No voy a cambiar el diseño ni la estructura de rutas.
- No voy a tocar el menú colapsable ni el `Outlet` de lotes que ya quedaron.

## Resultado esperado

- Desaparece el error `Maximum update depth exceeded`.
- Cada cambio en el store dispara solo los renders que de verdad lo necesitan.
- La pantalla de inicio deja de cargar `recharts` en el bundle crítico.
- Sensación general de la app mucho más ágil al navegar entre pantallas.