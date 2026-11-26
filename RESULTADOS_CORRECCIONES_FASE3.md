# Resultados de las correcciones — Fase 3

Rama: `correcciones-fase3` · Documento aplicado: `4_BACKEND_CORRECCIONES_FASE3.md` · API: `https://planeta-fitness-api.onrender.com/api/v1`.

## Resumen

| Sección | Cambio | Commit | Pruebas (base local) |
|---|---|---|---|
| 1 | Panel de planes con `PDI`, filtros `estado`/`web` y validación estricta | `007e230` | 135/135 |
| 2 | Pase diario sin cédula, con caja abierta y cliente `CONSUMIDOR_FINAL` por defecto | `cb5182e` | 136/136 |
| 3.1 y 3.2 | Caducidad en productos, alertas, listado ordenado y detalle administrativo | `d197e03` | 137/137 |
| 3.3 | Script `datos:caducidades` con modo de prueba y `--aplicar` | `0c312b9` | Suite en verde |
| 4 | Tabla `imagen`, CRUD de fotos y campo `fotos` en el DTO de productos | `89b2eaa` | 138/138 |
| 5 | `pruebas.http`, `README.md` y este informe | Incluido en esta entrega | Sin cambios de código |

Los cambios se hicieron en orden y se subieron a `main` con un push tras cada sección. No se cambiaron rutas existentes: solo se agregaron las rutas nuevas y los campos pedidos. No se guardaron contraseñas ni `DATABASE_URL` en archivos, commits ni en este informe.

## Sección 1: panel de planes

- `GET /admin/membresias` exige `planes:leer`; acepta `estado=A|I` y `web=S|N`, y rechaza cualquier otro parámetro con 400.
- `membershipDto` expone `precioConIva`, `publicarWeb` y `estado`; `adminMemberships` incluye el plan `PDI` del seed con `publicarWeb='N'`.
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

## Sección 3.3: datos de demostración

- Script: `server/scripts/demo-caducidades.js`; comando: `npm run datos:caducidades` y `npm run datos:caducidades -- --aplicar`.
- El script es idempotente: busca productos y lotes por identificadores de marcador, no borra productos y respeta `controlaCaducidad`.
- Se ejecutó primero sin `--aplicar` y después con `--aplicar` contra la base de Render usando `DATABASE_URL` solo en la terminal.
- Datos aplicados:

| Producto | Lote | Caducidad | Unidades |
|---|---|---|---|
| PF9001 | `DEMO-CAD-5` | 2026-11-30 | 10 |
| PF9001 | `DEMO-CAD-20` | 2026-12-15 | 8 |
| PF9002 | `DEMO-CAD-SC` | 2026-11-28 | 5 |

- Verificación posterior con `npm run datos:caducidades` contra Render: `PF9001: proximaCaducidad=2026-11-30, diasParaCaducar=5`. PF9002 mantiene `controlaCaducidad='N'`, por lo que el DTO no informa caducidad.

## Sección 4: tabla `imagen` y fotos

- Nuevo modelo `Imagen` mapeado a `imagen`, con columnas `img_numero`, `prd_codigo` e `img_foto_url` y llave foránea a `producto`.
- Migración `20261125000300_imagen`; se aplicó localmente con `npm run db:deploy` y se generó el cliente de Prisma con `npm run db:generate`.
- `productRepository` incluye `imagenes` ordenadas por id en los listados y detalles, y agrega `listFotos`, `findFoto`, `createFoto` y `deleteFoto`.
- Rutas nuevas, todas con validación estricta:

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/admin/productos/:id/fotos` | `inventario:leer` |
| POST | `/admin/productos/:id/fotos` | `inventario:gestionar` |
| DELETE | `/admin/fotos/:id` | `inventario:gestionar` |

- El DTO público y el administrativo devuelven `fotos` como arreglo de URL. La tabla `imagen` aparece en `/admin/tablas` dentro de `Inventario y compras`.
- Prueba nueva: `server/tests/correcciones-fase3-imagenes.test.js`. Cubre permisos, 404 de producto y foto, validación de `fotoUrl`, orden de fotos, DTO público/admin y panel genérico.
- Durante la prueba se corrigió el producto de prueba sin `stockMin` y se cambió el validador del ID de producto de entero a cadena no vacía.
- Se estabilizó `prioridad3.test.js` usando un sufijo aleatorio de 6 dígitos en lugar de los milisegundos, para evitar colisiones de cédula entre corridas de la suite.

## Sección 5: documentación

- `server/pruebas.http` incorpora la carpeta `CORRECCIONES FASE 3` con ejemplos de planes, pase diario, caducidades, fotos y panel de imágenes.
- `server/README.md` incorpora la tabla `Correcciones fase 3` y apunta a este informe.
- Este informe reúne commits, pruebas, datos aplicados y verificaciones.

## Verificaciones

| Comando o comprobación | Resultado |
|---|---|
| `npm test` final | 138 pruebas, 138 superadas, 0 fallos |
| `npm run db:generate` y `npm run db:deploy` en local | Cliente actualizado y migración `20261125000300_imagen` aplicada |
| `npm run datos:caducidades` antes de aplicar | Sin cambios; resumen de PF9001 y PF9002 |
| `npm run datos:caducidades -- --aplicar` en Render | Lotes de demostración creados/actualizados sin borrar productos |
| `GET https://planeta-fitness-api.onrender.com/api/v1/salud` tras cada push | `200 {"status":"ok","servicio":"Planeta Fitness API"}` |
| Rutas nuevas en Render | Pendiente: tras el último push el servicio todavía respondía 404 en detalle/fotos y 400 en `orden=caducidad`, es decir, seguía sirviendo la versión anterior |

## Decisiones

- No se eliminó ningún producto: borrar un producto dispara el CHECK `notificacion_ck_not_tipo_2` de la base. Las pruebas limpian fotos y lotes y desactivan el producto con `estado='I'` y `publicarWeb='N'`.
- `clienteId=null` en el pase diario crea `CONSUMIDOR FINAL`, no un cliente nuevo.
- PF9002 no informa caducidad en el DTO porque su `controlaCaducidad` es `N`, aunque el lote de demostración tenga fecha.
- El panel genérico trata `imagen` como grupo `Inventario y compras`; la tabla sigue siendo de solo lectura en el recurso genérico, pero las rutas específicas de fotos permiten la gestión con el permiso correspondiente.
- Git no tiene identidad configurada en la máquina; los commits usan `ariel-as` con el correo noreply de GitHub pasado en cada comando.
