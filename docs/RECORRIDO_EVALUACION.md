# Recorrido para profesores — Bitácora Café Pro

## Preparación (solo el autor)
1. Inicia sesión con tu cuenta de administrador de la organización original.
2. Ajustes → Usuarios y roles → tarjeta **Cuenta para profesores**.
3. Escribe el correo, el nombre y una contraseña (mín. 10) y pulsa **Crear cuenta y espacios**.
   Se crean, en una sola operación y una sola vez, dos organizaciones nuevas y la cuenta evaluadora.
   Repetirlo no duplica nada. La contraseña no se guarda en el repositorio ni en la documentación; compártela por un canal privado.
4. Si hace falta, la misma tarjeta permite **Cambiar contraseña**.

## Lo que ve el profesor
- Al iniciar sesión elige **Bitácora Café Pro en blanco** o **Bitácora Café Pro con datos de ejemplo**.
- Una franja permanente indica "Entorno de evaluación" y cuál está activo; el botón **Cambiar entorno** vuelve al selector.
  Cambiar no reinicia nada: cada espacio conserva lo que se hizo en él.
- Las pantallas con datos del servidor están en el menú **Operación (servidor)**.

## En blanco
Solo unidades (kg, cajuela 12,5 kg, fanega 250 kg) y plantillas Lavado, Honey, Natural y Anaeróbico.
Cero fincas, cosechas, lotes, movimientos, procesos, clientes, reservas y muestras. Sugerencia: crear finca/parcela en Ajustes,
registrar una cosecha en Operación → Cosecha, iniciar y cerrar fases, liberar y reservar.

## Con datos de ejemplo (ficticios, generados con las mismas operaciones de la app)
| Lote | Qué demuestra |
|---|---|
| Caturra lavado (500 kg = 40 cajuelas) | Ciclo completo despulpado→fermentación→lavado→secado, mermas automáticas por diferencia de peso, temperatura fuera de rango (alerta), calidad SCA 86 aprobada, liberación y división en dos lotes hijos |
| Caturra lavado · exportación (120 kg) | Reservas entregada (USD 6,80), confirmada (USD 7,10), activa (CRC 4200), cancelada y vencida; 2 sacos con QR; ficha pública con foto y certificado ficticios (el contrato queda privado); exportación declarada |
| Caturra lavado · local (90 kg) | Venta local en CRC y merma por manipulación |
| Geisha natural (300 kg + 8 cajuelas al mismo lote) | Dos ingresos a un lote existente, secado con humedad 18 % fuera de rango |
| Catuaí honey | Proceso terminado y bloqueado por calidad (SCA 78, defectos) |
| Geisha anaeróbico | Fermentación de 22 días: aparece como proceso atrasado |
| Blend Tarrazú-Dota (120 + 80 kg) | Mezcla de dos lotes, genealogía, calidad 82, reserva activa en CRC |

Reportes muestran precios promedio ponderados separados en USD y CRC. El copiloto responde con estos datos si la clave de OpenAI está configurada.

## Límites de la cuenta evaluadora
- Es administradora solo de esos dos espacios: no ve la organización original, sus datos ni su equipo.
- No puede crear cuentas, cambiar roles ni crear otros entornos demo.
