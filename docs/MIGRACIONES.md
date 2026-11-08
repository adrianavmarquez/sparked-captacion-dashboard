# Migraciones

Hay una migración: `netlify/database/migrations/20261108000000_review_state/migration.sql`.

Crea revisiones, valoraciones de fit, aprobaciones de borrador (sin columna de envío), hitos de pago, movimientos de etapa, evidencia, paradas de seguimiento y auditoría.

Los montos son enteros en centavos y aceptan `NULL`. No tienen `DEFAULT 0`. Un anticipo marcado como verificado sin monto y sin fecha no pasa el `CHECK`. `ghl_synced` tiene que ser `false`.

## Qué corre solo

Los tests aplican ese SQL sobre PGlite. No hace falta un Postgres instalado para `npm test`.

## Qué no corre solo

El proceso de la función no aplica migraciones. Si más adelante existe `NETLIFY_DB_URL`, el código asume que las tablas ya están. No se ejecuta `CREATE`, `ALTER` ni `DROP` contra una base de Netlify desde la app.

Cuando Adri apruebe Netlify Database, el deploy de Netlify es quien debe aplicar los archivos de `netlify/database/migrations/`. Hasta entonces el archivo es el contrato, no un cambio ya hecho en un servidor.

No edites una migración ya aplicada. El siguiente cambio es un archivo nuevo.

## Local, el día que haya base

Solo contra la base local de desarrollo, nunca contra la URL de producción copiada a una laptop:

```bash
netlify database migrations apply
```

Eso exige la CLI de Netlify y que Adri haya iniciado la base. Esta entrega no ejecuta ese comando.
