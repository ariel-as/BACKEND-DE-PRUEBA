# API Planeta Fitness

API REST con Express 5, Prisma 6 y PostgreSQL 15+. Está organizada en rutas, controladores, servicios y repositorios; las rutas funcionan con los prefijos `/api` y `/api/v1` para mantener compatibilidad con el frontend.

## Preparación

1. Instala Node.js 20 o superior y PostgreSQL 15 o superior.
2. Crea la base `planeta_fitness` y un usuario de desarrollo `planeta_app` con permisos para migrar.
3. Copia `.env.example` a `.env` y configura `DATABASE_URL`, un `JWT_SECRET` aleatorio de al menos 48 bytes y los orígenes reales del frontend en `CORS_ORIGINS`.
4. Desde esta carpeta ejecuta `npm install`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` y `npm run dev`.
5. Abre `http://localhost:5050/salud` o `http://localhost:5050/api/v1/salud`.

Las cuentas locales del seed son `admin@planetafitness.ec` / `Admin12345` y `cliente@planetafitness.ec` / `Cliente12345`. Cámbialas mediante `SEED_ADMIN_PASSWORD` y `SEED_CLIENTE_PASSWORD` antes de cargar datos en un entorno compartido.

## Rutas principales

| Ruta | Acceso |
|---|---|
| `POST /auth/login`, `POST /auth/register` | Público |
| `GET /auth/me` | JWT |
| `GET /productos`, `GET /productos/:id` | Público |
| `POST /productos`, `PUT /productos/:id`, `DELETE /productos/:id` | JWT admin |
| `POST /pedidos`, `GET /pedidos/mis-pedidos`, `GET /pedidos/:id`, `PATCH /pedidos/:id/cancelar` | JWT |
| `GET /pedidos`, `PATCH /pedidos/:id/estado` | JWT admin |
| `GET /admin/resumen`, `GET /admin/productos`, `GET /admin/tablas...` | JWT admin; cambios de tablas y usuarios requieren ADM |
| `GET /categorias`, `GET /niveles`, `GET /metodos-pago`, `GET /membresias` | Público |

Envía el token con `Authorization: Bearer <token>`. Los errores usan `{ status, mensaje, correlationId, detalles? }`. El body de login que usa el frontend es `{ "correo": "...", "contrasena": "..." }`.

## API por entidad

Cada una de las 48 tablas tiene su propio recurso con ruta estática bajo `/admin/entidades/<tabla>`, por ejemplo `GET /api/v1/admin/entidades/cliente` o `GET /api/v1/admin/entidades/producto/meta`. Todas tienen consulta, metadatos y opciones; las tablas en modo `crud` también exponen `POST`, `PUT /:id` y `DELETE /:id`, restringidos a ADM. Las tablas de solo lectura conservan únicamente sus operaciones GET. Los nombres de ruta coinciden con los nombres de tabla documentados, incluidas las tablas con guion bajo. El recurso genérico `/admin/tablas/:tabla` se mantiene por compatibilidad con el panel actual.

## Seguridad

| Riesgo | Mitigación |
|---|---|
| A01 Pérdida de control de acceso | JWT obligatorio en rutas privadas, roles activos cargados desde la base en cada solicitud y lista permitida para el panel de tablas. |
| A02 Fallas criptográficas | Contraseñas con bcrypt, clave nunca devuelta por la API y JWT firmado con HS256. |
| A03 Inyección | Consultas parametrizadas de Prisma, filtros limitados a campos escalares conocidos y lista permitida para tablas. |
| A05 Configuración incorrecta | Helmet, CORS por orígenes configurados, límites de body y errores sin stack trace. |
| A07 Fallas de autenticación | Comparación bcrypt también para correos inexistentes, vencimiento JWT y límites por IP para autenticación. |

En producción usa un usuario de base separado para migraciones, sin permisos DDL para la cuenta de ejecución. HTTPS es opcional con `HTTPS=true` y certificados locales guardados en `certs/` (excluidos del repositorio).

## Desarrollo

`pruebas.http` contiene solicitudes de evidencia. Cada entidad Prisma está en su archivo dentro de `prisma/entities/`; `prisma/schema.prisma` conserva el generador y el datasource, y `package.json` indica a Prisma que lea la carpeta completa. Las relaciones entre modelos siguen funcionando aunque estén declarados en archivos distintos. El esquema declara las 48 tablas y los campos mapeados a PostgreSQL. Las migraciones incluidas crean el esquema inicial y aplican los CHECK e índice parcial de `prisma/sql/checks.sql`. Ejecuta `npm test` después de migrar y cargar el seed; las pruebas de integración necesitan acceso a PostgreSQL. No guardes `.env` ni certificados en Git.
