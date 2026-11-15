# Importar el lote de prospectos

El archivo `data/imports/charlotte-2026-11-15.json` es el primer lote de Charlotte, observado el 15 nov 2026 (12:04–12:26 ET). Trae 50 empresas, 50 prospectos, 137 evidencias y 29 contactos. Nadie fue contactado. No hay borradores. La importación no crea ni modifica nada en GHL.

Los estados quedan así:

- `Listo para revisión`: sin decisión. La ficha sigue por revisar.
- `Revisión manual`: exclusión `manual_review`. No se descarta sola.
- `Descartado`: una revisión `discard` con la nota del lote, solo si ese prospecto todavía no tiene decisión. Una segunda corrida no la duplica ni pisa una decisión posterior de Adri.

Las URLs y las fechas de evidencia se guardan tal cual. Un monto que no viene en el archivo no se inventa.

## Después de desplegar esta rama

Hace falta el deploy que aplica la migración `20261115120000_prospect_catalog`. Sin esa tabla, la importación falla. No pegues la URL de la base en la laptop: el script habla con el API y usa la clave de operadora.

```bash
export SPARKED_OPERATOR_TOKEN='la clave que ya está en Netlify'
export SPARKED_API_BASE='https://sparked-captacion.netlify.app'
npm run import:prospects
```

Otra corrida con el mismo archivo actualiza las fichas y deja las decisiones existentes. La respuesta trae `inserted`, `updated` y `reviewsCreated`. `ghlWrites` es `disabled`.

La clave no se imprime. No la guardes en el ZIP ni en el repositorio.

## Comprobar

Con la sesión de `#/entrar`, Hoy, Prospectos, Ficha, Pipeline, Seguimientos, Borradores, Ingresos y Criterios leen la base y la lectura de GHL. Sin sesión, la demo pública sigue en los fixtures. Pipeline muestra las oportunidades `abandoned` o `lost` como Perdida y no las borra. `won` no cuenta como venta hasta que haya contrato firmado y el anticipo registrado con fecha.
