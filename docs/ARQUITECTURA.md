# Arquitectura del backend

La demo publicada sigue siendo la aplicación Vite que Adri aprobó. El navegador no recibe tokens y no llama a GHL. El arranque normal no hace ninguna petición: solo `#/entrar`, fuera del menú, habla con el servidor después de que alguien pegue la clave.

## Por qué esta opción

El sitio ya está en Netlify con un build estático de Vite. Netlify Database es Postgres gestionado por la misma plataforma, sin cuenta de un tercero. Hace falta la aprobación de Adri para crearlo, porque esta entrega no despliega ni compra nada. Por eso el código de producción habla SQL de Postgres, y los tests lo ejecutan en PGlite, un Postgres embebido. Si `NETLIFY_DB_URL` no existe, las rutas dicen `persistence_not_configured`. No hay un modo silencioso que finja estar conectado.

No se añadió `@netlify/database`. Tener ese paquete haría que el próximo deploy creara la base sin un paso aparte.

Netlify Blobs no se usa: es para archivos, no para decisiones, borradores ni evidencia.

## Piezas

| Pieza | Dónde | Qué hace ahora |
|---|---|---|
| Reglas de negocio | `src/domain` | Meta, caja, seguimientos, frescura, evidencia, exclusiones. Las usa la UI y el servidor. |
| `DataAdapter` | `src/data/adapter.ts` | La UI sigue en `MockAdapter` con fixtures. Las decisiones pasan por `Persistence`. |
| `BackendPersistence` | `src/data/backend-persistence.ts` | Misma interfaz, contra `/api`, solo si este navegador ya entró. |
| API | `netlify/functions/api.ts` | Sesión, revisiones, fit, aprobaciones, hitos, etapas del dashboard, evidencia, seguimientos, ingreso, lectura GHL y preparación de correo. |
| Almacén | `server/store` | Memoria (tests y demo) o Postgres (solo con URL). |
| GHL | `server/ghl/readonly.ts` | GET únicamente. El id de pipeline sale de `GHL_PIPELINE_ID` y se confirma contra la respuesta. |
| Correo | `server/mail/port.ts` | Prepara un texto en memoria. `send` siempre responde 403. |

## Reinos

`production` y `demo` no comparten almacén. La demo del API solo responde si `SPARKED_ALLOW_DEMO_API=true`, y aun así usa memoria, nunca Postgres. La demo pública de la maqueta no usa ese encabezado: sigue en fixtures y en localStorage.

## Compuertas apagadas

- Escribir en GHL lanza `IntegrationDisabledError`. Una variable de entorno no lo enciende. Arrastrar una etapa guarda el cambio en el dashboard con `ghl_synced = false` (la tabla ni siquiera acepta `true`).
- Enviar correo o crear un borrador en Gmail lanza la misma compuerta. Aprobar un borrador solo guarda `approved_at`.
- Los seguimientos calculan fechas y pueden marcar respuesta o baja. No se envían.

## Acceso

`POST /api/session` compara la clave con `SPARKED_OPERATOR_TOKEN` y deja una cookie `HttpOnly`. El resto de `/api` exige esa cookie o `Authorization: Bearer`. Sin sesión, la respuesta es 401 y no incluye filas. Las mutaciones hechas con cookie exigen el encabezado `X-Sparked-Request: 1`.

La salud pública (`GET /api/health`) solo dice si el acceso, la base y las compuertas están configurados o apagados. No lista prospectos.
