# Estado de entrega — cierre (prototipo con datos de prueba)

Fecha: 2026-10-09. Se describe solo lo que existe y lo que realmente se ejecutó. No se publicó la
app, no se enviaron correos, no se crearon cuentas, no se crearon datos demo en la base real
y no se tocaron los datos ni usuarios existentes.

## 1. Los 4 casos que fallaban (corregidos en `0004_closing_core_operations.sql`)
| Caso reportado | Corrección | Prueba (`tests/db/closing.test.sql`) |
|---|---|---|
| `create_lot` cereza/en_proceso devolvía 100 kg libres | Nueva columna `sale_released`; un trigger deriva el estado comercial y bloquea todo el café no liberado. Solo `release_lot_for_sale` lo libera. La aprobación de calidad **no** libera café en proceso. | libre 0 / bloqueado 100 al crear; aprobado sigue en proceso; libre 100 tras liberar |
| `deliver_reservation` entregaba con `bloqueado_calidad` | Rechazo antes de cualquier cambio (atómico) | peso, comprometido y estado de la reserva intactos tras el rechazo |
| `create_reservation` aceptaba precio Infinity | Precio finito (0 ≤ p < 1e9), moneda ISO obligatoria con precio, unidad `kg` explícita; constraints en la tabla | Infinity, -Infinity, NaN, sin moneda y unidad `lb` rechazados |
| `create_lot` aceptaba finca de otra organización | Validación explícita en las funciones + trigger genérico `_same_org_refs` en todas las tablas con referencias (finca, parcela, recibo, lote, cliente, fase, plantilla, archivo, saco) | finca/parcela ajenas rechazadas en función e INSERT directo; reserva con cliente ajeno rechazada |

Además: estado comercial derivado siempre (disponible → reservado → comprometido → vendido parcial/vendido),
idempotencia por clave de operación (`operation_keys` + bloqueo advisory) en creación de lote, cosecha,
reserva, entrega, fases y mediciones: la repetición devuelve el mismo resultado, con un solo movimiento y una
sola fila de auditoría.

## 2. Funciones de cierre
| # | Funcionalidad | Estado |
|---|---|---|
| 1 | **Cosecha** (`/operacion/cosecha`): trabajadores, número, responsable, corte/pasilla/repela, temporada, calidad inicial, fecha, finca/parcela/variedad, cantidad en kg o unidad configurada. `register_harvest` crea recibo + lote nuevo o suma a lote existente en **una** transacción. | Hecho y probado. Si falla, no queda recibo huérfano. |
| 2 | **Procesos**: plantillas Lavado/Honey/Natural/Anaeróbico con rangos de pH, temperatura, Brix y humedad; plantillas personalizadas versionadas (`save_process_template`). Fases reales con hora, operador y peso de entrada. Mediciones fuera de rango crean alerta. Al cerrar una fase con el peso medido, la diferencia se registra como merma de proceso y se cambia el estado físico. Lista de procesos atrasados o con más de 20 días fermentando. | Hecho en servidor y en `/operacion/lote/:id`. Pendiente: el **editor visual** de plantillas personalizadas aún no llama a `save_process_template` (la función existe y está probada). |
| 3 | **Archivos**: bucket privado `lot-files` (10 MB), carpeta por organización, solo JPG/PNG/WEBP/PDF (tabla y política de almacenamiento), lectura con enlace firmado de 5 min, contratos nunca públicos (constraint). Solo los archivos marcados aparecen en la ficha pública. | Hecho. Subida probada en tipos/políticas; **no se subió un archivo real** en esta sesión. |
| 4 | **QR anónimo**: `/t/:token` (lote) y `/s/:token` (saco). Token único global de 32 hex; ficha despublicada por defecto; privado e inexistente devuelven el mismo 404; sin stock, clientes, precios ni contratos. Sacos con identificador propio y etiquetas PDF con QR. | Hecho. Probado: anónimo publicado/privado/inexistente, saco de lote privado, otra organización. 404 verificado en navegador. |
| 5 | **Reportes** (`/operacion/reportes`): datos del servidor con filtros (fechas, finca, variedad, proceso, temporada, cliente, estado comercial, calidad); CSV y PDF descargables (jsPDF); precio promedio ponderado por kg entregado y por moneda. Compartir crea una **copia publicada** con vencimiento (1–90 días) y revocable (`/r/:token`), sin clientes. | Hecho. Ficha de lote en PDF: pendiente (solo etiquetas de saco y reporte). El módulo antiguo `/reports` sigue leyendo la caché local. |
| 6 | **Copiloto** (`/copiloto`): OpenAI Responses API directa desde el servidor; 7 herramientas de solo lectura con esquema estricto y allowlist; organización validada con la membresía; RLS del usuario. Dictado por voz si el navegador lo permite. Mensajes claros si falta la clave, hay timeout (45 s), 401, 429 o 5xx. | Código hecho. **Falta `OPENAI_API_KEY`**: verificado que la app muestra el aviso de configuración. Sin clave no se probó una respuesta real ni se midió la latencia. |
| 7 | **Sin conexión**: el service worker guarda solo archivos estáticos (nunca HTML, API ni sesión) y no se activa en la vista previa. Cola en IndexedDB por usuario y organización para cosechas y mediciones, con clave de operación, reintento manual y automático (al volver la conexión y cada 30 s) y rechazos visibles. Se conserva al cerrar el navegador. Inventario, reservas y entregas requieren conexión (se explica en la pantalla). | Hecho. No se probó en un dispositivo real sin señal. |
| 8 | **Demo**: botón de administrador “Crear entorno demo” (`create_demo_environment`) que crea una organización separada con datos de prueba. Desde la organización demo, el administrador crea una cuenta de evaluador (consulta o productor) escribiendo la contraseña; esa cuenta solo pertenece a la demo. Selector de organización. | Hecho y probado (en la base local, no cambia los datos de la organización real). **No se ejecutó en la base real.** |

## 3. Pruebas ejecutadas realmente (sandbox, 2026-10-09)
| Comando | Resultado |
|---|---|
| `bun run typecheck` | sin errores |
| `bun run test` (Vitest) | 4 archivos, 6 pruebas OK (incluye el promedio ponderado (60×6 + 40×8)/100 = 6,8) |
| `bash tests/db/run-local.sh` | migraciones 0000–0005 sobre PostgreSQL 17 desechable; `core.test.sql` + `closing.test.sql`: 108 aserciones `ok`; concurrencia: `successful=6 rejected_oversell=4 reserved_free=90 10` |
| `bun run build` | OK |
| Navegador (Playwright, sesión del administrador) | `/operacion`, `/operacion/cosecha`, `/operacion/reportes` y `/copiloto` cargan; `/t/<token inexistente>` y `/s/abc` muestran “No encontrado”; el copiloto muestra el aviso de clave faltante |

**No ejecutado:** la propagación de cambios en tiempo real entre dos dispositivos (el código se suscribe a
`lots`, `alerts` y `reservations`, pero no se verificó con dos sesiones), las pruebas de interfaz
automatizadas y el CI de GitHub (`.github/workflows/ci.yml` existe; no consta que el repositorio esté conectado).

## 4. Pendiente exacto
- **Configuración del autor:** agregar `OPENAI_API_KEY` (y opcionalmente `OPENAI_MODEL`, por defecto `gpt-4.1-mini`) en Secretos.
- **Pantallas antiguas:** `/lots`, `/harvest`, `/intake`, `/process-control`, `/reservations`, `/inventory`, `/waste`, `/quality`, `/reports` y `/traceability` siguen usando la caché local por usuario. La operación compartida está en **Operación (servidor)**.
- **Plantillas:** falta conectar el editor visual de plantillas personalizadas a `save_process_template`.
- **PDF:** falta la ficha de lote en PDF.
- **Tareas programadas:** no se agenda `expire_reservations`; se ejecuta solo al llamarla.
- **Tiempo de respuesta:** no se garantiza la latencia del copiloto (no se midió).


## Correcciones de la auditoría independiente (migración 0006)

| Hallazgo | Corrección | Prueba |
|---|---|---|
| `create_lot` con misma `_op_key` y datos distintos devolvía el lote anterior | La clave queda ligada a actor + operación + md5 de los argumentos canónicos en create_lot, create_reservation, deliver_reservation, register_harvest, start_phase, log_phase_variable y close_phase. Datos distintos → "ya se usó con datos distintos"; otro usuario → "pertenece a otro usuario". | `audit.test.sql` (lote, reserva, entrega, cosecha); `closing.test.sql` ajustado: el caso antiguo reutilizaba la clave con otro contenido |
| `public_lot_view.exported_at = now()` | `exported_at` = fecha declarada explícitamente con `declare_lot_export` (admin/comercial, no futura, auditada) o `null`; `generated_at` aparte. Una entrega no cuenta como exportación. UI: "Fecha real de exportación" en la ficha del lote. | `audit.test.sql`: null sin declarar, fecha declarada exacta, futura rechazada, otro rol/org rechazado |
| Reserva vencida confirmable/entregable sin correr `expire_reservations` | confirm/deliver rechazan si `expires_at <= now()`; create_reservation rechaza fechas pasadas. | `audit.test.sql`; `concurrency.sh`: 5 vencimientos + 5 confirmaciones simultáneas → `confirmed=0 releases=1 status=vencida reserved=0` |
| Respuestas asíncronas repoblaban datos tras logout/cambio de org (`cloud.ts`) | Contador de generación; respuestas de una generación anterior se descartan. | `src/lib/__tests__/cloud-generation.test.ts` (logout en vuelo, cambio A→B) |
| `cloudSaveFarms/Parcels` perdía el mapeo de IDs temporales | Toda finca/parcela se envía con UUID; `cloudSaveFarms` devuelve mapeo temporal→confirmado y las parcelas lo aplican. | mismo archivo de prueba |
| SELECT de profiles/user_roles con `has_role` global | `can_see_user()`: el propio usuario o un administrador con membresía compartida. Se eliminaron las políticas de escritura global de `user_roles` (solo servidor). Ajustes muestra el equipo de la organización seleccionada. | `audit.test.sql`: admin global de B no ve perfiles/roles de A; consulta solo ve el suyo |
| `createTeamUser` usaba la primera membresía | Recibe la organización elegida (obligatoria), valida `has_org_role(org, administrador)` en servidor y, si falla membresía/rol/auditoría, borra la cuenta creada (compensación). | Revisión de código; no se crearon cuentas reales (sin autorización) |

**Ejecutado realmente (9 oct 2026):** `bash tests/db/run-local.sh` sobre PostgreSQL desechable con migraciones 0000–0006: 144 líneas `ok`, `ALL DB/CLOSING/AUDIT TESTS PASSED`, concurrencia de reservas `6/4/90 10`, carrera de vencimiento OK. `bunx vitest run`: 9 pruebas en 5 archivos. Revisión de tipos sin errores. En la base real se verificó por consulta que las 7 funciones usan la huella y que las políticas nuevas están activas.

**Pendiente/no verificado:** alta de usuario con compensación no probada contra la base real (requiere crear cuenta); la huella usa la representación numérica enviada (`100` y `100.0` cuentan como datos distintos).


## Entornos de evaluación (migración 0007)

- `provision_evaluation` crea en una transacción y una sola vez (bloqueo + fila única) «en blanco» y «con datos de ejemplo»; la cuenta evaluadora queda como administradora solo de esos dos espacios. El autor no queda como miembro.
- Datos de ejemplo generados con las RPC reales; únicas escrituras directas: retroceso de fechas para simular una reserva vencida y una fermentación de 22 días.
- Bloqueos: los espacios no permiten gestionar miembros ni crear cuentas; `create_demo_environment` exige administrador de organización real.
- UI: selector al iniciar sesión, franja permanente y «Cambiar entorno»; caché local separada por espacio; «Datos demo» locales ocultos para el evaluador.
- Prueba `tests/db/evaluation.test.sql`: idempotencia, aislamiento (evaluador sin acceso a la organización original, sus clientes y su equipo), en blanco con cero operaciones y 4 plantillas/3 unidades, los 5 estados de reserva, USD+CRC, división/mezcla, bloqueo de calidad, alertas, proceso atrasado, saldos reservado/comprometido/vendido iguales a sus reservas, ficha pública sin contrato ni clientes, precio ponderado USD 6,80 y CRC 4000. Suite completa: 199 líneas `ok`. Vitest: 11 pruebas.
- Verificado en el navegador: la tarjeta «Cuenta para profesores» aparece en Ajustes para el administrador.
- **No verificado:** creación real de la cuenta y los espacios en la base real (espera a que el autor escriba la contraseña), subida de foto/certificado de ejemplo, selector con la cuenta real, tiempo real entre dos dispositivos.
- Recorrido: `docs/RECORRIDO_EVALUACION.md`.

## Cierre: una sola aplicación con datos persistidos (9 oct 2026)

**Qué cambió**
- Se eliminó el menú «Operación (servidor)» y la caché local de todas las rutas accesibles. Cada módulo (Inicio, Cosecha, Recibos, Lotes, Procesos, Editor de plantillas, Variables/humedad, Calidad, Mermas, Inventario, Café libre, Clientes, Reservas, Reportes, Trazabilidad, Alertas, Auditoría, Ajustes, Copiloto) lee y escribe solo la organización elegida, con actualización en vivo entre sesiones (lotes, reservas, fases, mediciones de variables y humedad, catálogos, archivos, ajustes).
- Direcciones antiguas redirigen a la vista equivalente: `/operacion` → Inicio, `/operacion/cosecha`, `/harvest/new`, `/intake/new` → Cosecha, `/operacion/reportes` → Reportes, `/operacion/lote/:id` → `/lots/:id`, `/variables/new|log` → Variables (pestaña), `/process-control` → Procesos (fases en curso), `/assistant` → Copiloto (con accesos guiados a cosecha, humedad, merma y reserva). `/public/lot/:code` ya no expone datos (las fichas públicas se abren por token QR `/t/…`).
- Inicio usa el nombre del usuario, la organización y el rol reales.
- Ajustes: fincas/parcelas, conversiones de unidades por organización, umbral de stock bajo, rango de humedad y peso por saco persistidos; variables propias; el editor visual de plantillas guarda versiones reales (`save_process_template`).
- Reservas: fecha de entrega pactada y condiciones, distintas del vencimiento; precio, moneda (USD/CRC) y unidad.
- Inventario: movimientos con hora y autor, ubicación del lote con historial auditado (`set_lot_location`), ajuste con motivo.
- Alertas automáticas: stock bajo (se resuelve sola al recuperarse) y humedad bajo el mínimo; resolver alertas registra quién.
- Ficha de lote en PDF con origen, fases, calidad, fotos marcadas para la ficha y QR público; etiquetas de saco y reportes ya existían.
- Pantallas antiguas guardadas solo como referencia en `legacy/` (fuera de la compilación).

**Pruebas ejecutadas**
- Base de datos desechable: 211 comprobaciones `ok` (incluye 12 nuevas en `tests/db/unified.test.sql`: alerta de stock bajo sin duplicados y autorresuelta, entrega pactada separada del vencimiento y no anterior a la reserva, alerta de humedad, ubicación auditada, permisos de consulta). Esta prueba encontró y corrigió un error real: la alerta de stock usaba un nivel no permitido y habría bloqueado reservas.
- Vitest: 11 pruebas. Compilación de tipos y build sin errores.
- Navegador (sesión del administrador): las 22 rutas cargan sin errores de página en escritorio; Inicio, Lotes y Reservas en móvil (390 px) con barra inferior y botón «Registrar». Ninguna pantalla muestra «Paco», «servidor» ni «caché».
- Entorno demo ficticio creado por el administrador (`create_demo_environment`, organización «Demo evaluación 09/10 22:59»): Inicio 320 kg libres, Inventario 670/320/50/0/300/100 kg, reservas activa y entregada, trazabilidad y proceso atrasado coherentes.
- Subida real de foto JPG y certificado PDF a un lote del demo; lectura con enlace firmado: HTTP 200, `image/jpeg`.
- Copiloto con OpenAI real: «¿Cuánto café libre tengo por variedad y cuántos kg entregué este año?» → Caturra 320 kg libres (50 reservados), Geisha 0 (300 en proceso), 100 kg entregados a USD 6,50/kg: coincide con la base. Latencia medida 8,8 s (otra consulta 10,2 s); no se promete menos de 3 s. El proyecto de OpenAI no tiene acceso a `gpt-4.1-mini`; el copiloto prueba modelos alternativos en orden automáticamente.

**Limitaciones honestas**
- La cuenta de profesores y sus dos espacios **no se han creado**: requiere que el autor escriba la contraseña en Ajustes → Usuarios y roles → «Cuenta de evaluación». Por eso el selector de los dos entornos no se probó con la cuenta real.
- Actualización en vivo entre dos dispositivos físicos y funcionamiento sin conexión en un teléfono real no se probaron (solo en navegador automatizado).
- La organización demo de prueba y sus 2 archivos quedan en la base; el autor puede ignorarla (solo es visible para él).
- La ejecución de CI en GitHub no se verificó desde aquí.

## Corrección alta de cuentas (09/10)
- Causa: el disparador de alta ya crea el rol `consulta`; el formulario lo insertaba de nuevo → `user_roles_user_id_role_key`. Ahora la cuenta evaluadora y «Crear usuario» (incluido Consulta) agregan el rol sin duplicar.
- Concurrencia: si otra solicitud ya dejó otro evaluador, la solicitud perdedora borra solo la cuenta que ella misma creó; nunca cuentas previas.
- Evidencia real: usuario temporal creado con el alta real (con disparador), reproducido el error con el código anterior, alta correcta con el nuevo (consulta y comercial), y usuario temporal eliminado. La concurrencia se revisó en código y en el bloqueo de la base, sin prueba simultánea real.

## Cierre de hallazgos independientes (09/10, después de 64b8130)
**A · Copiloto.** El secreto OPENAI_API_KEY existe en el proyecto y (comprobado solo por presencia) está en el entorno del servidor de la vista previa. Prueba real como administrador en /copiloto: «¿Cuánto café libre tengo por variedad?» → respuesta real de OpenAI («No hay registros de café libre por variedad. Total registrado: 0 kg», herramienta inventario_libre, 5,7 s), coherente con la organización original sin lotes libres. La llamada sigue en la función de servidor con la sesión RLS del usuario y herramientas de solo lectura; no se movió a otro lugar ni se cambió de proveedor. El mensaje «falta la clave» que vio el revisor corresponde a un servidor iniciado antes de guardar el secreto (inferencia; no reproducido).
**B · Mezclas/divisiones (migración 0011).** `merge_lots` rechaza estados físicos distintos (nada se crea ni descuenta); variedades/procesos distintos se permiten con el mismo estado (se etiquetan «Mezcla»/«mezcla»). `merge_lots` y `split_lot` rechazan lotes con una fase running/paused. Este es 1 caso nuevo que fallaba en 64b8130 y ahora pasa en la base local desechable.
**C · Procedencia heredada.** Nueva `lot_lineage` (con RLS del usuario) y `public_lot_view` recorren los lotes de origen: orígenes múltiples, fases y mediciones heredadas. Una mezcla nunca se atribuye a una sola finca (`farm` vacío y lista `origins`). La ficha pública respeta los permisos de finca/parcela/productor/mediciones de la publicación; no incluye archivos de los orígenes, clientes, precios, reservas, auditoría ni IDs internos. La ficha interna y el PDF muestran la procedencia y las fases heredadas.
**Pruebas ejecutadas:** base local desechable 227 aserciones (16 nuevas en tests/db/lineage.test.sql), EXIT 0; Vitest 11/11; typecheck limpio. **No ejecutado:** CI de GitHub, prueba visual de la ficha pública de una mezcla en el navegador, concurrencia simultánea real de la cuenta evaluadora.

## Revisión 64b8130 – puntos pendientes cerrados (09/10, 23:30 UTC)
1. **Calidad:** formulario único (Calidad y ficha del lote) con puntaje, resultado, 10 atributos SCA (0–10), defectos primarios/secundarios + descripción, notas de taza y observaciones. `record_quality` los valida en la base (atributos desconocidos, rangos y defectos negativos se rechazan). Se muestran en la ficha interna, en el PDF y en la ficha pública solo si la publicación permite «calidad».
2. **Organización activa:** `getLot` filtra también por la organización seleccionada. Cola offline: cada elemento guarda su organización; el envío toma usuario/organización/generación al empezar, se detiene si cambian y descarta respuestas viejas. Prueba `src/lib/__tests__/offline-queue-race.test.ts` (cambio de entorno a mitad de envío: el 2.º elemento de la cola vieja no se envía y la lista nueva queda intacta).
3. **Conversión de unidades:** `register_harvest` usa siempre el factor configurado de la organización; un `kg_factor` distinto enviado por el cliente se rechaza y no crea recibo; una unidad no configurada se rechaza. Probado: 2 cajuelas de 12,5 kg → 25 kg; factor fraudulento 50 → rechazado, 0 recibos nuevos. Conversión excepcional autorizada: fuera de alcance, no implementada.
4. **Sacos:** herramienta `sacos_disponibles` del copiloto: kg libres, peso de saco tomado SOLO de los Ajustes guardados (sin valor por defecto), equivalencia = kg ÷ peso, y aparte las etiquetas físicas de saco. Respuesta real (OpenAI, organización original sin café Geisha libre ni peso configurado): «No hay sacos disponibles de la variedad Geisha… la organización no ha configurado el peso por saco, por lo que solo puedo informar en kg», 4,2 s.
5. **Límites del copiloto (servidor):** 20 preguntas/hora y 100/día para cuentas de evaluación (60/300 resto) vía `copilot_take_quota` (tabla `copilot_usage` sin texto de preguntas); entrada total ≤ 12 000 caracteres; `max_output_tokens` 900; un solo plazo de 40 s (AbortSignal) para todas las rondas, incluidas las herramientas. Los registros solo guardan el código de estado de OpenAI. Latencias reales medidas: 5,7 s y 4,2 s (no se promete < 3 s).
6. **PDF:** jsPDF 4.2.1 y jspdf-autotable 5.0.8. Ficha de lote (mezcla con 2 orígenes, fases, tabla de calidad con defectos/SCA, QR) y reporte con tabla generados con la biblioteca nueva y revisados visualmente.
**Pruebas:** base local desechable 243 aserciones (16 nuevas en tests/db/quality_harvest.test.sql), EXIT 0; Vitest 13/13; tipos limpios. **No ejecutado:** CI de GitHub; lectura del QR con un teléfono; PDF descargado desde el navegador; los límites del copiloto con la cuenta de evaluación real.
**Modo sin conexión (alcance real):** con la app ya abierta, las capturas de cosecha y mediciones se guardan en el dispositivo y se envían al volver la conexión. El service worker solo guarda recursos estáticos, no las páginas: abrir la app desde cero sin conexión no está soportado.

## Corrección Ajustes → Fincas/Parcelas (09/10/2026)

- Defecto: «Añadir finca/parcela» escribía en un estado local mientras la lista leía de la nube; mostraba éxito sin crear nada.
- Arreglo: añadir crea una fila en el borrador con UUID estable; solo «Guardar cambios» escribe en la base y el aviso de éxito aparece tras la escritura confirmada (errores reales se muestran). Conversiones, Variables y Plantillas ya no tenían acciones locales enlazadas.
- Prueba REAL en UI (Playwright, administrador original, Microbeneficio): crear «Finca Prueba UI» → guardar → «Parcela Prueba UI» → guardar → registrar cosecha 40 kg → lote LAV-2026-001 visible tras recargar; consulta a la base confirma finca, parcela y lote de 40 kg. Esos registros de prueba quedan en Microbeneficio.
- Copiloto: con la nueva OPENAI_API_KEY (no compartida), «¿Cuánto café libre tengo por variedad?» respondió con datos reales (cero lotes libres, coincide con la base) en 5,9 s medidos por el autor. No se garantiza <3 s.

## Cierre de hallazgos manuales (09/10/2026, 23:31 UTC)

Cuenta profesores@bitacoracafe.example y sus dos entornos: creados por el autor; no se reiniciaron ni reemplazaron.

1. Tablero: «En proceso» cuenta solo lotes con una fase abierta; nueva tarjeta «Bloqueado sin fase abierta» (proceso terminado, pendiente de calidad o de liberar). Captura real en la demo propia del autor: 300 kg en proceso / 0 kg bloqueado.
2. Calidad heredada: si un lote no tiene muestra propia, ficha interna, PDF y ficha pública muestran la última muestra aprobada del lote de origen con el texto «Calidad heredada del lote de origen …», respetando la opción de publicación de calidad. Comprobado en la ficha pública de LAV-2026-002 (demo de evaluación): SCA 86, defectos 0/3, «heredada de LAV-2026-001».
3. Fechas en español con zona America/Costa_Rica: fechas de solo día «6 oct 2026»; marcas de tiempo «9 oct 2026, 17:36 (hora de Costa Rica)». Comprobado en la misma ficha pública (exportación 6 oct 2026).
4. Configuración base: la provisión ahora guarda org_settings explícita (stock bajo 100 kg, humedad 10–12 %, saco de demostración 46 kg marcado como configurable). Se añadió a las dos demos existentes sin tocar sus otros registros ni permisos. El copiloto solo usa el peso de saco guardado.
5. Reservas: etiquetas accesibles en vencimiento, entrega pactada y condiciones; «Condiciones» abre un diálogo de la app con Guardar/Cancelar (sin prompt del navegador). Prueba real (Playwright, demo propia del autor, no la de evaluación): reserva de 1 kg con vencimiento 19 oct y entrega pactada 29 oct → visible tras recargar; editada en el diálogo a 3 nov → visible tras recargar; luego cancelada. La reserva QA 45a22973… de la demo de evaluación no se tocó.

## Regresión del copiloto: rangos de fechas (09/10/2026, 23:40 UTC)

- Causa: ventas_entregadas pasaba `hasta` como fecha sin hora a sales_summary (`delivered_at < _to`), así que «hasta = hoy» excluía todo el día de hoy.
- Arreglo: nuevo módulo de rangos en hora de Costa Rica. `desde..hasta` son inclusivos y se convierten a [00:00 CR de desde, 00:00 CR del día siguiente a hasta). Lo usan el copiloto (ventas y mermas) y Reportes; el CSV, el PDF y las copias compartidas salen de esos mismos datos filtrados. El copiloto calcula «hoy / este mes / mes pasado / este año» en hora de Costa Rica.
- Pruebas de regresión: src/lib/__tests__/date-range.test.ts (entrega 23:16 UTC con hasta = hoy incluida; 05:59 UTC del día siguiente aún es hoy en CR; 06:00 UTC ya no).
- Consulta a la base con el rango corregido, demo de profesores: USD 30 kg a 6,80/kg y CRC 20 kg a 4000/kg, 50 kg entregados este año.
- Respuesta REAL del copiloto con la misma pregunta, sesión del autor en su demo propia (no hay acceso de agente a la cuenta de profesores): fermentación de 22 días y USD 6,50/kg sobre 100 kg, que coincide con la base. Esa entrega también es de hoy, el mismo caso límite. Latencia mostrada 3,2 s, o 4,1 s de extremo a extremo. Pendiente: que el profesor repita la pregunta en su demo.
- La respuesta errónea anterior (2,7 s) no cuenta como cumplimiento de latencia. Solo se cuentan las respuestas correctas: 3,2 a 10 s. No se garantiza menos de 3 s.
- Ejemplo de comprador del copiloto: usa el primer cliente REAL de la organización elegida; si no hay clientes, pide escribir el nombre. Se quitó el nombre fijo.
