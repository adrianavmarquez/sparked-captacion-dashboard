# Estado de esta entrega

Comparación hecha antes de tocar código: el repositorio en `main` y el ZIP de la interfaz aprobada son el mismo fuente (sin contar `node_modules`). No había trabajo más nuevo que pisar. El ZIP de handoff es contexto de negocio. Su wireframe gris y la regla de pipeline solo lectura quedan atrás: Adri ya aprobó la interfaz actual, incluido arrastrar etapas dentro del dashboard.

## Implementado

- Reglas puras y tests: meta de 10 webs hasta el 7 feb 2027 (ET), sin CM; caja distinta del contratado y del anticipo esperado; el 50% no prueba el pago; montos o fechas ausentes quedan desconocidos; seguimientos 4/10/20 desde el día civil ET del primer envío, con DST; parada por respuesta o baja sin envío; Qualified = fit + interés confirmado; Closed no se trata como ganado; evidencia con URL, fecha y competidor, sin caída longitudinal inventada; cadenas, franquicias y web renovada con fecha.
- API con sesión, validación y 401 sin filas. La demo del API no lee la base de producción.
- Postgres descrito en una migración. Tests contra PGlite. Sin URL, la API dice que la base no está configurada.
- Adaptador GHL de solo lectura, con paginación y error si una página falla. El id candidato no se usa solo.
- Compuertas de escritura GHL y de envío de correo, apagadas en código.
- La UI aprobada sigue en el `MockAdapter`. Los cálculos de Ingresos, la meta y la capacidad web usan las reglas nuevas. `#/entrar` está fuera del menú.

## Configurado en este entorno

Nada. No hay `NETLIFY_DB_URL`, token de operadora, token de GHL ni ubicación. No se creó la base y no se desplegó.

## Verificado en vivo

Nada contra GHL, Gmail, Netlify Database ni el sitio de producción. Los tests cubren las reglas, el API y un Postgres embebido. La build de Vite typechequea la UI. No hay una sesión real ni un pipeline leído hoy.

## Decisiones que siguen siendo de Adri

1. Crear o no Netlify Database en el sitio actual. El costo del plan no se verificó aquí.
2. Elegir la clave de operadora y si Chiri tiene una clave distinta.
3. Aprobar, en otro momento, el envío de correo y cualquier escritura en GHL.
4. Confirmar en vivo el id del Marketing Pipeline y qué significan ganado y perdido en esa cuenta.
5. Decidir si algún `monetaryValue` de GHL puede llegar a ser monto contratado. Hoy se ignora.
6. Si quiere un campo en Ingresos para anotar la caja real. Hoy el botón guarda la fecha del hito y no inventa el monto. La caja real se puede registrar por el API.
