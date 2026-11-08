# Sparked Reactions · Dashboard de captación (demo front-end)

Demo **offline** del dashboard interno de captación comercial. Datos **ficticios**. La maqueta no envía nada y no llama a la red al abrirla. El servidor vive en `/api` y queda inactivo hasta que Adri cargue acceso y base; ver `docs/ACTIVACION.md`.

Construido el 7 nov 2026 (ET) a partir de `PROMPT-PARA-CLAUDE.md` y el paquete `sparked-frontend-handoff`.

## Dónde vive

- **Netlify (producción de la maqueta)**: https://sparked-captacion.netlify.app · proyecto `sparked-captacion` en el equipo @adrianavmarquez (https://app.netlify.com/projects/sparked-captacion). Build: `npm run build`, publica `dist/`, redirección SPA en `netlify.toml`. En Netlify las decisiones se guardan en el navegador de cada persona (localStorage) hasta que María conecte el backend.
- **Artifact en claude.ai**: misma app con guardado en la nube compartido (db del artifact). Se regenera con `npm run build:artifact`.
- **GitHub**: repositorio `adrianavmarquez/sparked-captacion-dashboard` (código fuente y capturas; sin `node_modules` ni `dist`).

## Requisitos

- Node.js 18 o superior (probado con Node 22).
- npm 9 o superior.

## Instalar, correr, construir

```bash
npm install        # instala dependencias (crea node_modules, no incluido en el ZIP)
npm run dev        # servidor local en http://localhost:5173
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

El build usa rutas relativas y un router por hash (`#/prospectos`), así que `dist/index.html` funciona abierto desde cualquier carpeta o subruta.

## Estructura

```
index.html                 entrada; carga ./fonts.css (fuentes de marca opcionales)
public/fonts.css           @font-face: usa los .woff2 si existen, si no, respaldo del sistema
public/fonts/README.md     qué archivo de fuente va en cada rol (no incluidos)
src/main.tsx               rutas
src/styles/tokens.css      tokens como variables CSS (espejo de tokens.json)
src/styles/global.css      sistema visual: layout, primitivas, tabla, estados, responsive
src/tokens/tokens.json     tokens con nivel: confirmado (paleta) / propuesto (derivados)
src/data/model.ts          tipos del modelo (espejo de modelo-datos.json)
src/data/fixtures.ts       datos ficticios; DEMO_NOW fija "hoy" en 7 nov 2026 15:00 ET
src/data/adapter.ts        interfaz DataAdapter + MockAdapter + reglas derivadas (frescura, estado de revisión)
src/data/strings.ts        todos los textos de la UI (español); duplicar para inglés
src/lib/store.tsx          proveedor del adaptador, selector de estado de demo, useQuery, toast
src/lib/format.ts          fechas en ET con zona visible
src/components/Shell.tsx   sidebar / nav móvil / banner de demo
src/components/ui.tsx      píldoras, estados vacío/error/cargando, Spark, Waves, Level
src/views/*.tsx            Hoy, Prospectos, Ficha, Pipeline, Seguimientos, Borradores, Criterios (+ Ingresos)
capturas/                  capturas 1440 y 360 de cada vista y estados
src/data/persistence.ts    interfaz Persistence + localStorage + db del artifact de claude.ai
src/domain/                reglas de caja, meta, seguimientos, evidencia (las usa la UI y el API)
server/                    acceso, almacén, lectura GHL y correo apagado
netlify/functions/api.ts   API. Inactiva sin variables de servidor
docs/                      activación, migraciones, despliegue y estado
src/assets/brand/logos.ts  logo e icono como data URI (PNG con transparencia, derivados del brand kit)
vite.artifact.config.ts    build de un solo archivo (npm run build:artifact) para publicar como artifact
.env.example               solo nombres de variables vacías (la demo no las usa)
```

## Dónde se guardan las decisiones de Adri

La UI escribe revisiones, fit y aprobaciones de borrador a través de `Persistence` (`src/data/persistence.ts`). Se elige sola al arrancar:

| Entorno | Implementación | Alcance |
|---|---|---|
| Artifact publicado en claude.ai | `ClaudeDbPersistence` (db del artifact: colecciones `reviews`, `fits`, `draft_approvals`, `payments`) | Compartido entre dispositivos y personas con acceso. Es lo que usa la demo publicada. |
| `npm run dev` / build local | `LocalStoragePersistence` | Solo ese navegador. Respaldo. |
| Producción | `BackendPersistence` **[PENDIENTE, María]** | Misma interfaz contra el backend real (GHL custom fields, una base pequeña, etc.). |

La etiqueta del banner y de los botones de guardar dice en todo momento dónde se está guardando. Los fixtures (prospectos, evidencia, borradores) siguen siendo ficticios y no se persisten: solo las decisiones.

## Cómo se conecta después (para María)

La UI solo llama a `DataAdapter` (`src/data/adapter.ts`). Métodos: `listProspects`, `getProspect`, `getAudit`, `saveReview`, `listDrafts`, `approveDraft`, `listFollowups`, `listOpportunities`, `getGoalProgress`, `getLocalities`, `getMeta`. Implementar la misma interfaz contra GHL/Gmail/enriquecimiento y sustituir `new MockAdapter(...)` en `src/lib/store.tsx`. Los nombres de campo siguen `modelo-datos.json` en camelCase (documentado en `model.ts`).

Reglas que viven en el front y conviene mantener en la fuente real:
- Frescura: `freshnessOf()` (≤30 días; revalidar >7 días). Norma operativa de María, no fijada por Adri.
- Seguimientos: `dueOn = sentAt del primer contacto + 4/10/20`. En la demo vienen precalculados en fixtures.
- Meta: `verifiedSales` cuenta una web solo con contrato firmado, oferta que no sea CM, monto contratado conocido y caja recibida con fecha dentro de la ventana. El 50% exigido no rellena la caja. CM no entra en las 10 webs.
- Capacidad web: proyectos web en Closed con anticipo realmente registrado y sin entregar. CM no se suma. Tope inicial 3, máximo 4.

## Qué incluye (checklist del brief)

- Fit y presupuesto: Adri elige fit (buen fit / parcial / no es fit), servicios que encajan (Diagnóstico, Core, Plus, CM) y señal de presupuesto, con nota, y lo guarda. Opciones [PROPUESTO].
- Logo oficial (icono + wordmark) en el menú lateral y la barra móvil; favicon con el icono. Preparados desde los PNG del brand kit con fondo transparente, sin redibujar.
- Vistas: Hoy, Prospectos (búsqueda, 5 filtros, paginación local de 8, tarjetas en móvil), Ficha + revisión, Pipeline (solo lectura, 3 columnas por 2 filas), Seguimientos, Borradores, Criterios, Ingresos.
- Ficha: tarjeta "María en marcha" con los 7 pasos que ejecuta tras la aprobación (hecho / en curso / pendiente, con nota y hora; los escribe María), "Por qué ahora" (hecho con fecha y fuente) y "Camino cálido" en el contacto. Datos demo; los alimenta María.
- Prospectos: pestañas por estado de revisión con conteo, filtro por fit y orden por fit.
- Borradores: botones "Abrir en Gmail" y "Marcar como enviado" visibles; hoy solo avisan que los conecta María (ya tiene acceso al correo).
- Criterios: conteo automático de razones de descarte a partir de las decisiones de Adri.
- Pipeline: arrastrar y soltar (mouse, o pulsación sostenida en táctil) para cambiar una oportunidad de etapa; con teclado, flechas izquierda/derecha; Enter abre la ficha. El movimiento se guarda (colección `stages`) con fecha y autor; la escritura hacia GHL es parte de la integración pendiente. Pedido por Adri el 7 nov 2026, amplía el "solo lectura" del brief original.
- Ingresos: la pantalla sigue siendo la de la maqueta. El cálculo ya no usa precio de lista ni trata un monto ausente como cero. Contratado, anticipo esperado y caja cobrada van aparte. Marcar un hito guarda la fecha en el dashboard; no copia el 50% como si el pago hubiera entrado. "Entregado" libera capacidad web (pedido por Adri, 7 nov 2026).
- Clic o Enter en una fila abre la ficha.
- Descartar (razón obligatoria), Maybe (fecha obligatoria) y Aprobar contacto: tres salidas distintas, solo en memoria.
- Borrador → Aprobado por Adri → Enviado. **Enviar** y **Conectar GHL** deshabilitados con etiqueta "Integración pendiente".
- Seguimientos 4/10/20 desde el envío efectivo, detenidos ante respuesta (caso M).
- Meta: estado vacío honesto "Aún no hay ventas verificadas" + 1 firmado con depósito en verificación (caso N).
- Estados: cargando, vacío, error, sin permiso (selector "Estado de demo" en el banner), sin resultados, sin evidencia (caso I), no verificado, revalidar/obsoleta (B, H, M, E), integración pendiente.
- Banner persistente. Fechas en ET con zona visible.
- Menú lateral fijo a toda la altura; solo se desplaza el contenido (el banner de demo queda pegado arriba del área de contenido).
- Responsive 360 a 1440 sin scroll horizontal de página. Accesibilidad: skip link, foco visible, roles/labels, `aria-current`, contraste AA verificado (ver `tokens.json`), `prefers-reduced-motion`.
- Sin datos reales ni llamadas de red desde el código (verificado con Playwright: 0 requests externos). El único almacenamiento son las decisiones de Adri, según la tabla anterior.

## Decisiones de diseño pendientes de aprobación de Adri

Todo lo que no es paleta es **propuesta**:

1. **Usos tipográficos**: Archia para titulares y cifras, Fira Sans para interfaz, Inconsolata para etiquetas, fechas e IDs. Neutral Face y Migra sin uso en la demo. Sin los archivos, la app muestra respaldos del sistema: las capturas no reflejan la tipografía final.
2. **Derivados de color** (`tokens.json → color.derived`): papel, tintas secundarias, líneas, azul profundo para enlaces/foco, error y éxito. Todos con contraste AA documentado.
3. **Lectura del brand board en UI**: sidebar Onyx pleno, tarjetas muy redondeadas (28 px), píldoras, estrella de cuatro puntas como acento, líneas onduladas de la paleta como fondo discreto (Hoy y sidebar). Nada de neón, glass ni animación decorativa.
4. **Microcopy**: todos los textos de `strings.ts` son propuesta (p. ej. "Nada sale sin ti. Guardado no es enviado."). Español neutro; variante pendiente.
5. **Navegación**: 7 secciones + Ingresos como pantalla vacía.
6. **Marcas verificado / no verificado** en contactos; razón obligatoria en Descartar; fecha obligatoria en Maybe.
7. **Capacidad web** mostrada como Closed con firma registrada (1 de 3).
9. **Ingresos**: cálculo del anticipo como 50% exacto del contratado y uso del precio de lista cuando la oportunidad no trae monto.
8. **Opciones de fit y presupuesto**: los tres niveles de fit y las cinco señales de presupuesto son propuesta; los servicios vienen del catálogo confirmado.

## Limitaciones conocidas

- Las decisiones de la demo siguen en el navegador o en el artifact. El servidor (`/api`, ver `docs/ACTIVACION.md`) guarda en Postgres solo cuando `NETLIFY_DB_URL` existe. Esta rama no aprovisiona la base ni conecta GHL: sin credenciales responde que no está configurado.
- El arranque de la demo no llama a la red. `#/entrar` existe fuera del menú para cuando Adri active el acceso.
- "Hoy" está fijado en 7 nov 2026 15:00 ET (`DEMO_NOW`) para que capturas y cálculos sean reproducibles.
- Los seguimientos de la demo vienen precalculados; la fórmula está documentada en `adapter.ts` para la integración.
- El estado "cargando" del selector de demo es permanente hasta cambiar el modo.
- No hay autenticación ni roles: "sin permiso" es un estado visual.
- Inglés: no hay archivo `en` todavía, solo la estructura para añadirlo.
- `npm test` cubre reglas, autorización, persistencia, GHL, fechas e ingresos. Las capturas de la maqueta se hicieron antes con Playwright.

## Fuentes

- Brief y paquete: `PROMPT-PARA-CLAUDE.md`, `modelo-datos.json`, `tokens-reference.json`, `anexo-comercial.md`, `fuentes-marca/` (7 nov 2026).
- Paleta: `09-marca-visual.md` y `colors.png`. Dirección: brand board reducido.
- Correo saliente: sección 5.10 del brief (6 nov 2026).
