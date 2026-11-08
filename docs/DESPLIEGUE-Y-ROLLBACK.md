# Despliegue y vuelta atrás

Esta entrega no despliega, no hace merge y no crea un sitio nuevo. El flujo de Adri sigue siendo el que ya tiene: carpeta local de marcas, espejo en Drive y repositorio de GitHub. No se añadió otra sincronización.

## Qué se puede copiar

El ZIP portable trae fuente, tokens, README y docs. No trae `node_modules`, `.git`, `.env` ni `.netlify`. Se copia encima de la carpeta del dashboard en la máquina de Adri. Drive y GitHub siguen el método que ella ya usa.

## Si más adelante se publica esta rama

1. Revisar el pull request. No mezclarlo a `main` hasta que Adri lo quiera.
2. Un deploy de preview de Netlify construye `npm run build` y publica `dist/`. Las funciones de `/api` quedan vivas y, sin variables, responden que faltan acceso y base. La maqueta sigue en el navegador.
3. No añadir `@netlify/database` en ese mismo deploy si todavía no se quiere crear Postgres.
4. Las variables se cargan en la UI de Netlify del sitio existente `sparked-captacion`. No se pegan en el ZIP ni en un archivo del repo.
5. Recién con la base creada, el deploy aplica las migraciones de `netlify/database/migrations/`. Antes de eso no hay tablas que migrar.

## Vuelta atrás

- Si el deploy de la app se ve mal: en Netlify, publicar de nuevo el deploy anterior. La maqueta anterior no depende de esta base.
- Si una migración ya corrió en preview: el preview tiene su propia rama de datos. No se copia sola a producción. No se edita el SQL ya aplicado; se agrega otra migración.
- Si la cookie molesta en un navegador: `#/entrar` → Cerrar sesión, o borrar la cookie `sparked_session`. La demo local vuelve a localStorage.
- El código de escritura a GHL y de envío de correo no tiene un interruptor remoto. Volver atrás es revertir el commit, no cambiar una variable.

## Lo que este paquete no hace

No manda correos, no crea borradores en Gmail, no mueve etapas en GHL, no marca una venta como ganada, no aprovisiona Postgres y no guarda secretos.
