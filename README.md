# Bitácora Café Pro

Plataforma operativa para microbeneficios de café de especialidad: cosecha, lotes,
procesos, inventario, reservas, calidad, trazabilidad y auditoría.

Stack: TanStack Start (React 19, Vite 7), Tailwind v4, Lovable Cloud (PostgreSQL +
Auth + Realtime), despliegue edge (Cloudflare Workers).

## Requisitos
- Bun ≥ 1.1 (o Node 20 + npm)
- PostgreSQL 17 (`initdb`, `pg_ctl`, `psql`) solo para las pruebas de base de datos

## Instalación
```bash
bun install
cp .env.example .env   # completar con los valores del proyecto (sin secretos de servidor)
bun run dev            # http://localhost:8080
```

`SUPABASE_SERVICE_ROLE_KEY` es solo de servidor: se configura en el entorno de
despliegue y nunca se escribe en el repositorio.

## Base de datos
Las migraciones versionadas están en `drizzle/migrations/` y se aplican en orden:

| Migración | Contenido |
|---|---|
| `0000_migration.sql` | `profiles`, `user_roles`, `has_role`, trigger de alta |
| `0001_shared_operational_core.sql` | organizaciones, membresías, catálogos, lotes, reservas, movimientos, calidad, auditoría append-only, RLS y funciones transaccionales |
| `0002_fix_lot_links_policy.sql` | corrección de la política de lectura de genealogía |
| `0003_harden_function_privileges.sql` | revoca ejecución pública de funciones internas, fija `search_path` |
| `0004_closing_core_operations.sql` | liberación explícita para venta, entrega bloqueada por calidad, precio finito, referencias de la misma organización, idempotencia, cosecha transaccional, plantillas versionadas, fases/mediciones/alertas, archivos, QR público de lote y saco, enlaces de reporte, entorno demo |
| `0005_lot_files_type_restriction.sql` | solo JPG/PNG/WEBP/PDF en el almacenamiento |

Reglas clave (ver `docs/ESTADO_ENTREGA.md`):
- Toda tabla operativa tiene `organization_id` y RLS por membresía.
- Inventario y reservas solo se modifican mediante funciones `SECURITY DEFINER`
  con bloqueo por lote (`SELECT … FOR UPDATE`).
- Disponible = actual − reservado − comprometido − bloqueado − seguridad (columna generada).
- `audit_log` es de solo agregado (trigger), con actor `auth.uid()` y hora del servidor.

## Scripts
| Script | Qué hace |
|---|---|
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | pruebas unitarias (Vitest) |
| `bun run test:db` | levanta un PostgreSQL desechable, aplica todas las migraciones, ejecuta `tests/db/core.test.sql`, `closing.test.sql`, `audit.test.sql` y las pruebas de concurrencia (reservas y vencimiento) |
| `bun run build` | build de producción |

`test:db` no usa credenciales ni toca ninguna base real. `initdb` no puede ejecutarse como root (en un contenedor root: `setpriv --reuid=1000 --regid=1000 --clear-groups bash tests/db/run-local.sh`).

## Configuración del copiloto (OpenAI)
El copiloto (`/copiloto`) llama directamente a la API de OpenAI desde el servidor.
1. Crear una clave en la cuenta de OpenAI del autor.
2. Guardarla como secreto `OPENAI_API_KEY` en la configuración del proyecto (nunca en el código ni en `.env`).
3. Opcional: `OPENAI_MODEL` (por defecto `gpt-4.1-mini`).

Costo: cada pregunta consume tokens de la cuenta OpenAI (instrucciones + resultados de herramientas,
normalmente unos pocos miles de tokens por respuesta). Revise los precios vigentes en OpenAI. La latencia
no está garantizada; la app corta a los 45 s y muestra el motivo (clave inválida, límite, error temporal).

## Uso sin conexión
Solo **cosechas y mediciones** se guardan como borrador en el dispositivo (IndexedDB, por usuario y
organización) y se envían cuando vuelve la señal; cada envío tiene clave única, así que nunca se duplica.
Inventario, reservas y entregas requieren conexión para evitar vender dos veces el mismo café.
Alcance real: funciona con la app ya abierta; el service worker no guarda las páginas, así que abrir la app desde cero sin conexión no está soportado. Al cambiar de entorno o cerrar sesión, la cola anterior se detiene y sus respuestas tardías se descartan.

Migración `0012_quality_units_copilot_quota.sql`: calidad SCA/defectos validada, conversión de unidades solo del servidor, cuota del copiloto. Pruebas: `tests/db/quality_harvest.test.sql`.

## Accesos
La app es privada: no hay registro público. Un administrador crea las cuentas
desde Ajustes → Usuarios y roles. No se puede quitar al último administrador.

## CI
`.github/workflows/ci.yml` define typecheck, pruebas, build y pruebas de base de
datos. El repositorio debe conectarse a GitHub para que se ejecute.

## Estado actual (cierre)
Una sola aplicación: todos los módulos usan los registros guardados de la organización elegida, con actualización en vivo. Las pantallas antiguas con datos locales se conservan solo como referencia en `legacy/` (no se compilan). Detalle de pruebas y limitaciones en `docs/ESTADO_ENTREGA.md`. Pruebas de base de datos: `bash tests/db/run-local.sh` (como usuario sin privilegios de root).

### Migraciones 0010–0011 (mezclas y procedencia)
`0011_lineage_guards_apply.sql`: mezcla solo con el mismo estado físico, sin fases abiertas en mezcla/división, `lot_lineage` interna y procedencia heredada en la ficha pública. (`0010` está vacía.) Pruebas: `tests/db/lineage.test.sql`, incluida en `tests/db/run-local.sh`.
