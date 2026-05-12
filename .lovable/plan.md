# Cerrar pendientes del sistema de ejecución de procesos

Cubre los 7 puntos detectados como faltantes del prompt anterior, manteniendo la arquitectura actual (store en `src/lib/store.ts`, tipos en `src/types/`, rutas TanStack en `src/routes/`).

## 1. Módulo `/variables` — Gestión de definiciones

Nueva ruta `src/routes/_app.variables.tsx`:
- Lista de variables agrupadas por categoría (calidad, proceso, ambiente, sensorial).
- Filtros: categoría, fase asociada, tipo de valor, requerida sí/no, default vs custom.
- Card por variable: nombre, unidad, tipo de valor, rango ideal, fases donde aplica, badge "Default" / "Personalizada".
- Acciones: crear, editar (solo custom), activar/desactivar.

Nueva ruta `src/routes/_app.variables.new.tsx` (también reutilizada para edición vía query param `?id=`):
- Form con: nombre, descripción, categoría, unidad, `value_type` (12 tipos), rango ideal min/max, fases asociadas (multi-select), requerida, opciones (para single/multi-select).
- Validación con zod.

Extensión del store: `createVariableDefinition`, `updateVariableDefinition`, `deactivateVariableDefinition`.

## 2. Flujo standalone "Registrar variable"

Nueva ruta `src/routes/_app.variables.log.tsx`:
- Paso 1: seleccionar lote (buscador con código/variedad).
- Paso 2: muestra fase activa del lote y la lista de variables — primero requeridas pendientes, luego opcionales.
- Paso 3: input dinámico según `value_type` (reusa lógica de `RegisterVariableDialog`).
- Guarda con timestamp + `lot_id` + `phase_instance_id` vía `logVariable` existente.
- Punto de entrada: botón "Registrar variable" en dashboard quick actions y en `/process-control`.

## 3. Charts por variable clave en detalle del lote

En `src/routes/_app.lots.$id.tsx` (tab "Variables"):
- Reemplazar el chart genérico por una grilla de mini-charts, uno por variable numérica clave: humedad, temperatura, pH, Brix, peso, merma acumulada.
- Cada chart: línea temporal + bandas sombreadas para rango ideal + marcadores de cambio de fase.
- "Merma acumulada" se calcula sumando `waste_logs` en orden cronológico.
- Si no hay datos para una variable → empty state pequeño "Sin lecturas aún" + botón "Registrar".

## 4. Tabla "Últimos valores" + histórico por variable

Sobre los charts, agregar una tabla compacta:
- Columnas: variable, último valor + unidad, timestamp, fase en que se midió, indicador dentro/fuera de rango.
- Click en fila expande historial completo de esa variable (tabla con todos los logs).

## 5. Validación de transición de fase según template

En `finishPhase` (store):
- Resolver template + versión usada por el lote (`lot.process_template_id` + `process_version`).
- Calcular siguiente fase en el orden definido.
- Validar que `final_physical_state` de la fase actual coincida con `initial_physical_state` de la siguiente; si no, bloquear con mensaje claro o permitir con justificación (mismo patrón override que ya existe).
- Al iniciar una nueva fase, validar también el orden: no permitir saltar fases marcadas como `is_required` sin override.

`FinishPhaseDialog` muestra "Siguiente fase: X" y los warnings de transición.

## 6. Generación automática de alertas de tiempo

Nuevo helper `evaluateTimeAlerts(phaseInstance, phaseDef)` en `src/lib/helpers.ts`:
- Compara `elapsedMinutes` contra `expected_minutes` y `max_minutes` del `ProcessPhaseDef`.
- Recorre `time_alerts` definidos en el template y genera registros en `alerts` cuando se cruza un umbral (sin duplicar: clave única `phase_instance_id + alert_threshold`).

Disparo: 
- Al cargar `/process-control` y `/lots/:id` evaluar alertas para fases activas (en `useEffect`).
- Al pausar/reanudar/finalizar, re-evaluar.

Severidad mapeada con `alertSeverity` helper existente. Las alertas aparecen en dashboard "Qué requiere atención hoy" y en el tab Alertas del lote.

## 7. Acción "Pausar / Reanudar fase" en `/lots/:id`

En el bloque de quick actions del detalle de lote:
- Si fase actual `running` → botón "Pausar fase" (abre dialog con motivo opcional).
- Si fase actual `paused` → botón "Reanudar fase".
- Reusa `pausePhase` / `resumePhase` del store.
- Mostrar estado actual de la fase (running/paused) con badge y, si paused, tiempo acumulado en pausa.

## Detalles técnicos

- **Tipos**: extender `Alert` con `phase_instance_id`, `threshold_key`. Sin cambios a `VariableDefinition` (ya tiene todos los campos).
- **Store**: nuevas acciones listadas arriba; mantener pattern actual (Zustand-like en memoria).
- **Routing**: 3 rutas nuevas — `_app.variables.tsx`, `_app.variables.new.tsx`, `_app.variables.log.tsx`. El plugin de Vite regenera `routeTree.gen.ts`.
- **UI**: reusar `StatusBadge`, `EmptyState`, `PageHeader`, `MetricCard`. Charts con `recharts` ya instalado.
- **Idioma**: español en toda la UI.
- **Mobile-first**: cards apilables, charts con `ResponsiveContainer`, tabla histórica con scroll horizontal en móvil.

## Orden de implementación

1. Extender tipos + store (variables CRUD, alertas de tiempo, validación de transición).
2. Rutas `/variables` y `/variables/new`.
3. Ruta `/variables/log` + botón en dashboard y process-control.
4. Charts por variable + tabla de últimos valores en detalle de lote.
5. Validación de transición en `FinishPhaseDialog`.
6. Generación automática de alertas de tiempo + integración en dashboard.
7. Pausar/Reanudar en detalle de lote.
