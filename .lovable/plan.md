## Problema detectado

En `/settings` el comportamiento actual es confuso y por eso parece que "no guarda ni borra":

1. **Los botones "Guardar" no hacen nada real** — solo muestran un `toast`. El guardado real ocurre silenciosamente en cada tecla, así que el usuario presiona "Guardar" esperando confirmación de cambios y no percibe ningún efecto.
2. **No existen acciones para borrar** fincas, parcelas ni unidades. Tampoco hay botón para añadir nuevas.
3. **No hay forma de descartar / restablecer** los valores actuales (volver a los valores originales).
4. **No hay indicador visual** de "cambios sin guardar" vs "guardado", lo que refuerza la sensación de que no pasa nada.

Esto pasa en todas las secciones que escriben en el store de configuración: Organización, Fincas, Parcelas, Unidades, Humedad, Alertas y Trazabilidad pública.

## Solución propuesta

### 1. Cambiar el modelo a "borrador + Guardar / Descartar"

Cada sección tendrá su propio borrador local (estado React) inicializado desde el store:

- Las ediciones modifican el borrador, no el store global.
- Aparece una barra inferior con `Guardar cambios` y `Descartar` cuando hay diferencias.
- `Guardar` aplica el borrador al store (que persiste en `localStorage` y notifica al resto de la app).
- `Descartar` vuelve al último estado guardado.

Esto resuelve la percepción de "no guarda" y mantiene la propagación en vivo al resto del sistema (que ya funciona vía `useSyncExternalStoreWithSelector`).

### 2. Añadir acciones de borrado y creación

En el store `src/lib/app-config-store.ts` añadir:

- `addFarm`, `removeFarm(id)`
- `addParcel`, `removeParcel(id)`
- `addUnit`, `removeUnit(id)` (solo cuando `is_configurable`)
- `resetSettings()` para restablecer humedad, alertas y trazabilidad pública a valores por defecto.
- `resetAll()` que limpia `localStorage` y vuelve a `mockDb` + `DEFAULT_SETTINGS`.

Reglas de seguridad:
- No permitir borrar una finca si tiene parcelas o lotes asociados (mostrar motivo).
- No permitir borrar una parcela si tiene lotes/recibos asociados.
- No permitir borrar unidades del sistema (`is_configurable === false`).
- Confirmar borrado con `ConfirmAction` (ya existe en `src/components/confirm-action.tsx`).

### 3. UI de cada sección

- **Fincas / Parcelas / Unidades**: añadir botón `+ Añadir` arriba y un botón de papelera por fila (deshabilitado con tooltip si no se puede borrar). Reemplazar el "Guardar" por fila por la barra global de la sección.
- **Organización / Humedad / Alertas / Trazabilidad pública**: barra inferior con `Guardar` y `Descartar`, más botón `Restablecer valores por defecto`.
- **Usuarios y roles** y **Sincronización**: no cambian (el rol activo ya se aplica al instante; sincronización ya tiene sus propias acciones).

### 4. Verificación

- Cambiar nombre de una finca → pulsar `Descartar` → vuelve al valor anterior.
- Cambiar nombre de una finca → pulsar `Guardar` → recargar página → cambio persiste y aparece en `/lots`, `/intake`, `/harvest`.
- Borrar una parcela vacía → desaparece de `/settings` y de los selectores en `/harvest/new`.
- Intentar borrar una finca con lotes → se bloquea con mensaje claro.
- `Restablecer valores por defecto` en Humedad → vuelve a 9–12.5 % y los estados de humedad en `/lots` se recalculan.

## Detalles técnicos

- Hook auxiliar `useDraft<T>(source, equals)` en cada sección o utilidad compartida en `src/lib/use-draft.ts` para manejar borrador + dirty flag.
- `removeFarm` / `removeParcel`: comprobar referencias contra `useStore.getState().lots` y `harvestTickets` antes de borrar.
- `addFarm` genera id `farm-${crypto.randomUUID()}` con valores mínimos editables.
- `resetAll` borra la clave `bcp.app-config.v1` de `localStorage` y reemplaza `state` con los valores iniciales, luego `emit()`.
- Mantener selectores actuales y `shallowEqual` para no regresar al loop de renders previo.
