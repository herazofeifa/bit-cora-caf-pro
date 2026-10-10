# Arquitectura de datos — Bitácora Café Pro

Estos dos diagramas adaptan los esquemas conceptuales del autor al esquema actual de la entrega. Son documentación de las relaciones principales, no una migración ni una propuesta para reconstruir la aplicación. Los archivos Mermaid conservan exactamente el contenido proporcionado por el autor:

- [Esquema de datos (ER)](arquitectura-datos.mmd).
- [Arquitectura por dominios](arquitectura-datos-dominios.mmd).

Referencias y límites de evidencia: [ESTADO_ENTREGA](ESTADO_ENTREGA.md). La revisión funcional anterior `9c7576b0d72858c9d3d6f185b01e22f92bb4fb07` se conserva; la rama `entrega-academica-2026-10-09`, commit `68da1fa`, es la referencia congelada de pruebas. `main` incorpora la actualización documental sin nuevas ejecuciones de pruebas. La memoria final local y sus capturas se elaboran fuera del repositorio. No se incluyen contraseñas ni valores de tokens.

## 1. Lectura del esquema ER

La figura agrupa identidad, catálogos, entrada de café, producción, comercialización, consulta autorizada y control. No enumera todas las columnas ni pretende sustituir las migraciones existentes.

### Identidad, membresías y configuración

- `organizations` delimita los espacios operativos. `memberships` vincula la identidad de un usuario con una organización y su rol en ella; las autorizaciones operativas proceden de esa membresía y se comprueban mediante RLS y funciones del servidor.
- `profiles` **no tiene `organization_id`**: representa la identidad del usuario, que puede participar en varias organizaciones mediante membresías. No debe interpretarse como un perfil independiente por espacio.
- `user_roles` es **global y heredado**; no sustituye los roles por organización de `memberships` ni habilita acceso transversal a datos operativos.
- Las relaciones `profiles`–`memberships`, `profiles`–`user_roles` y `profiles`–`audit_log` son **relaciones lógicas de identidad**, representadas con líneas punteadas (`..`), no claves foráneas hacia `profiles`. La relación de actor de auditoría también es lógica; el actor y la fecha se registran en el servidor.
- `org_settings` sustituye el concepto antiguo de `app_settings`: la configuración pertenece a una organización, no es un ajuste global compartido indiscriminadamente.
- Las tablas operativas pertenecen a una organización. La excepción representada es `lot_links`, que deriva su organización de los lotes enlazados, con controles de misma organización.

### Catálogos, cantidades y recibos

`farms` y `parcels` describen el origen; `units` las unidades y conversiones del espacio; `customers` los clientes; `variable_definitions` las variables registrables.

`harvest_tickets` conserva cantidad y unidad originales junto con la conversión a kg. **`uom_original` es texto**: se convierte por `symbol` dentro de la organización correspondiente, no es una FK a `units.id`. El servidor obtiene la conversión autorizada del catálogo de esa organización.

La relación entre recibos y lotes tiene dos sentidos diferentes:

- **`harvest_tickets.lot_id` agrupa recibos** asociados a un lote: varios recibos pueden contribuir al mismo lote.
- **`lots.harvest_ticket_id` conserva una referencia inicial opcional** a un recibo. No es el listado completo de aportes ni impone un recibo único por lote.

### Plantillas, ejecución y genealogía

Las definiciones de fases se almacenan como **JSON en `process_templates.phases`**, dentro de una plantilla versionada. La ejecución real se registra en **`process_phases`**, asociada al lote y con referencia opcional a la versión de plantilla. No existen `process_instances` ni tablas separadas de fases de plantilla en este esquema.

`lots` representa los lotes y `lot_links` los vínculos padre/hijo de su genealogía. El enlace deriva la organización de sus lotes y los controles de misma organización impiden unir registros de espacios distintos. `lots.parent_lot_id` conserva además una referencia de padre opcional; no reemplaza los múltiples vínculos de `lot_links`.

`variable_logs`, `moisture_logs`, `quality_samples` y `waste_logs` documentan mediciones, humedad, calidad y merma. Una medición puede tener contexto de fase además de pertenecer a un lote. La genealogía permite interpretar historia y calidad heredadas con su procedencia, sin atribuir toda una mezcla a un único origen.

### Comercialización, publicación y control

`stock_movements` registra movimientos de inventario; `reservations` relaciona lote y cliente para los compromisos comerciales. Las operaciones que alteran saldo o disponibilidad se realizan mediante funciones transaccionales con bloqueo del lote, no mediante cambios directos desde la interfaz.

`files` permite adjuntos de lote y contexto opcional de fase; `sacks` identifica sacos físicos; `lot_public_profiles` y `report_shares` habilitan publicación selectiva y copias autorizadas. El hosting público no hace públicas las tablas privadas: las consultas anónimas usan proyecciones restringidas por token, sin documentar sus valores.

`alerts` y `audit_log` registran alertas e historia; `operation_keys` controla reintentos idempotentes; `lot_sequences` mantiene secuencias por organización; `copilot_usage` controla el uso del copiloto. La auditoría es append-only y las claves de operación se vinculan a actor, operación y argumentos.

## 2. Lectura del diagrama de dominios

**Las flechas representan flujos funcionales; no todas son claves foráneas.** Cada caja agrupa responsabilidades y tablas, no una tabla adicional ni un servicio independiente.

| Flujo | Interpretación |
|---|---|
| Acceso → Catálogos | Membresía y RLS delimitan la organización y la configuración consultable. |
| Catálogos → Entrada | Origen y unidades autorizadas contextualizan cosechas y recibos. |
| Entrada → Producción | Un recibo crea o suma al lote, preservando la cantidad original y la conversión. |
| Catálogos → Producción | Plantillas versionadas y rangos orientan fases y mediciones reales. |
| Producción → Ventas | Calidad, liberación y saldo determinan disponibilidad; aprobar calidad no libera automáticamente café en proceso. |
| Producción → Publicación | Se comparte solo la información de lote, archivo, saco o historia autorizada. |
| Ventas → Control | Las operaciones comerciales dejan auditoría y usan controles transaccionales e idempotencia. |
| Publicación → Control | El acceso autorizado y los controles de uso forman parte del control transversal; la flecha no implica una FK ni que cada lectura pública consuma cuota del copiloto. |

El dominio de control es transversal: el **copiloto usa OpenAI directamente, con herramientas de solo lectura bajo la sesión RLS y la organización seleccionada**. No modifica inventario ni sustituye las operaciones comerciales. Las cuotas del copiloto y las restricciones de publicación tienen finalidades diferentes aunque aparezcan agrupadas en la misma figura.

## 3. Relación con la aplicación existente

Las lecturas operativas por organización se concentran en `src/lib/org-data.ts`, las operaciones en `src/lib/ops-cloud.ts` y el acceso compartido en `src/lib/cloud.ts`. Las reglas de integridad, membresía y aislamiento se aplican en la base de datos y el servidor; el selector de entorno no reemplaza estos controles. Los diagramas explican este esquema existente sin cambiar código, datos, permisos ni migraciones.
