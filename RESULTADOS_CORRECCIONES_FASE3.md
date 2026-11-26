# Resultados de las correcciones — Fase 3

Rama: `correcciones-fase3` · Documento aplicado: `4_BACKEND_CORRECCIONES_FASE3.md` · API: `https://planeta-fitness-api.onrender.com/api/v1`.

## Resumen

| Sección | Cambio | Commit | Pruebas (base local) |
|---|---|---|---|
| 1 | Panel de planes con `PDI`, filtros `estado`/`web` y validación estricta | `007e230` | 135/135 |
| 2 | Pase diario sin cédula, con caja abierta y cliente `CONSUMIDOR_FINAL` por defecto | `cb5182e` | 136/136 |
| 3.1 y 3.2 | Caducidad en productos, alertas, listado ordenado y detalle administrativo | `d197e03` | 137/137 |
| 3.3 | Script `datos:caducidades` reescrito para productos reales | `0c312b9`, ajustado en esta entrega | 137/137 |
| 4 | **Descartada**: se retira la tabla `imagen`, las rutas de fotos, el campo `fotos` y su prueba | `89b2eaa`, revertido en esta entrega | Sin prueba de fotos |
| 5 | `pruebas.http`, `README.md` y este informe | `15d2766`, actualizado en esta entrega | Sin cambios de código |
| CI | Migración faltante de `rut_detalle` y limpieza de la sección 4 | Esta entrega | 137/137 en base vacía |

Los cambios se hicieron en orden y se suben a `main`. No se cambiaron rutas existentes: solo se agregaron las rutas pedidas en §1, §2 y §3. No se guardaron contraseñas ni `DATABASE_URL` en archivos, commits ni en este informe.

## CI de GitHub

- El CI fallaba desde `219e6eb` en `tests/fase3-rutinas.test.js` con 400: `rut_detalle` se había cambiado a `TEXT` directamente en la base, pero no existía la migración.
- Se agregó `server/prisma/migrations/20261125000200_rutina_detalle_text/migration.sql` con `ALTER TABLE "rutina" ALTER COLUMN "rut_detalle" TYPE TEXT;`.
- La migración se aplicó en la base local y es inocua en Render, donde la columna ya es `TEXT`.
- Antes del push se reprodujo el CI contra una base vacía: `db:generate`, `validate`, `audit` (0 vulnerabilidades), `db:deploy`, `db:seed` y `npm test`: 137 pruebas, 137 superadas, 0 fallos.

## Sección 1: panel de planes

- `GET /admin/membresias` exige `planes:leer`; acepta `estado=A|I` y `web=S|N`, y rechaza cualquier otro parámetro con 400.
- `membershipDto` expone `precioConIva`, `publicarWeb` y `estado`; `adminMemberships` incluye el plan `PDI` del seed actual con `publicarWeb='N'`.
- Prueba nueva: `server/tests/correcciones-fase3-planes.test.js`. Se ajustó `fase3-planes.test.js` para el panel.

## Sección 2: pase diario sin cédula

- `POST /admin/entradas/pase-diario` exige JWT, permiso `entradas:gestionar` y un empleado vigente.
- Cuerpo: `clienteId` opcional (10 dígitos o `null`), `metodoPago` (`EF` o `TR`) y `referencia` opcional; se rechazan campos extra.
- Sin `clienteId` se usa `9999999999` (`CONSUMIDOR_FINAL`); sin caja abierta devuelve 409; con el plan `PDI` inactivo también devuelve 409.
- La respuesta incluye `inscripcionId`, `entradaId`, `total`, `clienteId` y `cliente`. `registerEntry` reutiliza la misma transacción, así que un pase diario sigue rechazando clases.
- Correcciones durante la prueba: se definió `vigentToday`, se cambió el prefijo de cédula de prueba de `176` a `175` y se cerró la entrada antes de probar la regla de clases.
- Prueba nueva: `server/tests/correcciones-fase3-pase-diario.test.js`.

## Sección 3.1 y 3.2: caducidades

- `inventoryAlerts()` calcula `proximasCaducidades()` y `caducidadDe()`; `sinStockYMinimo` informa `proximaCaducidad` y `diasParaCaducar`.
- `adminDto` y el detalle administrativo informan los mismos campos; `GET /admin/productos` acepta `orden=caducidad` y valida sus filtros con `exactQuery`.
- Se agregó `GET /admin/productos/:id` con permiso `inventario:leer` y respuesta 404 cuando no existe.
- Prueba nueva: `server/tests/correcciones-fase3-caducidades.test.js`. Se ajustaron `fase3-stock.test.js`, `fase3-clases.test.js` y la aserción de días de `fase3-inventario.test.js` para usar `daysBetween(localToday(), dateStr(...))` y evitar diferencias de zona horaria.

## Sección 3.3: fechas de caducidad

- Script: `server/scripts/demo-caducidades.js`; comando: `npm run datos:caducidades` y `npm run datos:caducidades -- --aplicar`.
- El script ya no crea productos ni lotes: solo reasigna `fechaCaducidad` en lotes existentes con unidades disponibles.
- Selecciona productos reales con `controlaCaducidad='S'`, `stock > 0` y lotes con unidades; excluye los productos de demostración `PF9001` y `PF9002`.
- Asigna los cinco plazos pedidos en este orden: 3 días vencido, 5 días, 12 días, 25 días y 45 días. A partir del sexto lote usa plazos entre 120 y 360 días (4 a 12 meses), de forma determinista e idempotente.
- En modo prueba no escribe nada; en modo aplicación desactiva `PF9001` y `PF9002` con `estado='I'` y `publicarWeb='N'`.
- Se ejecutó en local y en Render: primero sin `--aplicar` y después con `--aplicar`.
- Resultado en Render:

| Producto | Lotes | Primera caducidad |
|---|---:|---|
| PF0001 Whey Protein | 2 | 2026-11-22 (3 días vencido) |
| PF0002 Whey Protein 2LB Chocolate | 2 | 2026-12-07 (12 días) |
| PF0003 Creatina | 2 | 2027-01-09 (45 días) |
| PF0004 Barra Proteica | 1 | 2027-04-24 (150 días) |

- Los cinco plazos especiales quedaron en las fechas 2026-11-22, 2026-11-30, 2026-12-07, 2026-12-20 y 2027-01-09. Los productos de demostración quedaron inactivos y sin publicación web.

## Sección 4: descartada

- Se descarta por completo la funcionalidad de fotos añadida en `89b2eaa`.
- Se eliminaron el modelo `imagen`, la migración `20261125000300_imagen`, la prueba `correcciones-fase3-imagenes.test.js`, las rutas `/admin/productos/:id/fotos` y `/admin/fotos/:id`, el campo `fotos` del DTO, la entrada `imagen` de `/admin/tablas` y sus ejemplos en `pruebas.http` y `README.md`.
- En la base local se eliminó la tabla `imagen` y su fila en `_prisma_migrations`; `prisma migrate status` quedó sin migraciones pendientes.
- Ninguna de estas rutas ni la tabla `imagen` deben considerarse parte de la entrega final.

## Sección 5: documentación

- `server/pruebas.http` conserva la carpeta `CORRECCIONES FASE 3` con ejemplos de planes, pase diario, caducidades y panel administrativo; se retiraron los ejemplos de fotos.
- `server/README.md` conserva la tabla `Correcciones fase 3`, apunta a este informe y ya no menciona fotos ni `imagen`.
- Este informe reúne commits, pruebas, datos aplicados y verificaciones.

## Verificaciones

| Comando o comprobación | Resultado |
|---|---|
| `npm test` en la base local de trabajo | 137 pruebas, 137 superadas, 0 fallos |
| CI local en base vacía | `db:generate`, `validate`, `audit` (0 vulnerabilidades), `db:deploy`, `db:seed`, `npm test`: 137/137 |
| Migración `20261125000200_rutina_detalle_text` | Aplicada en local; segura en Render porque la columna ya es `TEXT` |
| `npm run datos:caducidades` en Render | Sin cambios; 4 productos, 7 lotes, plazos y demostración informados |
| `npm run datos:caducidades -- --aplicar` en Render | Fechas aplicadas y `PF9001`/`PF9002` desactivados |
| CI de GitHub para `de4ec59` | `success` tras el push a `main` |
| `GET https://planeta-fitness-api.onrender.com/api/v1/salud` | `200 {"status":"ok","servicio":"Planeta Fitness API"}` |
| `GET /admin/membresias` en Render con token de administrador | `200`; 5 planes. La base actual de Render no fue re-sembrada y no incluye `PDI`; el seed actual sí lo crea. |
| `GET /admin/rutinas/plantillas` en Render con token de administrador | `200`; 3 plantillas. Ninguna ruta devuelve 404. |

## Decisiones

- No se eliminó ningún producto: borrar un producto dispara el CHECK `notificacion_ck_not_tipo_2` de la base. Las pruebas limpian lotes y desactivan productos temporales.
- `clienteId=null` en el pase diario crea `CONSUMIDOR FINAL`, no un cliente nuevo.
- La sección 4 se descarta aunque exista un commit anterior: su migración nunca se aplicó en Render y se retira del código y de la documentación.
- El panel genérico ya no incluye `imagen`; las rutas específicas de fotos tampoco existen.
- No se re-sembró la base de Render: solo se aplicaron las fechas de caducidad y la desactivación de los productos de demostración. Por eso el panel responde 200 pero no muestra `PDI` en los datos actuales de Render.
- Git no tiene identidad configurada en la máquina; los commits usan `ariel-as` con el correo noreply de GitHub pasado en cada comando.
