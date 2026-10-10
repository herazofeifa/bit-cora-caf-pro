# Estado final de entrega académica — Bitácora Café Pro

**Referencia documental:** `DOC-CIERRE-2026-10-10`. Evidencias actualizadas al 10 de octubre de 2026, 01:52 UTC; fecha local del autor: 9 de octubre de 2026 en `America/Costa_Rica`. **Versión funcional revisada:** `9c7576b0d72858c9d3d6f185b01e22f92bb4fb07`.

Este documento sustituye las notas incrementales como descripción vigente. El historial se conserva, expresamente no vigente, en [HISTORIAL_REVISION](HISTORIAL_REVISION.md). La consolidación es **solo documental**: no ejecuta pruebas sobre datos en uso ni modifica código, migraciones, base, cuentas, contraseñas, secretos, GitHub, publicación o DNS. No identifica ni anticipa una próxima rama de entrega.

## 1. Resultado y alcance

Existe una sola aplicación operativa con datos compartidos de la organización activa. No quedan recorridos visibles de operación basados en mocks o una segunda caché local: las copias en `legacy/` están fuera del producto. Los accesos antiguos redirigen a las vistas equivalentes. Inicio muestra identidad, organización y rol reales.

El prototipo académico conecta cosecha, recibo, lote, procesos, calidad, disponibilidad y comercialización con trazabilidad. Conserva información original de unidades y origen, registra diferencias de peso como merma, separa reserva/compromiso/bloqueo/venta y facilita consulta pública autorizada por QR. No se presenta como sistema productivo certificado ni se prometen garantías de disponibilidad, latencia o funcionamiento rural.

**App aún sin publicar.** Se usa la [vista previa estática actual](https://id-preview--fbcc9b68-7ecc-4206-8f7d-fd25606bf21e.lovable.app). El autor configurará el subdominio al finalizar; no se publica ni se configura DNS en este cierre.

## 2. Evidencias por origen: no sumar universos distintos

Las comprobaciones nuevas que se consolidan a continuación fueron **comunicadas por el autor como verificación independiente** de la revisión funcional indicada. Esta edición no pretende haberlas repetido.

| Evidencia | Resultado y alcance |
|---|---|
| GitHub real | Repositorio **público** [herazofeifa/bit-cora-caf-pro](https://github.com/herazofeifa/bit-cora-caf-pro), conectado realmente y accesible sin invitación; Settings confirma «This repository is currently public». La visibilidad la cambió el autor, con autorización explícita y verificación humana; este cierre solo la documenta |
| CI de la revisión | [Run 38006323596](https://github.com/herazofeifa/bit-cora-caf-pro/actions/runs/38006323596), **Status Success**: trabajos `app` y `database` |
| App en CI | Tipos, build y **20/20 Vitest en 8 archivos**, según evidencia independiente del autor |
| Copia de fuente de 9c con `bun.lock` | Tipos y build aprobados; **20/20** unitarias. No se suma a CI como otro conjunto distinto de 20 reglas |
| Base real, casos seleccionados independientes | **59/59**: 30 inventario/RLS/QR + 15 cadena cosecha/procesos/calidad/reportes + 2 perfiles entre organizaciones + 12 vencimientos/transformaciones |
| Método de esos 59 | Identidad SQL simulada, datos de prueba revertidos; consulta posterior **0 organizaciones temporales**. No fueron 59 JWT reales ni 59 recorridos UI, y no se añaden a los casos de CI |
| Autenticación humana | Cuenta evaluadora creada por el autor; login real y ambos entornos probados |
| Realtime humano | Dos pestañas reales; cambio de reserva y cancelación visible sin recargar en la observadora |
| Exportaciones y consulta anónima | CSV descargado, PDF y ficha PDF revisados; fichas de lote/saco y reporte compartido abiertos sin login |
| Reporte QA: crear/leer/revocar desde UI | Aprobado: profesor/demo pulsó Revocar en el único reporte QA; página anónima tras recarga mostró **No encontrado** |
| Navegación real de ancho móvil | Profesor en Chrome a **393 × 844 px**: selector con dos opciones, blanco con tablero 0 registros y regreso a demo conservado; ficha pública a 393 px sin desbordamiento. No dispositivos físicos |

La suite `database` de CI trabaja sobre PostgreSQL desechable e incluye migraciones y concurrencia; no valida por sí sola la interfaz ni condiciones rurales. Los conteos históricos (108, 144, 199, 211, 227, 243, etc.) pertenecen a suites e incrementos anteriores: no se suman entre sí ni a los 59. No se declara un conteo SQL actual de CI que el autor no haya aportado.

## 3. Cuenta evaluadora y balance observado

**profesores@bitacoracafe.example está creada por el autor y su login es real.** No es un pendiente, no se recrea ni se pide otra contraseña. Selector inicial, indicador permanente y **Cambiar entorno** permiten usar dos espacios persistentes aislados de la organización original y entre sí.

El autor completó el recorrido real con profesor en **Chrome a 393 × 844 px**: selector completo con ambas opciones, cambio a blanco con tablero **0 registros** y vuelta a demo con los registros conservados. Es evidencia de navegador de ancho móvil; no implica teléfono físico, conexión rural ni cámara.

- **En blanco:** sigue vacío de fincas, cosechas, lotes, reservas y muestras de calidad. La base de configuración incluye unidades, plantillas y ajustes; no implica datos operativos. El cambio de entorno no reinicia nada.
- **Ejemplo:** 7 cosechas, 9 lotes y **9 reservas**. Dos reservas QA de 1 kg están canceladas y conservan el saldo; el conteo anterior de 7 era anterior a esas pruebas.

Balance observado en la demo real, en kg:

```text
1450 cosechados = 397 merma + 50 vendidos + 1003 físicos
1003 físicos   = 278 libres + 55 reservados + 25 comprometidos + 645 bloqueados
645 bloqueados = 535 con fase abierta + 110 bloqueados por calidad sin fase abierta
278 libres     = 118 Caturra + 160 Mezcla
```

El tablero diferencia café con fase abierta de café bloqueado sin fase abierta. Catuaí honey aporta los 110 kg bloqueados por calidad. Los balances son una **fotografía de la revisión**, no valores que la aplicación deba restablecer automáticamente tras nuevas operaciones.

La segunda reserva QA conservó tras recarga **vencimiento 19 de octubre de 2026** y **entrega pactada editada al 3 de noviembre de 2026**. Son campos distintos; las condiciones se editan con Guardar/Cancelar en un diálogo de la app, sin prompts del navegador. Se preserva la QA `45a22973…`, cancelada, y el resto de registros del profesor. No se alteran reservas en esta revisión documental.

## 4. Módulos y reglas implementadas

| Módulo | Alcance actual |
|---|---|
| Inicio | Identidad/org/rol reales, indicadores de físico y disponibilidad, fase abierta y bloqueo sin fase |
| Cosecha y Recibos | Finca/parcela, temporada, jornada, responsables, cantidad/unidad original; recibo y lote transaccionales |
| Lotes | Detalle filtrado por organización activa, ubicación, genealogía, historia y calidad heredada; división/mezcla compatibles |
| Procesos y plantillas | Fases, pesos y mediciones reales; mermas por diferencia; editor visual con versiones persistidas |
| Variables/humedad | Capturas y rangos configurados; historial, operador y alertas |
| Calidad | Puntaje/resultado, 10 atributos SCA, defectos primarios/secundarios, notas de taza; validación de rangos y calidad heredada identificada |
| Mermas | Registros manuales y por cierre de fase, con motivos e historial |
| Inventario y Café libre | Físico, libre, reservado, comprometido, bloqueado y vendido; movimientos/ubicación con actor y hora |
| Clientes y Reservas | Clientes reales; estados comerciales, precio/moneda/unidad, vencimiento separado de entrega pactada y condiciones |
| Reportes | Ocho secciones, filtros y rangos inclusivos; CSV/PDF/copia compartida; promedio ponderado separado por moneda |
| Trazabilidad | Historia y múltiples orígenes de mezcla; fases/mediciones y calidad heredadas en ficha y PDF, con publicación autorizada |
| Alertas y Auditoría | Umbrales persistidos, alertas automáticas de stock/humedad, resolución con actor; auditoría append-only |
| Ajustes | Fincas/parcelas con borrador y Guardar cambios, conversiones por organización, variables, rangos, peso de saco, plantillas y equipo autorizado |
| Copiloto | OpenAI directo, herramientas de lectura con RLS/org activa, sugerencias de clientes reales, fechas de Costa Rica y sacos diferenciados |

La prueba UI histórica autorizada de Ajustes creó finca, parcela y cosecha de 40 kg en Microbeneficio y comprobó el mismo lote tras recarga. Esos registros de prueba no convierten a la organización original en una demo ni se eliminan en este cierre; el historial conserva el contexto. «Original vacío» en las muestras del copiloto significa **sin café libre**, no necesariamente sin todo registro operativo.

### Seguridad e integridad

- Tablas operativas con `organization_id` y RLS por membresía; permisos por organización comprobados en servidor. La membresía en las dos demos no permite abrir un lote de la otra como si perteneciera a la activa.
- Inventario, reservas, mermas, calidad y división/mezcla mediante funciones transaccionales que bloquean el lote. Referencias entre tablas limitadas a la misma organización.
- Claves de operación vinculadas a actor/operación/argumentos; reintentos equivalentes no repiten efectos y datos distintos se rechazan.
- Venta requiere liberación explícita. Confirmar o entregar una reserva vencida se rechaza sin depender de ejecutar previamente el vencimiento masivo.
- Mezclar estados físicos incompatibles o transformar un lote con fase running/paused se rechaza atómicamente. Variedades/procesos distintos sí pueden formar una mezcla físicamente compatible.
- Conversión de cosecha tomada de unidades de la organización en el servidor; factor fraudulento rechazado sin recibo. No se implementa conversión excepcional autorizada fuera de alcance.
- Auditoría append-only, actor y hora del servidor. Perfiles/roles visibles para el propio usuario o administrador con organización compartida, sin administración global transversal.
- Respuestas tardías se descartan al cambiar organización/sesión; las colas de capturas están particionadas por usuario y organización.
- Alta de evaluador/equipo idempotente respecto al rol que crea el trigger; compensación limitada al usuario creado por la solicitud fallida o perdedora. Alta Auth+trigger comprobada históricamente con usuario temporal exclusivo, eliminado después; **dos altas simultáneas reales siguen sin evidencia de ejecución**.

## 5. Realtime, archivos, CSV, PDF y publicación autorizada

### Actualización sin recargar

El autor verificó **dos pestañas reales**: reservar 1 kg cambió disponible/reservado de **50/15 a 49/16** en la pestaña observadora; cancelar restituyó **50/15**, sin recargar. Esto demuestra ese recorrido concreto de reservas, no todas las tablas/dispositivos ni una garantía de conectividad rural. La implementación también suscribe catálogos y mediciones por organización; no se atribuye a todas esas tablas la misma prueba manual.

### Archivos y exportaciones

- Foto **JPEG** y certificado **PDF** reales del entorno evaluador fueron abiertos. Archivos privados, con lectura autorizada; contratos excluidos de publicación.
- **CSV real descargado:** 12 columnas de todas las secciones; cifras y monedas contrastadas. Unión estable de columnas para filas heterogéneas, celdas no aplicables vacías y textos de fórmulas neutralizados sin modificar los números.
- **Reporte PDF real:** 2 páginas, revisado visualmente.
- **Ficha PDF real:** 1 página con foto, QR y calidad heredada **SCA 86, defectos 0/3**, revisada visualmente. Las tablas emplean encabezados propios.
- jsPDF 4.2.1 y AutoTable 5.0.8 actualizados en la revisión funcional; el mantenimiento de dependencias reduce riesgos conocidos, no certifica ausencia de vulnerabilidades.

### Consulta pública sin login

El autor abrió una **ficha pública de lote** y un **reporte compartido real**, sin iniciar sesión, en la vista previa estática actual. Ficha: sin clientes, contratos ni precios. Reporte: sin clientes ni reservas. No se publican en esta documentación tokens concretos de enlaces.

También abrió sin login la ficha del **saco #1 de 45 kg de LAV002**, con foto, **SCA 86, defectos 0/3 y calidad heredada**. El peso físico de ese saco (45 kg) no es el peso configurado de 46 kg para calcular equivalentes. La ficha pública a **393 px** se vio sin desbordamiento en navegador de ancho móvil.

Las fichas de lote/saco usan tokens; desconocido y privado no revelan información. Finca/parcela/productor/mediciones/calidad se muestran solo cuando la publicación lo autoriza. Genealogía múltiple no atribuye una mezcla a una única finca y no expone archivos de orígenes privados, IDs internos, auditoría ni datos comerciales. `exported_at` es fecha de exportación explícitamente declarada o null; `generated_at` no la sustituye ni una venta local prueba exportación.

Reportes compartidos son copias con caducidad y revocación. **Recorrido UI de crear/leer/revocar aprobado:** desde sesión real profesor/demo, el autor pulsó **Revocar** en el único reporte QA y la página pública anónima mostró **No encontrado** tras recarga. Se incorpora esta evidencia real, además de la prueba de servidor; no se crea ni limpia otro QA en este cambio documental. QR físico leído por cámara sigue sin probarse.

## 6. Copiloto: evidencia correcta y límites

Proveedor: **OpenAI API directa**, secreto ya guardado por el autor, sesión RLS del usuario y herramientas allowlisted de solo lectura en la organización activa. No falta la clave ni se necesita pedirla otra vez. No se exponen valores de secretos ni se guardan prompts privados en registros de cuota.

| Sesión y pregunta real | Resultado contrastado | Latencia informada |
|---|---|---|
| Profesor/demo: café libre por variedad | **118 kg Caturra + 160 kg Mezcla = 278 kg** | **4,2 s** |
| Profesor/demo: procesos >20 días y precio ponderado por moneda del año | Fermentación **22 días**; **USD 6,80/kg** sobre 30 kg y **CRC 4000/kg** sobre 20 kg | **3,4 s** |
| Profesor/demo: sacos Caturra disponibles | **118 / 46 ≈ 2,56 sacos equivalentes**, separados de **2 sacos físicos** etiquetados | **3,0 s** |
| Profesor/demo en Chrome a 393 × 844 px: resumen Barva | Entrega **20 kg a CRC 4000/kg**; reservas **15 kg a CRC 4200/kg** y **40 kg a CRC 3800/kg**, correcto según registros | **3,4 s** |
| Administrador/organización original sin café libre | Cero lotes libres, coherente con base en la muestra | **5,9 s** |

El peso de saco **46 kg** es configuración persistida de la demo y editable, no una equivalencia universal inventada. Sin peso configurado se informa en kg, sin fabricar un conteo físico.

Rangos `desde..hasta` inclusivos en **America/Costa_Rica**, convertidos a [inicio del primer día, inicio del día posterior al último). Evitan excluir entregas de hoy: el caso del 9 de octubre de 2026 a las 23:16 UTC queda dentro del día de Costa Rica. Los filtros de Reportes, CSV, PDF y copia compartida usan el mismo criterio. USD y CRC no se mezclan en un único precio medio.

Límites de servidor: **20 solicitudes/hora y 100/día para evaluación**; 60/hora y 300/día para otras cuentas; entrada total **12 000 caracteres**; **900 `max_output_tokens`**; **40 segundos globales** mediante AbortSignal, incluidas rondas de herramientas. Quotas y deadline implementados/pruebas de servidor no equivalen a una prueba manual de agotar todas las cuotas con el profesor.

**Meta <3 segundos NO lograda.** Una muestra de 3,0 s no es inferior a 3. No hay promesa de latencia. **Primer lote <5 minutos NO cronometrado.**

## 7. Acceso, roles y provisión

Cinco roles internos: **Administrador, Encargado de beneficio, Productor/finca, Comercial y Consulta**. App privada, sin registro abierto ni Google. Roles de la membresía, no datos editables del navegador. El evaluador administra solo sus dos espacios operativos pero no crea cuentas, modifica membresías ni crea nuevos entornos.

El **comprador no tiene cuenta ni portal privado**: usa ficha QR de lote/saco y reportes publicados. Ajuste aprobado explícitamente por el autor frente a la memoria inicial, para limitar la superficie de acceso, evitar administrar cuentas externas y compartir exclusivamente información elegida por el productor. No se añade un sexto rol ni un portal comprador.

La cuenta evaluadora actual ya existe. Para otra instalación, el administrador de la organización original abre Ajustes → Usuarios y roles → **Cuenta para profesores**, escribe correo, nombre y contraseña (mínimo 10 caracteres) **solo en la UI**, y pulsa **Crear cuenta y espacios**. Provisión idempotente por organización fuente; espacios persistentes, sin reinicio al cambiar. No se recopilan contraseñas en chat ni se incluyen en fuente/documentación; no recrear ni cambiar la actual durante la evaluación.

Recorrido detallado: [RECORRIDO_EVALUACION](RECORRIDO_EVALUACION.md).

## 8. Reproducibilidad y migraciones

[README](../README.md) contiene requisitos, arranque y comandos coherentes con `package.json` y `bun.lock`: Bun con lockfile actual (1.4.2 en revisión independiente); Node 22.12+ en rama 22 o Node 24 para el conjunto de herramientas; PostgreSQL 17 solo para SQL local desechable como usuario no root. Una copia de código no incorpora credenciales, datos ni servicios alojados.

Inventario completo de migraciones SQL existentes, en orden:

| Migración | Finalidad |
|---|---|
| 0000 `migration` | Perfiles, roles, trigger de alta |
| 0001 `shared_operational_core` | Operación compartida, organizaciones, RLS, auditoría y transacciones |
| 0002 `fix_lot_links_policy` | Política de genealogía |
| 0003 `harden_function_privileges` | Privilegios internos y search_path |
| 0004 `closing_core_operations` | Liberación, cosecha, fases, plantillas, archivos, QR y reportes |
| 0005 `lot_files_type_restriction` | Tipos de archivo permitidos |
| 0006 `audit_fixes` | Idempotencia, exportación, vencimientos, aislamiento de equipo |
| 0007 `evaluation_spaces` | Dos espacios persistentes de evaluación y ejemplo transaccional |
| 0008 `unified_product_closing` | Términos de reserva, ubicación, alertas, realtime |
| 0009 `alert_severity_fix` | Severidades de alertas válidas |
| 0010 `lineage_guards` | Paso histórico sin cambios efectivos, sustituido por 0011 |
| 0011 `lineage_guards_apply` | Transformaciones seguras, procedencia/historia heredadas |
| 0012 `quality_units_copilot_quota` | SCA/defectos, conversión de servidor, cuota copiloto |
| 0013 `eval_settings_inherited_quality` | Ajustes base evaluación y calidad heredada autorizada |

Archivos `.sql` bajo `drizzle/migrations/`; metadatos versionados bajo `meta/`. No se agregan ni se reaplican migraciones en este cierre documental. No ejecutar suites de fixtures contra la base en uso como parte del arranque.

## 9. Pendientes y alcance no demostrado

| Punto | Estado exacto |
|---|---|
| Leer QR físico con cámara | No probado |
| Dictado por voz | No probado; depende del navegador |
| Arranque en frío sin conexión | No soportado: service worker no guarda HTML; no probado como recorrido |
| Capturas offline en dispositivo/red rural real | No probado en esas condiciones |
| Conexión rural, dos dispositivos físicos | Sin evidencia; dos pestañas realtime y navegador de ancho móvil 393 × 844 px sí probados, sin equivalencia a dispositivos físicos |
| Alta simultánea Auth/provisión de dos solicitudes reales | Revisada/compensación implementada, sin prueba simultánea real |
| Agotar cuotas/deadline del copiloto manualmente con profesor | Sin evidencia manual completa |
| Latencia <3 s / primer lote <5 min | Primera meta no lograda; segunda no cronometrada |
| Publicación/subdominio | Sin publicar; a cargo del autor después, fuera de este cambio |

**Offline real de alcance limitado:** cosechas y mediciones con la app ya abierta; cola persistente por usuario/org y aislamiento de envíos/generaciones. Inventario, reserva y entrega requieren conexión. No se afirma arranque desde cero sin conexión ni tolerancia garantizada de fallos prolongados.

GitHub CI **ya no es un pendiente de esta versión funcional**: el run enlazado fue verificado Success por el autor. Esto no afirma éxito de una futura revisión documental ni reemplaza los pendientes manuales enumerados.
