# Resultados de las correcciones — Auditoría Backend 1

Rama: `correcciones-backend1` · Merge en `main`: commit `8e5522a`.

| Hallazgo | Estado | Archivo(s) | Acción |
|---|---|---|---|
| B01 | Aplicado (parcial) | `server/routes/index.js:66`, `server/controllers/public.controller.js:7`, `server/models/public.repository.js:3`, `server/controllers/auth.controller.js:3`, `server/controllers/admin.controller.js:1`, `server/models/user.repository.js:3`, `server/models/admin.repository.js:3` | Categorías, métodos de pago y niveles pasan por controlador y repositorio público; el acceso Prisma de auth y admin queda en los repositorios de usuario y admin. `order.controller.js` queda para la fase 2. |
| B02 | Diferido a fase 2 | `server/controllers/order.controller.js` | No se aplica: la reposición de stock al cancelar lo resuelve el paso 1 de la fase 2. |
| B03 | Aplicado | `server/controllers/order.controller.js:8`, `server/tests/api.test.js:21` | Los ítems con claves distintas de `productoId`/`cantidad` se rechazan con 400 y mensaje `Los items contienen campos no permitidos.`; se agregó la prueba correspondiente. |
| B04 | Aplicado | `server/package-lock.json` | `npm audit fix` sin `--force`: 0 vulnerabilidades. |
| B05 | Diferido a fase 2 | `server/prisma/sql/checks.sql` | No se aplica: A1–A4 quedan para la fase 2. |
| B06 | Aplicado | `server/.env.example:19`, `server/README.md:9` | `FRONTEND_DIR=../frontend` documentado con comentario en el ejemplo y explicado en el README. |
| B07 | Aplicado | `server/tests/api.test.js:39`, `server/tests/api.test.js:40`, `server/tests/api.test.js:41` | Nuevas pruebas de `/auth/register`, `/membresias`, `/clases` y `/inscripciones` (201 y 409 por inscripción pendiente). |
| B08 | Aplicado | `server/controllers/admin.controller.js:6`, `server/factories/repository.factory.js:13`, `server/middleware/errors.js:13` | Se eliminaron las 3 variables sin uso marcadas por ESLint. |

## Verificaciones

| Comando | Resultado |
|---|---|
| `npm test` | 23/23 pruebas superadas, 0 fallos. |
| ESLint 10.15.0 (`--no-config-lookup --rule "no-unused-vars: error"`) | Sin errores ni advertencias. |
| `npm audit` | 0 vulnerabilidades. |

## Despliegue

`main` quedó en `8e5522a`, el CI #4 terminó correctamente y Render desplegó el cambio: `/api/v1/salud` responde `200` con `{"status":"ok","servicio":"Planeta Fitness API"}`. En producción se verificó además que un pedido con `precio` extra en `items` devuelve `400` con el mensaje de B03.
