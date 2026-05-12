# Plan: Bitácora Café Pro — App Shell

Construir la base visual y de navegación de una PWA mobile-first en español para productores de café y micro-beneficios. Sin lógica de negocio todavía: solo shell, diseño, navegación y pantallas vacías pulidas.

## 1. Sistema de diseño (warm earth + soft green)

Actualizar `src/styles.css` con tokens semánticos en `oklch`:

- `--background`: crema cálido (warm off-white)
- `--foreground`: marrón oscuro café
- `--primary`: verde suave (hojas de cafeto)
- `--secondary` / `--muted`: tonos tierra/beige
- `--accent`: ámbar cálido
- `--success`: verde sano
- `--warning`: ámbar (advertencias suaves)
- `--destructive`: rojo solo para riesgos reales
- `--card`, `--border`, `--ring` armonizados
- Radios redondeados (`--radius: 1rem`)
- Sombra cálida `--shadow-soft`
- Tipografía: display + body legibles (e.g. Fraunces / Inter via Google Fonts en `__root.tsx`)
- Versión `.dark` consistente

Componentes base reutilizables en `src/components/`:

- `StatusBadge` (verde / ámbar / rojo / neutral con etiquetas en español)
- `EmptyState` (icono Lucide, título, descripción, CTA)
- `PageHeader` (título grande, subtítulo, acción opcional)
- `SectionCard` (card redondeada con buen espaciado)
- `MetricCard` (para dashboard)

## 2. Estructura de navegación

### Layout raíz (`src/routes/_app.tsx` como layout o wrapping en cada ruta)

Crear un layout que envuelva todas las rutas autenticadas:

- Sidebar fija en desktop (`md:` y arriba)
- Bottom nav fija en mobile (`md:hidden`)
- FAB "+ Registrar" flotante en mobile y desktop, abre un Sheet con acciones rápidas
- `<Outlet />` para el contenido de la ruta

`/login` y `/onboarding` quedan FUERA del layout (pantallas full-screen).

### Sidebar desktop (`AppSidebar`)

Usa shadcn sidebar. Items con iconos Lucide:

- Inicio (`/dashboard`) — Home
- Cosecha (`/harvest`) — Sprout
- Recibos (`/intake`) — PackageOpen
- Lotes (`/lots`) — Boxes
- Procesos (`/processes`) — Workflow
- Control de proceso (`/process-control`) — Activity
- Inventario (`/inventory`) — Warehouse
- Clientes (`/customers`) — Users
- Reservas (`/reservations`) — BookmarkCheck
- Mermas (`/waste`) — Trash2
- Calidad (`/quality`) — Award
- Reportes (`/reports`) — BarChart3
- Trazabilidad (`/traceability`) — GitBranch
- Ajustes (`/settings`) — Settings

Encabezado: logo + nombre "Bitácora Café Pro".

### Bottom nav mobile (`MobileBottomNav`)

5 items grandes con icono + etiqueta corta:

- Inicio → `/dashboard`
- Cosecha → `/harvest`
- Lotes → `/lots`
- Inventario → `/inventory`
- Más → abre Sheet con el resto de rutas

Resaltar item activo usando `useRouterState`.

### FAB "+ Registrar" (`QuickActionFab`)

Botón circular grande, color primary, esquina inferior derecha (sobre el bottom nav en mobile). Al tocar abre `Sheet` (mobile) / `Dialog` (desktop) con lista grande de acciones, cada una como botón ancho con icono:

- Nueva cosecha
- Nuevo recibo
- Crear lote
- Registrar humedad
- Registrar variable
- Mover fase
- Registrar merma
- Reservar café
- Registrar salida

Por ahora cada acción cierra el sheet y muestra un toast "Próximamente" (sin lógica todavía).

## 3. Rutas y pantallas placeholder

Crear un archivo por ruta en `src/routes/` siguiendo el convenio plano de TanStack:

```
src/routes/
  __root.tsx (existente)
  index.tsx (redirige a /dashboard)
  login.tsx
  onboarding.tsx
  _app.tsx (layout con sidebar + bottom nav + FAB)
  _app.dashboard.tsx
  _app.harvest.tsx
  _app.intake.tsx
  _app.lots.tsx
  _app.processes.tsx
  _app.process-control.tsx
  _app.inventory.tsx
  _app.customers.tsx
  _app.reservations.tsx
  _app.waste.tsx
  _app.quality.tsx
  _app.reports.tsx
  _app.traceability.tsx
  _app.settings.tsx
```

Cada pantalla incluye:

- `head()` con título y descripción en español específicos
- `PageHeader` con título amigable y subtítulo
- `EmptyState` con mensaje cálido (ej: "Aún no hay cosechas registradas. Toca + Registrar para empezar.")
- En `dashboard`: grid de `MetricCard` placeholder (Cosecha activa, Lotes en proceso, Inventario disponible, Reservas) + `EmptyState` para gráfico (Recharts placeholder vacío)
- En `lots`, `inventory`, `customers`: cards mobile + tabla simple desktop (ambas vacías con empty state)
- En `quality`, `traceability`: layouts apropiados con empty state

### Login (`/login`)

Pantalla full-screen, mobile-first:

- Logo + nombre app
- Frase: "Tu bitácora digital de campo y beneficio"
- Inputs grandes (correo, contraseña)
- Botón grande "Entrar"
- Link "¿Olvidaste tu contraseña?"
- Sin lógica real (botón navega a `/onboarding` o `/dashboard`)

### Onboarding (`/onboarding`)

3 pasos con stepper visual:

1. Bienvenida (nombre de la finca)
2. Ubicación / variedad principal
3. Listo para empezar

Botones grandes "Siguiente" / "Atrás". Al terminar → `/dashboard`.

## 4. PWA-ready

- Añadir `<link rel="manifest">` en `__root.tsx` head
- Crear `public/manifest.webmanifest` con nombre, colores, iconos placeholder
- Meta theme-color cálido
- Viewport ya configurado

## 5. Consideraciones técnicas

- Todo el texto UI en español
- Iconos Lucide consistentes
- Sin colores hardcodeados — solo tokens
- Tipografía Google Fonts cargada vía `<link>` en `__root.tsx`
- Toasts con `sonner` (ya en shadcn)
- Sin Lovable Cloud todavía — la arquitectura queda lista para agregarlo después
- Sin lógica de datos: todas las pantallas usan empty states

## 6. Fuera de alcance (siguiente iteración)

- Lovable Cloud / autenticación real
- Modelos de datos y formularios funcionales
- Lógica de cosecha, lotes, fases, inventario
- Reportes con datos reales
- Trazabilidad funcional

## Resultado esperado

Una PWA mobile-first navegable, con identidad visual cálida y agrícola, sidebar desktop, bottom nav mobile, FAB de registro rápido, y 16 pantallas placeholder pulidas con empty states claros — lista para empezar a conectar lógica de negocio en la siguiente fase.
