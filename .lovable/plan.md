## Problema detectado

1. **`/lots/$id` queda en blanco** al hacer click en un lote. La causa es una violación de las Reglas de Hooks en `src/routes/_app.lots.$id.tsx`: el componente hace un `return` temprano cuando no encuentra el lote, y *después* de ese return llama `useStore(...)` (para la fase) y `useEffect(...)`. Cuando el store cambia (por ejemplo al evaluar alertas), React detecta distinta cantidad de hooks entre renders y rompe el árbol; el resultado es una pantalla vacía (o un error boundary silencioso).

2. **Botones "Ver lote" del Dashboard no navegan**: en `src/routes/_app.dashboard.tsx` los botones de las tarjetas "Ver lote" llaman `toast("Ver lote", …)` en lugar de navegar a `/lots/$id`.

El resto de las páginas (Inventario, Reservas, Calidad, Trazabilidad, Procesos, Mermas, etc.) sí usan `<Link to="/lots/$id">` correctamente, así que el detalle ya está enlazado en todos lados — solo hay que evitar que crashee y que los botones del dashboard sí naveguen.

## Cambios

### 1. `src/routes/_app.lots.$id.tsx`
- Mover **todos** los hooks (`useParams`, `useStore` para `lot`, `useStore` para `phase`, `useEffect`) arriba del `if (!lot)`. Calcular `farm`, `parcel`, `available` también después, pero los hooks deben ir antes de cualquier return condicional.
- Mantener el mismo contenido y tabs ya existentes (Resumen, Proceso, Variables, Inventario, Reservas, Calidad, Mermas, Historial, Trazabilidad, QR público) — la página ya muestra la información completa y el historial del lote, solo no se renderizaba por el crash.

### 2. `src/routes/_app.dashboard.tsx`
- Reemplazar los `onClick: () => toast("Ver lote", …)` de las tarjetas de tareas por navegación real con `useNavigate()` → `navigate({ to: "/lots/$id", params: { id: lot.id } })` para `lot1` y `lot3`.
- Aprovechar para que "Ver reserva" navegue a `/reservations` y "Mover fase" navegue al detalle del lote (tab proceso).

### 3. Verificación
- Confirmar que al hacer click en una tarjeta de `/lots`, en `Ver lote` del dashboard, en `/inventory`, en `/reservations`, etc., se llega correctamente a la ficha completa del lote con sus tabs (resumen, historial, trazabilidad).
- Build y revisión visual rápida del detalle.

## Alcance

Solo frontend, dos archivos editados. Sin cambios en lógica de negocio, store, ni tipos.