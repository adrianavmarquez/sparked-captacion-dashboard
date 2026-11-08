# Activación

Nada de esto está hecho en la cuenta de Netlify. Los nombres son los de las variables. No hay valores en el repositorio.

## 1. Dejar la demo como está

https://sparked-captacion.netlify.app sigue sirviendo la maqueta. No hace falta desplegar esta rama para que la demo se vea igual. Merging y un deploy de producción son decisiones aparte.

## 2. Acceso de Adri y Chiri

En el sitio de Netlify, variables de entorno del servidor (no `VITE_`):

| Nombre | Para qué | Estado |
|---|---|---|
| `SPARKED_OPERATOR_TOKEN` | Clave que se pega en `#/entrar`. No va al código del navegador. | Falta |
| `SPARKED_SESSION_SECRET` | Firma la cookie. 16 caracteres o más. | Falta |
| `SPARKED_OPERATOR_ACTOR` | `adri` o `chiri`. Si no está, cuenta como `adri`. Las revisiones las firma `adri`. | Opcional |
| `SPARKED_COOKIE_SECURE` | `false` solo en `http://localhost`. En Netlify se deja vacío. | Opcional |

Después del deploy, Adri abre `#/entrar`, pega la clave y el navegador guarda solo la cookie. La clave no se escribe en localStorage.

Hoy hay una sola clave. Si Chiri necesita otra, es una decisión de Adri: esta versión no inventa un segundo usuario.

## 3. Base durable

| Nombre | Para qué | Estado |
|---|---|---|
| `NETLIFY_DB_URL` | La pone Netlify al crear Netlify Database. No se copia al repo ni al front. | No creada |

Activarla crea Postgres en el sitio `sparked-captacion`. Puede tener costo según el plan. Esta rama no lo comprueba y no lo enciende. Sin la URL, `GET /api/state` responde `persistence_not_configured`.

El paquete `@netlify/database` no está instalado a propósito, para que un deploy de la maqueta no cree la base por su cuenta.

## 4. Lectura de GHL

| Nombre | Para qué | Estado |
|---|---|---|
| `GHL_API_TOKEN` | Token de ubicación, solo en el servidor. | Falta |
| `GHL_LOCATION_ID` | Ubicación de Sparked. | Falta |
| `GHL_PIPELINE_ID` | Pipeline a leer. Hay que pegar el id y la lectura en vivo tiene que encontrarlo. | Falta |
| `GHL_BASE_URL` | Opcional. Si falta, se usa `https://services.leadconnectorhq.com`. | Opcional |

El id visto el 7 nov 2026 (`QhvlUSfH1yBG6fL7f7Gx`, Marketing Pipeline) está en `server/ghl/candidate.ts` como candidato sin verificar. El adaptador no lo usa si la variable está vacía. Si el id configurado no aparece en la respuesta de GHL, el estado es `pipeline_not_verified` y no se listan oportunidades como si el mapa estuviera confirmado.

Etapas que se reconocen por nombre: New Lead, Contacted, Qualified, Proposal Sent, Negotiation, Closed. Un nombre como "Closed Won" queda sin mapear. `outcome` es siempre `unverified`: Closed no significa ganado. El `monetaryValue` de GHL se devuelve marcado como ignorado. No entra en contratado ni en caja.

La UI de la demo no cambia al adaptador de GHL. Sigue en fixtures hasta un cambio explícito posterior.

## 5. Correo

No hay variables de Gmail. Preparar un texto es `POST /api/mail/prepare`. Enviar es `POST /api/mail/send` y responde 403. No se crean borradores en el buzón. Hace falta otra aprobación de Adri, y otro cambio de código, para enviar.

## 6. Demo del API

`SPARKED_ALLOW_DEMO_API=true` permite el encabezado `X-Sparked-Realm: demo`. Ese reino es memoria de proceso y no toca Postgres. La maqueta pública no lo envía. En producción déjalo vacío.

## 7. Comprobar sin conectar servicios de pago

```bash
npm install
npm test
npm run typecheck
npm run build
```

`npm run dev` sigue abriendo la maqueta en http://localhost:5173. `/api` existe en ese servidor local y, sin las variables, responde que no está configurado.
