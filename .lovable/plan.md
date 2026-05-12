## Problema detectado

Los enlaces ya navegan a `/lots/lot-1`, pero el contenido del detalle no aparece porque la ruta padre `/lots` no renderiza su ruta hija. En TanStack Router, cuando una ruta tiene hijos como `/lots/$id`, el componente padre debe incluir `<Outlet />`; actualmente la pantalla de lista de lotes no lo tiene, por eso al entrar a `/lots/lot-1` se queda mostrando la lista o no despliega el detalle.

## Plan de arreglo

1. **Corregir la ruta de lotes**
   - Importar `Outlet` en `src/routes/_app.lots.tsx`.
   - Detectar cuando la ruta actual corresponde a un detalle (`/lots/$id`).
   - Renderizar `<Outlet />` en ese caso para que se muestre la ficha completa del lote.
   - Mantener la lista normal cuando el usuario está en `/lots`.

2. **Revisar navegación interna**
   - Confirmar que las tarjetas de lotes usan `Link to="/lots/$id"` con `params`.
   - Confirmar que los botones “Ver lote” del inicio ya navegan al mismo patrón.

3. **Validar el resultado**
   - Probar que `/lots` muestra la lista.
   - Probar que al tocar cualquier lote abre `/lots/{id}` y muestra resumen, proceso, variables, inventario, reservas, calidad, mermas, historial, trazabilidad y QR.
   - Probar que el botón “Volver a lotes” regresa correctamente a la lista.