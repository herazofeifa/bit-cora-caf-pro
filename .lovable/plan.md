## Problema

El menú actual tiene 19 entradas planas, lo que satura tanto el sidebar de escritorio como el sheet "Más" en móvil. Muchas pantallas son de uso diario y otras son de configuración o consulta ocasional, pero hoy todas pesan lo mismo visualmente.

## Propuesta: agrupar el menú en 5 secciones

Mantener todas las pantallas existentes (no eliminar funcionalidad), pero organizarlas por flujo de trabajo del productor / micro-beneficio.

```text
INICIO
  • Inicio (dashboard)
  • Asistente

CAMPO Y RECIBOS
  • Cosecha
  • Recibos
  • Variables          (registro diario en planta)

LOTES Y PROCESO
  • Lotes
  • Procesos
  • Control de proceso
  • Calidad
  • Mermas

INVENTARIO Y VENTAS
  • Inventario
  • Café libre
  • Clientes
  • Reservas

GESTIÓN
  • Reportes
  • Trazabilidad
  • Alertas
  • Auditoría
  • Ajustes
```

Esto reduce la carga visual sin esconder nada: el usuario sigue viendo todas las opciones, pero agrupadas por intención.

## Cambios concretos

1. **`src/components/nav-items.ts`**
   - Reemplazar `navItems` plano por `navGroups: { label, items: NavItem[] }[]` con los 5 grupos arriba.
   - Mantener `bottomNavRoutes` igual (Inicio, Cosecha, Lotes, Inventario) para la barra inferior móvil.
   - Exportar también un `navItems` derivado (flatten) para que el sheet "Más" y cualquier consumidor existente no se rompa.

2. **`src/components/app-sidebar.tsx`** (escritorio)
   - Renderizar los grupos con un encabezado pequeño en mayúsculas (`text-[11px] uppercase tracking-[0.18em] text-muted-foreground`) coherente con la identidad editorial actual.
   - Separación sutil entre grupos (`mt-5` + divider opcional muy tenue).
   - Mantener el ítem activo resaltado igual que hoy.

3. **`src/components/mobile-bottom-nav.tsx`** (móvil → sheet "Más")
   - En el `SheetContent`, en lugar de un solo grid de 3 columnas con todos los ítems, renderizar cada grupo con su título y un grid de 3 columnas debajo.
   - Excluir del sheet los 4 ítems que ya están en la barra inferior (Inicio, Cosecha, Lotes, Inventario), igual que hoy.

4. **No tocar rutas ni archivos de pantallas.** Solo cambia la presentación del menú.

## Detalles técnicos

- `NavItem` se mantiene igual (`{ to, label, icon }`).
- Nueva forma:
  ```ts
  export interface NavGroup { label: string; items: NavItem[] }
  export const navGroups: NavGroup[] = [...]
  export const navItems: NavItem[] = navGroups.flatMap(g => g.items)
  ```
- El FAB (`quick-action-fab.tsx`) y otros consumidores de `navItems` siguen funcionando sin cambios porque el flatten preserva la API previa.

## Validación

- Sidebar de escritorio muestra 5 grupos con títulos y todas las opciones visibles.
- Sheet "Más" en móvil muestra los grupos (sin los 4 de la barra inferior).
- La barra inferior móvil sigue igual.
- Ninguna ruta deja de ser accesible.
- El ítem activo se resalta correctamente en el grupo correspondiente.