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
| `bun run test:db` | levanta un PostgreSQL desechable, aplica todas las migraciones, ejecuta `tests/db/core.test.sql` y la prueba de concurrencia |
| `bun run build` | build de producción |

`test:db` no usa credenciales ni toca ninguna base real. `initdb` no puede ejecutarse como root.

## Accesos
La app es privada: no hay registro público. Un administrador crea las cuentas
desde Ajustes → Usuarios y roles. No se puede quitar al último administrador.

## CI
`.github/workflows/ci.yml` define typecheck, pruebas, build y pruebas de base de
datos. El repositorio debe conectarse a GitHub para que se ejecute.
