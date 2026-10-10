# Bitácora Café Pro

Plataforma operativa para microbeneficios de café de especialidad: registra el recorrido del café desde la cosecha hasta su procesamiento, calidad, inventario, reserva y entrega. Su propósito académico es sustituir registros dispersos por información compartida y trazable, reducir errores de disponibilidad y facilitar la consulta autorizada del origen por QR.

## Referencia de cierre

- **Documento:** `DOC-CIERRE-2026-10-10`, actualizado con evidencias del autor al 10 de octubre de 2026, 01:52 UTC; fecha local del autor: 9 de octubre de 2026 en `America/Costa_Rica`.
- **Versión funcional evaluada:** `9c7576b0d72858c9d3d6f185b01e22f92bb4fb07`. Las evidencias se refieren a esa revisión, no a una futura rama de entrega.
- **Repositorio privado:** [herazofeifa/bit-cora-caf-pro](https://github.com/herazofeifa/bit-cora-caf-pro), conectado realmente a Lovable según la verificación independiente del autor.
- **CI verificado por el autor:** [run 38006323596](https://github.com/herazofeifa/bit-cora-caf-pro/actions/runs/38006323596), **Success**, trabajos `app` y `database`; 20/20 pruebas Vitest en 8 archivos.
- **App sin publicar.** La evaluación usa la [vista previa actual](https://id-preview--fbcc9b68-7ecc-4206-8f7d-fd25606bf21e.lovable.app). El subdominio lo configurará el autor al finalizar; este cierre no publica ni cambia DNS.

Estado y límites: [ESTADO_ENTREGA](docs/ESTADO_ENTREGA.md). Guía: [RECORRIDO_EVALUACION](docs/RECORRIDO_EVALUACION.md). Notas anteriores, no vigentes: [HISTORIAL_REVISION](docs/HISTORIAL_REVISION.md).

## Producto y arquitectura

Una sola aplicación usa los registros persistidos de la organización activa. Incluye Inicio, Cosecha, Recibos, Lotes y ficha de lote, Procesos y editor de plantillas, Variables/humedad, Calidad, Mermas, Inventario, Café libre, Clientes, Reservas, Reportes, Trazabilidad, Alertas, Auditoría, Ajustes y Copiloto. Las direcciones antiguas redirigen a su vista equivalente; `legacy/` conserva referencias fuera de la compilación, no una segunda operación local.

Stack: TanStack Start v1, React 19, Vite 7, Tailwind CSS v4 y Lovable Cloud (PostgreSQL, autenticación y actualización en tiempo real). El destino de ejecución es edge/Cloudflare Workers. Dependencias reproducibles en `bun.lock`; PDF con jsPDF 4.2.1 y AutoTable 5.0.8 según el lockfile de la revisión evaluada.

- Datos operativos separados por `organization_id`, políticas RLS y roles comprobados en el servidor.
- Lecturas por organización en `src/lib/org-data.ts`, operaciones en `src/lib/ops-cloud.ts` y acceso compartido en `src/lib/cloud.ts`.
- Inventario, reservas y transformaciones mediante funciones transaccionales con bloqueo del lote. Disponible = físico − reservado − comprometido − bloqueado − seguridad.
- Liberación explícita para venta; una aprobación de calidad no libera por sí sola café en proceso.
- Idempotencia ligada a actor, operación y argumentos; auditoría append-only con actor y hora del servidor.
- Mezclas solo con estado físico compatible; división y mezcla exigen cerrar fases abiertas. Genealogía e historia heredadas con controles de publicación.
- Consultas anónimas por token en `/t/:token`, `/s/:token` y `/r/:token`; no lecturas abiertas de tablas privadas.

## Requisitos y arranque local

Usar **Bun con soporte para `bun.lock`**; Bun 1.4.2 fue usado en la revisión independiente. Para compatibilidad con TanStack Start, Vite 7 y Vitest 5, usar **Node.js 22.12 o posterior dentro de la rama 22, o Node.js 24**. No se recomienda el antiguo requisito genérico «Node 20»: no cubre todo el conjunto actual de dependencias.

PostgreSQL **17**, con `initdb`, `pg_ctl` y `psql` en `PATH`, se necesita únicamente para la suite desechable de base de datos. Esa suite requiere un usuario no root.

```bash
bun install --frozen-lockfile
# Solo en una copia local nueva sin .env:
cp .env.example .env
# Completar la configuración pública/autorizada del entorno local antes de arrancar.
bun run dev -- --port 8080
```

Abrir `http://localhost:8080`. No sobrescribir el `.env` gestionado de Lovable. Una copia del código no incluye la base de datos, cuentas ni secretos del entorno alojado. El arranque local requiere configuración de conexión autorizada; instalar dependencias no provisiona el servicio. `.env.example` conserva nombres de configuración, no credenciales. La clave privilegiada gestionada de Lovable Cloud no está disponible para exportarla: no se pide al autor ni se sustituye por una clave ficticia. No versionar archivos con secretos.

## Comandos de comprobación

| Comando | Alcance |
|---|---|
| `bun run typecheck` | Revisión de tipos (`tsc --noEmit -p tsconfig.json`) |
| `bun run test` | Vitest, una ejecución |
| `bun run test:db` | PostgreSQL desechable, migraciones, suites SQL y concurrencia |
| `bun run build` | Compilación de producción, no publicación |
| `bun run preview` | Vista local de la compilación, no despliegue |

`tests/db/run-local.sh` crea y elimina su propia base temporal, sin credenciales ni cambios en la base real. Ejecuta `core`, `closing`, `audit`, `evaluation`, `unified`, `lineage` y `quality_harvest`, y luego `concurrency.sh`. No ejecutar `initdb` como root; en contenedores usar un usuario no privilegiado con acceso de lectura al proyecto. `PGPORT_TEST` permite cambiar el puerto temporal (por defecto 55432).

La CI ejecuta instalación congelada, tipos, Vitest y build en `app`, y migraciones/pruebas SQL/concurrencia con PostgreSQL 17 en `database`. Su éxito verificado no convierte los 59 casos independientes contra la base real en casos de CI ni en 59 sesiones JWT reales.

## Migraciones existentes

Los 14 archivos SQL de `drizzle/migrations/` se aplican en orden a una base destinada a ello, mediante el proceso autorizado de migración; no se recomienda reejecutarlos manualmente sobre la base en uso.

| Archivo | Contenido |
|---|---|
| `0000_migration.sql` | Perfiles, roles iniciales y disparador de alta |
| `0001_shared_operational_core.sql` | Organizaciones, membresías, catálogos, lotes, reservas, calidad, movimientos, auditoría, RLS y funciones transaccionales |
| `0002_fix_lot_links_policy.sql` | Lectura de enlaces de genealogía |
| `0003_harden_function_privileges.sql` | Privilegios de funciones internas y `search_path` |
| `0004_closing_core_operations.sql` | Liberación, cosecha, procesos/plantillas versionadas, mediciones, archivos, QR y reportes compartidos |
| `0005_lot_files_type_restriction.sql` | Restricción de archivos a JPG/PNG/WEBP/PDF |
| `0006_audit_fixes.sql` | Idempotencia ligada a argumentos/actor, exportación explícita, vencimientos y visibilidad de equipo |
| `0007_evaluation_spaces.sql` | Provisión idempotente de cuenta y dos espacios de evaluación aislados, ejemplo coherente |
| `0008_unified_product_closing.sql` | Entrega pactada/condiciones, ubicación, alertas y ampliación de realtime |
| `0009_alert_severity_fix.sql` | Alertas con severidades válidas (`info`, `warning`, `critical`) |
| `0010_lineage_guards.sql` | Paso histórico sin cambios efectivos; sustituido por 0011 |
| `0011_lineage_guards_apply.sql` | Compatibilidad física, bloqueo de transformaciones con fases abiertas e historia/procedencia heredadas |
| `0012_quality_units_copilot_quota.sql` | Validación SCA/defectos, conversiones de servidor y cuotas del copiloto |
| `0013_eval_settings_inherited_quality.sql` | Configuración base persistida de evaluación y calidad heredada autorizada |

## Acceso y evaluación

Aplicación privada, solo correo/contraseña; sin registro público ni Google. Cinco roles internos: **Administrador, Encargado de beneficio, Productor/finca, Comercial y Consulta**. Los permisos se comprueban por organización, no por un rol elegido en el navegador.

La cuenta **profesores@bitacoracafe.example ya fue creada por el autor** y se verificó con login real. Solo pertenece a «Bitácora Café Pro en blanco» y «Bitácora Café Pro con datos de ejemplo», aislados de la organización original y entre sí. «Cambiar entorno» conserva los registros de cada espacio. El evaluador no gestiona cuentas ni membresías.

El autor verificó con la sesión real del profesor en Chrome a **393 × 844 px** el selector completo con ambas opciones, el cambio a blanco con tablero de **0 registros** y el regreso a demo con registros conservados. La ficha pública a 393 px no presentó desbordamiento. Son recorridos de navegador de ancho móvil, no pruebas en dispositivos físicos.

Para provisionar en una instalación nueva: administrador de la organización original → Ajustes → Usuarios y roles → **Cuenta para profesores** → correo, nombre y contraseña de al menos 10 caracteres escrita únicamente en el formulario → **Crear cuenta y espacios**. La provisión es idempotente por organización fuente; no se repite en cada login. En el proyecto actual no hay que recrear la cuenta ni restablecerla. No guardar ni enviar contraseñas por chat, documentación o repositorio.

El **comprador no tiene cuenta ni portal privado**: consulta QR y copias públicas de reportes. Es un ajuste aprobado por el autor frente a la memoria inicial para reducir la superficie de acceso y mostrar exclusivamente información autorizada.

**Crear/leer/revocar un reporte compartido desde la UI está aprobado:** el autor pulsó Revocar en el único reporte QA desde profesor/demo y la página anónima mostró **No encontrado** tras recarga. También abrió sin login la ficha del **saco #1 de 45 kg de LAV002**, con foto y calidad heredada SCA 86/defectos 0/3; esos 45 kg físicos son distintos de los 46 kg configurados para equivalentes.

## Copiloto OpenAI

Usa la API de OpenAI directamente desde una función de servidor, sesión del usuario/RLS y herramientas de solo lectura limitadas a la organización seleccionada. **`OPENAI_API_KEY` ya está configurada y se verificaron respuestas reales**; no es un pendiente del cierre. En otra instalación se configura en Project Settings → Secrets, nunca en código, chat ni documentación. `OPENAI_MODEL` es opcional; la implementación contempla alternativas cuando un modelo no está disponible. El coste corresponde a la cuenta OpenAI del autor.

Control servidor: evaluación 20 solicitudes/hora y 100/día; otras cuentas 60/hora y 300/día; entrada total 12 000 caracteres, `max_output_tokens` 900 y plazo **global de 40 segundos**, incluidas rondas de herramientas. No se almacenan prompts privados en los registros de cuota. Fechas inclusivas en hora de Costa Rica y precios ponderados separados por moneda. El peso de saco procede de Ajustes: equivalentes por peso y sacos físicos etiquetados se informan por separado.

Las muestras correctas del profesor tardaron 4,2 s, 3,4 s y 3,0 s; la organización original vacía, 5,9 s. **La meta <3 s no se logró** y no hay garantía de latencia.

En Chrome a 393 × 844 px, el resumen real de Barva respondió en **3,4 s**: entrega de **20 kg a CRC 4000/kg** y reservas de **15 kg a CRC 4200/kg** y **40 kg a CRC 3800/kg**, correctas según los registros. Esta muestra tampoco cumple <3 s.

## Sin conexión y límites

Solo cosechas y mediciones se encolan con la **app ya abierta**, en IndexedDB por usuario/organización; cambios de entorno o cierre de sesión detienen la cola anterior y descartan respuestas tardías. Inventario, reservas y entregas requieren conexión. El service worker no guarda HTML: **no se soporta arranque desde cero sin conexión**.

Quedan sin verificar: QR físico con cámara, dictado, arranque en frío offline y conexión rural. Realtime sí se comprobó con dos pestañas sin recargar y la navegación de ancho móvil con profesor en Chrome; no son pruebas de dispositivos físicos ni garantías de redes rurales. La revocación UI ya está aprobada. El tiempo para registrar el primer lote <5 minutos no fue cronometrado. Esta es una entrega académica con evidencia delimitada, no una garantía productiva.
