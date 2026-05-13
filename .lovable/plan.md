## Plan

1. **Crear una fuente única de verdad para configuración**
   - Mover ajustes de organización, humedad, alertas, trazabilidad pública, fincas, parcelas, unidades y rol activo a stores compartidos con suscripción.
   - Persistirlos localmente para que sobrevivan recargas, pero notificar a toda la UI en el mismo momento del guardado.

2. **Hacer que /settings realmente actualice datos**
   - Reemplazar los botones que hoy solo muestran toast por acciones reales de actualización.
   - Conectar Organización, Fincas, Parcelas, Unidades, Humedad, Alertas, Trazabilidad pública y Rol activo al store compartido.
   - Mantener confirmaciones visuales solo después de que el estado se haya actualizado.

3. **Conectar el resto de pantallas a esos cambios**
   - Sustituir lecturas directas de `mockDb.farms`, `mockDb.parcels` y `mockDb.units` en cosecha, recibos, lotes, reportes, trazabilidad, ficha pública y formularios por hooks del store compartido.
   - Usar los rangos de humedad y reglas de alertas guardadas donde se calculan estados/alertas.
   - Asegurar que el cambio de rol fuerce actualización inmediata de permisos, menús y botones protegidos.

4. **Evitar regresiones de rendimiento**
   - Mantener selectores estables para que solo se re-rendericen las partes afectadas.
   - No volver al patrón que causaba el loop de renderizado.
   - Separar catálogos/configuración del store grande de operaciones para limitar renders.

5. **Verificación**
   - Probar en la preview: cambiar rol, organización, unidades, finca/parcela y reglas; navegar a pantallas consumidoras y confirmar que se actualizan sin recargar.
   - Revisar logs del dev server si la preview no refleja los cambios.
   - Validar que no aparezcan errores de consola relacionados con el store o suscripciones.

## Detalles técnicos

- Añadir un módulo tipo `app-config-store` basado en `useSyncExternalStoreWithSelector`, con acciones explícitas como `updateOrganization`, `updateFarm`, `updateParcel`, `updateUnit`, `updateSettings`.
- Inicializar el store desde `mockDb` + valores persistidos en `localStorage`.
- Exponer hooks específicos: `useOrganization`, `useFarms`, `useParcels`, `useUnits`, `useAppSettings`.
- Refactorizar solo las pantallas que actualmente consumen esos datos desde `mockDb` para que apunten al nuevo store.