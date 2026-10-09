# Auditoría de Bitácora Café Pro

## Lo que no funciona (problemas reales)

1. **Los datos operativos se pierden al recargar.** Lotes, cosechas, recibos, humedades, mermas, reservas, calidad y auditoría viven solo en memoria. Solo los Ajustes (fincas, parcelas, unidades, rangos) se guardan. Al refrescar la página, todo vuelve a los datos de ejemplo.
2. **Los roles casi no se aplican.** Los permisos existen, pero solo se respetan en Reservas y Auditoría. Un usuario "Consulta" puede crear lotes, registrar mermas, cambiar ajustes o dividir lotes.
3. **El inicio de sesión es simulado.** No hay usuarios reales; cualquiera entra y el rol se elige en Ajustes.
4. **Varias pantallas siguen leyendo datos de ejemplo directamente** (Dashboard, Lotes, Detalle de lote, Inventario, Mermas, Control de proceso, Trazabilidad, Reportes, Ficha pública, diálogos de lote) para cosas como nombres de clientes o plantillas, en lugar de los datos vivos. Puede mostrar información desactualizada.
5. **La ficha pública (QR) no ve cambios reales**: al no haber datos compartidos, un tercero que escanea el QR no ve el lote del productor.

## Lo que falta implementar (marcado como "Próximamente")

- Exportar PDF, Exportar CSV y Compartir en Reportes.
- Botón "Confirmar peso" del Dashboard.
- Sección de ficha pública dentro del Detalle de lote (botón "Próximamente", aunque la ficha ya existe en otra pantalla).
- Adjuntar foto en registro de variables y en diálogos de lote.
- Asistente: solo "Registrar humedad" funciona dentro del asistente; las demás tareas redirigen a formularios normales.
- Sincronización sin conexión: solo es una idea visual, no guarda ni reenvía nada.

## Calidad del código (afecta mantenimiento)

- Archivos muy grandes: Reportes (51 KB), almacén de datos (47 KB), Detalle de lote (43 KB), Constructor de procesos (31 KB).
- Restos de código sin uso en Detalle de lote.
- No hay pruebas automáticas de las reglas críticas (inventario libre = actual − reservado − comprometido − bloqueado, sin sobreventa).

## Propuesta por fases

**Fase 1 — Arreglos rápidos (sin servidor)**
- Guardar todos los datos operativos en el navegador para que no se pierdan al recargar.
- Aplicar permisos en todos los botones de crear, editar, borrar, dividir/fusionar y en Ajustes.
- Reemplazar lecturas directas de datos de ejemplo por los datos vivos.
- Activar Exportar CSV real en Reportes, Inventario y Trazabilidad; activar "Confirmar peso"; enlazar la ficha pública desde el Detalle de lote.
- Agregar pruebas de reglas de inventario y reservas.

**Fase 2 — Producción real (con Lovable Cloud)**
- Usuarios reales con inicio de sesión y roles guardados de forma segura.
- Base de datos compartida para lotes, procesos, reservas, etc.
- Ficha pública por QR leyendo datos reales con privacidad respetada.
- Subida de fotos.
- Exportar PDF.

**Fase 3 — Mejoras**
- Completar el asistente para cosecha, recibo, variable y merma dentro del mismo flujo.
- Dividir los archivos grandes sin cambiar el comportamiento.
- Cola real sin conexión.

## Detalles técnicos
- Persistencia fase 1: extender `src/lib/store.ts` con el mismo patrón `persist()/loadPersisted()` de `app-config-store.ts` (clave versionada).
- Permisos: envolver acciones con `PermissionGate`/`useCan`; agregar permisos faltantes en `permissions.ts`.
- CSV: utilidad compartida en `src/lib/export-csv.ts`.
- Pruebas con vitest sobre funciones de inventario/reservas de `store.ts`.
- Fase 2 requiere activar Lovable Cloud, tabla `user_roles` separada y RLS.
