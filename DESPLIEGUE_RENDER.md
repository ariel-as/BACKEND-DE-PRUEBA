# Despliegue del backend en Render

Este documento explica cómo está desplegada la API de Planeta Fitness y cómo repetir el despliegue desde cero. El chat donde se hizo el despliegue original se perdió, así que lo reconstruí desde el repositorio:

- `render.yaml`;
- `.github/workflows/`;
- `server/package.json`, `server/.env.example` y `server/config/env.js`;
- `server/README.md` (secciones Render, CORS y Tarea diaria) y `BACKEND.md`;
- el historial de git (el commit `687c7bf`, "Add Render blueprint and database restore docs", del 19 de noviembre de 2026);
- lo que se comprobó contra la API publicada en las sesiones de la fase 2.

Lo que no se puede confirmar desde el repositorio está al final, en "Para revisar en el panel de Render".

## 1. Arquitectura

```
Navegador ──► GitHub Pages (frontend)  https://ariel-as.github.io
   │
   └──fetch + JWT──► Render Web Service "planeta-fitness-api"  https://planeta-fitness-api.onrender.com/api/v1
                         │  (Node 20, Express 5, Prisma 6)
                         └──DATABASE_URL (red interna de Render)──► Render PostgreSQL "planeta-fitness-db"
GitHub Actions ──► CI en cada push · tarea diaria (POST /api/v1/tareas/diarias con X-Tarea-Token)
```

- **Frontend:** está en otro repositorio y se publica en GitHub Pages, en el origen `https://ariel-as.github.io`. Llama a la API con `fetch` y manda el token en `Authorization: Bearer <token>` (sin cookies).
- **API:** es un Web Service de Render creado desde el blueprint `render.yaml`. Expone las mismas rutas bajo `/api/v1` y `/api`, más `/salud` en la raíz.
- **Base de datos:** es un PostgreSQL de Render. El servicio web recibe la cadena de conexión interna en `DATABASE_URL`, que el blueprint enlaza solo (`fromDatabase`). Desde fuera de Render se usa la *External Database URL*, y para usarla hay que permitir la IP (sección 8.1).
- **GitHub Actions:** CI valida el esquema, audita dependencias y corre las pruebas contra un PostgreSQL efímero. El workflow "Tarea diaria" llama a la API todos los días.

## 2. Requisitos

- Una cuenta de Render con acceso al repositorio de GitHub `ariel-as/BACKEND-DE-PRUEBA`.
- Rama `main` con `render.yaml` en la raíz.
- Para restaurar datos desde una máquina local: PostgreSQL instalado. El README usa `pg_dump` y `pg_restore` de `C:\Program Files\PostgreSQL\18\bin\`.

## 3. Base de datos en Render

Así la define `render.yaml`:

| Campo | Valor |
|---|---|
| Nombre del recurso | `planeta-fitness-db` |
| Plan | `free` |
| Nombre de la base | `planeta_fitness` |
| Usuario | `planeta_app` |
| Región | El bloque `databases` no la fija. El servicio web está en `oregon` y el host de la base que se usó es `*.oregon-postgres.render.com`, así que la base está en Oregon. Conviene que los dos estén en la misma región para usar la red interna |
| Versión de PostgreSQL | No se fija en `render.yaml` (Render usa su versión por defecto). La CI prueba con PostgreSQL 15 |

La base se crea junto con el servicio al aplicar el blueprint (sección 4). No hace falta crearla a mano.

### 3.1 Esquema: migraciones y CHECK

No se carga a mano. El servicio corre `npm run db:deploy` (`prisma migrate deploy`) como `preDeployCommand` antes de cada despliegue y aplica las migraciones de `server/prisma/migrations/`:

1. `20261116000000_init`: crea las 48 tablas.
2. `20261116000100_checks`: aplica los CHECK y el índice parcial de `server/prisma/sql/checks.sql`, por ejemplo un solo titular por inscripción.

Prisma lee el esquema de la carpeta completa `server/prisma/` (una entidad por archivo en `prisma/entities/`), como indica `"prisma": { "schema": "./prisma" }` en `package.json`.

### 3.2 Datos: restauración o seed

El blueprint deja el esquema migrado pero **vacío**. Hay dos formas de cargar datos:

**A. Restaurar una copia de la base local.** Es la forma documentada en el README y la que se usó: los datos de Render no son los del seed actual. Por ejemplo, en Render faltaba el cargo REC, que el seed de la fase 2 sí crea.

1. Permitir tu IP en la base (sección 8.1).
2. Generar el volcado local y restaurarlo en la *External Database URL*, que se pasa en la variable de entorno `RENDER_DATABASE_URL` para que no quede escrita en ningún archivo:

```powershell
# En server/, con el .env local
$line = Get-Content .env | Where-Object { $_ -like 'DATABASE_URL=*' } | Select-Object -First 1
$url = ($line.Substring($line.IndexOf('=') + 1).Trim() -split '\?')[0]
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" --format=custom --no-owner --no-privileges --file=planeta_fitness.dump $url

$render = $env:RENDER_DATABASE_URL
if ($render -notmatch 'sslmode=') { $render += if ($render -like '*?*') { '&sslmode=require' } else { '?sslmode=require' } }
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" --clean --if-exists --no-owner --no-privileges --dbname=$render planeta_fitness.dump
```

3. Quitar tu IP de la base al terminar.
4. No subir `planeta_fitness.dump` a Git.

**B. Cargar el seed** (`npm run db:seed`) contra la base de Render, desde tu máquina con la External Database URL. En producción el seed **se niega a correr** si las contraseñas de las cuentas de prueba tienen los valores por defecto: hay que definir antes `SEED_ADMIN_PASSWORD`, `SEED_CLIENTE_PASSWORD`, `SEED_RECEPCION_PASSWORD`, `SEED_ENTRENADOR_PASSWORD` y `SEED_CONTADORA_PASSWORD`. Ojo: el seed hace upsert de catálogos, planes y productos, así que sobre una base con datos los actualiza. El seed no corre solo en Render.

## 4. Servicio web con el blueprint

1. Haz push de `main` con `render.yaml` en la raíz.
2. En Render Dashboard: **New → Blueprint**, elige el repositorio y aplica. Se crean la base `planeta-fitness-db` y el servicio `planeta-fitness-api`.
3. Pon a mano las variables marcadas con `sync: false` (hoy solo `TAREAS_TOKEN`, sección 7.2).

Configuración del servicio según `render.yaml`:

| Campo | Valor |
|---|---|
| Tipo | `web`, runtime `node` |
| Nombre | `planeta-fitness-api` |
| Plan y región | `free`, `oregon` |
| Rama | `main` |
| Carpeta raíz | `server` (`rootDir`) |
| Build | `npm ci` |
| Antes de desplegar | `npm run db:deploy` (migraciones) |
| Start | `npm start` (`node server.js`) |
| Healthcheck | `/salud`, que responde 503 si la base no contesta |
| Versión de Node | `server/.nvmrc` = `20` |

Prisma Client se genera en la instalación: el paquete `@prisma/client` lo hace en su `postinstall`.

**Despliegue automático:** cada push a `main` dispara un nuevo despliegue (build, migraciones, arranque). Render no espera a que termine la CI de GitHub. Si una migración falla, el despliegue se detiene y queda la versión anterior.

**Verificación después de cada despliegue:**

```bash
curl -s https://planeta-fitness-api.onrender.com/api/v1/salud
# {"status":"ok","servicio":"Planeta Fitness API"}

curl -s -D - -o /dev/null -H "Origin: https://ariel-as.github.io" https://planeta-fitness-api.onrender.com/api/v1/salud
# debe incluir: access-control-allow-origin: https://ariel-as.github.io
```

Una ruta nueva protegida que responde **401** sin token también confirma que el código nuevo ya está publicado.

## 5. Variables de entorno

Los valores secretos nunca van en Git. `config/env.js` detiene el arranque si falta `DATABASE_URL` o `JWT_SECRET`, si `JWT_SECRET` tiene menos de 48 bytes o parece un texto de ejemplo, o si `CORS_ORIGINS` está vacía o contiene `*`.

| Variable | Para qué sirve | De dónde sale en Render |
|---|---|---|
| `NODE_ENV` | Modo de ejecución (`production`) | `render.yaml` |
| `PORT` | Puerto en el que escucha Express (`10000`) | `render.yaml` |
| `DATABASE_URL` | Conexión de Prisma a PostgreSQL | `render.yaml` con `fromDatabase` (cadena interna de `planeta-fitness-db`) |
| `JWT_SECRET` | Firma de los tokens JWT (mínimo 48 bytes, aleatorio) | `render.yaml` con `generateValue: true` (lo genera Render). Si cambia, todas las sesiones abiertas dejan de valer |
| `JWT_EXPIRES_IN` | Duración del token (por defecto `2h`) | No está en `render.yaml`: usa el valor por defecto |
| `CORS_ORIGINS` | Orígenes del frontend permitidos, separados por coma | `render.yaml`: `https://ariel-as.github.io` |
| `BCRYPT_ROUNDS` | Costo de bcrypt para las contraseñas (`12`) | `render.yaml` |
| `HTTPS` | Servidor HTTPS propio (`false`; Render ya pone TLS) | `render.yaml` |
| `TAREAS_TOKEN` | Token de la tarea diaria (cabecera `X-Tarea-Token`) | `render.yaml` con `sync: false`: se pone a mano en el panel (sección 7.2) |
| `JSON_LIMIT`, `PAGINATION_DEFAULT_LIMIT`, `PAGINATION_MAX_LIMIT`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX` | Límites del body, de la paginación y de solicitudes | No están en `render.yaml`: usan los valores por defecto de `config/env.js` (100kb, 10, 100, 15 min, 300, 10) |
| `FRONTEND_DIR` | Carpeta del build del frontend si Express lo sirve | No se usa en Render (el frontend está en GitHub Pages) |
| `HTTPS_KEY`, `HTTPS_CERT` | Certificados para HTTPS local | Solo en local |
| `SEED_ADMIN_PASSWORD`, `SEED_CLIENTE_PASSWORD`, `SEED_RECEPCION_PASSWORD`, `SEED_ENTRENADOR_PASSWORD`, `SEED_CONTADORA_PASSWORD` | Contraseñas de las cuentas que crea el seed | Solo en la máquina desde la que se corre el seed. No hacen falta en el servicio |
| `RENDER_DATABASE_URL` | External Database URL para restaurar o administrar la base desde fuera | Solo en tu terminal, mientras dura la operación. Nunca en archivos |

## 6. CORS con GitHub Pages

- El CORS vive en `server/middleware/cors.js`.
- Permite solo los orígenes de `CORS_ORIGINS`. En Render es `https://ariel-as.github.io`: es el origen de GitHub Pages, sin ruta, aunque el frontend esté en una subcarpeta.
- Un origen no permitido recibe **403** "Origen no permitido por CORS", también en el preflight `OPTIONS`.
- Las peticiones sin cabecera `Origin` (Postman, curl, GitHub Actions) pasan.
- Expone las cabeceras `Location`, `RateLimit`, `RateLimit-Policy` y `Retry-After`.
- El valor está en `render.yaml` para que una sincronización del blueprint no lo borre. Para agregar otro origen (por ejemplo un dominio propio), sepáralo con coma en `CORS_ORIGINS`, en el panel y en `render.yaml`.
- Si `CORS_ORIGINS` queda vacía, **el servidor no arranca** y la API publicada se cae. Revísala antes de cambiarla.

## 7. GitHub Actions

### 7.1 CI (`.github/workflows/ci.yml`)

Corre en cada push y en cada pull request a `main`, y también a mano. Tiene dos trabajos:

1. **Validación estática y auditoría:** `npm ci`, `prisma generate`, `prisma validate` y `npm audit --audit-level=high`.
2. **Integración:** levanta un PostgreSQL 15 efímero, aplica las migraciones y el seed, corre `npm test` y comprueba que `/salud` responde.

No usa secretos: todos los valores del workflow son credenciales de prueba.

### 7.2 Tarea diaria (`.github/workflows/tarea-diaria.yml`)

- Corre todos los días a las **10:00 UTC (05:00 de Ecuador)** y también a mano (Actions → Tarea diaria → Run workflow).
- Primero despierta el servicio con reintentos y después llama a `POST /api/v1/tareas/diarias` con la cabecera `X-Tarea-Token`. El resumen queda en la página de la ejecución.
- Qué hace la tarea: vence inscripciones, cambia el estado de las suspendidas, marca lotes caducados y crea avisos y alertas. Se puede correr varias veces el mismo día sin duplicar nada.

Lo que usa del repositorio:

| Nombre | Tipo | Valor |
|---|---|---|
| `TAREAS_TOKEN` | Secreto (Settings → Secrets and variables → Actions) | El mismo valor que `TAREAS_TOKEN` en Render |
| `API_URL` | Variable (opcional) | URL de la API. Si no existe, usa `https://planeta-fitness-api.onrender.com` |

Para activarla:

1. Genera un valor largo y aleatorio, por ejemplo con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
2. Ponlo en Render como `TAREAS_TOKEN` (servicio → Environment).
3. Pon el mismo valor como secreto `TAREAS_TOKEN` del repositorio.
4. Corre el workflow a mano para probarlo.

Sin la variable en Render, la API responde 503. Sin el secreto en GitHub, el workflow falla con un mensaje claro.

## 8. Operaciones comunes

### 8.1 Conectarse a la base desde afuera

1. En Render: base `planeta-fitness-db` → **Networking / Access Control**. Agrega tu IP pública (o un rango CIDR). Si la IP no está permitida, la conexión se corta con "SSL connection has been closed unexpectedly".
2. Copia la **External Database URL** desde la página de la base (Connections). Agrégale `?sslmode=require` si no lo trae.
3. Úsala solo en la variable de entorno de tu terminal (`RENDER_DATABASE_URL`). Nunca la pegues en archivos del repositorio ni en chats. Si se filtró, rota la contraseña de la base en Render.
4. Al terminar, **quita tu IP** de la lista.

### 8.2 Crear cuentas de personal

- **Desde la API (recomendado):** con una cuenta ADM, `POST /api/v1/admin/usuarios` crea la cuenta con sus roles y la vincula a un empleado, y `PUT /api/v1/admin/usuarios/:id/roles` cambia los roles. El empleado se registra antes por el panel genérico (`/admin/entidades/empleado`), y su cédula se valida.
- **Directo en la base (lo que se hizo el 22 de noviembre de 2026 para las cuentas REC, ENT y CON):**
  - Se usó un script temporal fuera del repositorio. Hace upsert de `usuario`, `usuario_rol` y `empleado`, con los mismos datos que `staffAccounts` en `server/prisma/seed.js`.
  - Se conectó con la External Database URL, después de permitir la IP.
  - Antes hubo que crear el cargo `REC` (Recepcionista), que faltaba en Render.
  - Las cuentas son `recepcion@`, `entrenador@` y `contadora@planetafitness.ec`, todas en `@planetafitness.ec`. Sus contraseñas son las del seed: conviene cambiarlas con `PUT /admin/usuarios/:id`.

### 8.3 Script de reparación de stock

Repara los pedidos antiguos que descontaron stock sin venta:

```bash
cd server
DATABASE_URL="$RENDER_DATABASE_URL" npm run reparar:pedidos              # modo de prueba: solo muestra lo que haría
DATABASE_URL="$RENDER_DATABASE_URL" npm run reparar:pedidos -- --aplicar # aplica en una transacción
```

- Corre siempre primero el modo de prueba y revisa el resultado.
- Contra la base de Render, aplícalo solo con autorización del equipo.
- El script solo necesita `DATABASE_URL` (no carga `config/env.js`). La que se pasa en la línea de comandos tiene prioridad sobre la del `.env` local.
- Al terminar, el script verifica que el stock de cada producto sea igual a la suma de sus lotes disponibles.
- Hasta hoy solo se corrió en modo de prueba sobre la base local (resultados en `RESULTADOS_BACKEND_FASE2.md`).

### 8.4 Poner o cambiar TAREAS_TOKEN

Render → servicio `planeta-fitness-api` → **Environment** → `TAREAS_TOKEN` → guardar. Render reinicia el servicio. Luego actualiza el secreto del mismo nombre en GitHub (sección 7.2).

### 8.5 Ver los logs

- Render → servicio → **Logs**: logs en vivo de la aplicación. La API escribe una línea JSON por petición, con método, ruta, estado, ms, `correlationId` y `usuarioId`.
- Render → servicio → **Events**: historial de despliegues, con la salida del build y de `prisma migrate deploy` en cada uno.
- Para rastrear un error que vio el frontend: toma el `correlationId` de la respuesta de error o de la cabecera `X-Correlation-Id` y búscalo en los logs.

## 9. Problemas conocidos

- **El servidor duerme:** en el plan gratuito, Render apaga el servicio tras unos 15 minutos sin tráfico.
- **La primera petición tarda:** despertarlo puede llevar cerca de un minuto. El frontend debe mostrar "cargando" y tolerar la demora, y el workflow de la tarea diaria ya reintenta.
- **503 mientras despierta:** mientras arranca, o si la base todavía no responde, `/salud` puede devolver 503 ("La base de datos no está disponible") o la conexión puede quedar en espera. Basta con reintentar.
- **La base gratuita vence:** el README indica que la base `free` expira a los 30 días de creada. Render avisa por correo antes y luego la borra si no se pasa a un plan pago. Para un despliegue permanente, el README propone cambiar `plan` en `render.yaml` (por ejemplo `0.5c-512mb` para el servicio y `0.1c-256mb` para la base) o restaurar una copia en una base nueva.
- **Datos distintos a los locales:** la base de Render viene de una restauración, no del seed actual. Un catálogo que el seed crea puede faltar en Render (pasó con el cargo REC).
- **Los planes gratuitos no garantizan disponibilidad:** sirven para pruebas y demostraciones.

## 10. Para revisar en el panel de Render

Nada de esto se puede confirmar desde el repositorio:

1. La fecha de creación y de vencimiento de la base `planeta-fitness-db` en el plan gratuito, y si ya se pasó a un plan pago.
2. La versión de PostgreSQL de la base y su región (lo esperado es Oregon).
3. Que el servicio se haya creado desde el blueprint y que **Auto-Deploy** esté activado para `main`.
4. El valor actual de `CORS_ORIGINS` en Environment (debe ser `https://ariel-as.github.io`; la API respondió con ese origen el 22 de noviembre de 2026).
5. Si `TAREAS_TOKEN` ya se puso en Render y como secreto en GitHub. El 22 de noviembre de 2026 la API respondía 503 en la tarea diaria, señal de que faltaba.
6. Las IPs permitidas en Networking / Access Control de la base: quitar las que se agregaron para operaciones puntuales.
7. Que `JWT_SECRET` sea el generado por Render y no se haya reemplazado por un valor débil.
8. Si hay variables en el panel que no están en `render.yaml` (por ejemplo `JWT_EXPIRES_IN` o límites de solicitudes) y con qué valores.
9. Cuándo y desde qué volcado se restauraron los datos (no hay registro en el repositorio, solo el procedimiento).
10. Si hay notificaciones por correo configuradas para fallos de despliegue.
11. Rotar la contraseña de la base: la External Database URL se compartió en un chat el 22 de noviembre de 2026.
