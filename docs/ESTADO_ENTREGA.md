# Estado de entrega — fase base (backend compartido)

Fecha: 2026-10-09. Este documento describe lo implementado y verificado en esta
entrega, y lo que queda pendiente. No se publicó la app, no se borraron datos
existentes, no se importó el dataset demo, no se crearon cuentas ni se enviaron correos.

## 1. Implementado

### Base de datos (Lovable Cloud)
- **Organizaciones y membresías** (`organizations`, `memberships`): una organización
  inicial "Microbeneficio"; el administrador existente quedó como miembro `administrador`
  (backfill desde `user_roles`). Preparado para varias organizaciones (aislamiento por `organization_id`).
- **Tablas operativas**: `org_settings`, `farms`, `parcels`, `units`, `process_templates`,
  `variable_definitions`, `customers`, `harvest_tickets`, `lots`, `lot_links`, `lot_sequences`,
  `process_phases`, `variable_logs`, `moisture_logs`, `waste_logs`, `reservations`,
  `stock_movements`, `quality_samples`, `lot_public_profiles`, `audit_log`.
- **RLS por organización** en todas las tablas: lectura para miembros activos; escritura
  directa solo en catálogos y por rol; inventario, reservas, mermas, calidad y movimientos
  **solo** mediante funciones del servidor.
- **Rol obtenido del servidor**: `my_membership()`; el cliente ya no guarda ni lee el rol en localStorage.
- **Funciones transaccionales** (bloqueo `FOR UPDATE` por lote, orden fijo lote→reserva):
  `create_lot` (código único generado en servidor), `create_reservation`, `confirm_reservation`
  (reservado→comprometido), `cancel_reservation`, `expire_reservations`, `deliver_reservation`,
  `log_waste`, `log_moisture`, `adjust_inventory` (ajuste negativo permitido con motivo y sin tocar
  café reservado/comprometido), `record_quality` (bloqueo/aprobación recalcula `qty_blocked_kg`),
  `split_lot`, `merge_lots` (validan NaN, negativos, duplicados; conservan kg y genealogía).
- **Restricciones**: cantidades finitas y no negativas (`<> 'NaN'`), `reservado+comprometido+bloqueado ≤ actual`,
  disponibilidad como columna generada.
- **Auditoría append-only**: trigger impide UPDATE/DELETE; `actor_id = auth.uid()`, `created_at = now()` del servidor.
- **Administradores**: se eliminó el arranque público `createFirstAdmin`; `set_member_role`
  serializa los cambios por organización e impide quitar al último administrador.
  Los usuarios nuevos entran como `consulta`; solo un administrador crea cuentas (con membresía).

### Aplicación
- **Clientes**: lectura/creación/edición/borrado contra la nube, con confirmación del servidor,
  estados de carga/error y Realtime entre dispositivos.
- **Fincas y parcelas** (Ajustes): se cargan de la nube y "Guardar cambios" escribe en la nube.
- **Usuarios y roles**: listado desde membresías; cambio de rol vía `set_member_role`.
- **Caché local por usuario**: los módulos aún locales se guardan bajo `bcp.ops-data.v2:<usuario>`;
  al cerrar sesión se vacía la memoria y se cancela Realtime. El dato antiguo `bcp.ops-data.v1`
  se conserva intacto como respaldo y **no** se sube.
- **Demo explícito**: la app arranca vacía; "Datos demo" en Ajustes carga el ejemplo solo en ese dispositivo.
- Reportes, trazabilidad, detalle de lote, inventario, mermas, dashboard y ficha pública ya no leen
  datos operativos de `mockDb`; leen el almacén de la sesión. Siguen usando el catálogo por defecto de
  plantillas de proceso (`processTemplates/processInstances/processTemplatePhases`).

## 2. Pruebas ejecutadas realmente (sandbox, 2026-10-09)
| Comando | Resultado |
|---|---|
| `bun run typecheck` (tsc) | sin errores |
| `bun run test` (Vitest) | 3 archivos, 4 pruebas OK (CSV, sobreventa local, aislamiento/logout, demo explícito) |
| `bash tests/db/run-local.sh` | migraciones 0000–0002 aplicadas en PostgreSQL 17 desechable; 27 aserciones OK + concurrencia OK |

Aserciones de `tests/db/core.test.sql`: códigos de lote únicos; NaN/negativos rechazados;
sobreventa rechazada; confirmar mueve a comprometido una vez; cancelar libera una vez; entregar
reduce físico y registra una venta una vez (y no se puede cancelar después); vencimiento libera una vez;
merma no consume reservado; ajuste negativo con motivo; bloqueo/aprobación de calidad; división/mezcla
conservan kg y genealogía y rechazan duplicados; `consulta` no escribe (función, RLS e UPDATE directo);
otra organización no ve ni opera datos ajenos; no se puede degradar al último admin; auditoría con actor y append-only.

Concurrencia (`tests/db/concurrency.sh`): 10 sesiones paralelas reservando 15 kg de un lote de 100 kg →
`successful=6 rejected_oversell=4 reserved_free=90 10`.

Limitación: el usuario de base del sandbox no puede asumir el rol `authenticated`, por eso las
pruebas de RLS se ejecutan sobre una base local con roles equivalentes (`tests/db/bootstrap.sql`),
no sobre la base del proyecto.

## 3. Pendiente (siguiente entrega)
Las tablas y funciones ya existen y están probadas; falta conectar estas pantallas, que hoy
siguen guardando en la caché local por usuario:
- Cosechas y recibos → `harvest_tickets` + `create_lot`.
- Lotes, detalle, división/mezcla, ajustes → `lots`, `split_lot`, `merge_lots`, `adjust_inventory`.
- Control de proceso y fases → `process_phases`; variables → `variable_logs`; humedad → `log_moisture`.
- Mermas → `log_waste`; calidad → `record_quality`.
- Reservas e inventario → funciones de reserva (bloqueado hasta que los lotes estén en la nube).
- Movimientos, alertas, auditoría (pantalla) → leer `stock_movements` / `audit_log`.
- Organización, unidades, rangos y reglas (Ajustes) → `organizations`, `units`, `org_settings`.
- Plantillas de proceso y variables personalizadas → `process_templates`, `variable_definitions`.
- Ficha pública por QR desde la nube (`lot_public_profiles`, lectura anónima acotada).
- Programar `expire_reservations` (hoy se invoca bajo demanda).
- Fotos, PDF, modo sin conexión real y copiloto: fuera de esta entrega.
- CI: el archivo existe; no se ha comprobado en GitHub (no consta repositorio conectado).
