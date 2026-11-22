# BACKEND: instrucciones para el agente (Reto 2, Planeta Fitness)

Este documento le dice al agente qué construir en la carpeta `server/` y con qué reglas. No trae código: trae decisiones, estructura, el modelo de base de datos completo, los endpoints y los criterios para saber que cada parte quedó bien. El frontend se construye por separado, en otro proyecto y con su propio documento; este agente no lo tiene a la vista ni lo modifica. Lo único que comparten es el contrato de la API (sección 10) y los datos de prueba del seed (sección 6.8): el documento del frontend tiene una copia de ambos, así que rutas, nombres de campos, formas de respuesta, códigos e ids del seed no se cambian sin avisar al equipo.

## 0. Cómo trabajar con este documento

- Leer todo antes de empezar y seguir el orden de la sección 17. Cada paso tiene una forma de comprobarlo; no pasar al siguiente sin hacerlo.
- El modelo de datos de la sección 6 es la fuente de verdad. No inventar tablas, columnas, tipos ni relaciones. Si algo del modelo parece imposible de implementar, detenerse y preguntar.
- Las decisiones de la sección 2 ya están tomadas con el equipo. No cambiarlas por preferencia propia.
- Escribir comentarios y mensajes de error en español.
- No subir `.env` ni contraseñas reales al repositorio.

## 1. Contexto

Planeta Fitness es un gimnasio de Quito. El equipo ya tiene un frontend tipo ecommerce (HTML, CSS y JavaScript con módulos ES, MVC, carrito en localStorage, panel administrativo) que hoy lee archivos JSON. El Reto 2 pide convertirlo en una plataforma full stack: API REST con Node.js y Express, persistencia real con Prisma en una base relacional, JWT, roles, CORS, bcrypt, validación y sanitización.

Material de referencia que el equipo tiene en el proyecto:

| Archivo | Para qué sirve |
|---|---|
| `arquitectura_backend_node_express_postgresql.md` (guía de la semana 9, si está en esta ventana) | Arquitectura en N capas, MVC, Repository, Singleton, Factory, middleware, códigos HTTP, paginación y seguridad. Seguirla salvo donde este documento diga otra cosa |
| Proyecto de ejemplo `SEMANA 9.1` (si está en esta ventana) | Ejemplo de esa guía con PostgreSQL. Sirve de modelo para la separación en capas, el manejo de errores, la paginación, el cierre ordenado y las pruebas. Usa la librería `pg` con SQL escrito a mano, CommonJS y zod: aquí no se usa nada de eso (ver sección 2) |
| `Modelo_Gimnasio_PlanetaFitness_DEFINITIVO.xlsx` | Modelo de base de datos de 48 tablas. Está transcrito completo en la sección 6 |
| Enunciado del Reto 2 | Requisitos obligatorios. La sección 18 los repasa uno por uno |

## 2. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Motor | PostgreSQL 15 o superior. Si el ingeniero pide SQL Server, se cambia después |
| ORM | Prisma, versión 6.19.x tanto para `prisma` como para `@prisma/client`. No usar Prisma 7: cambia la forma de declarar la conexión y no coincide con el material de la clase 11 |
| Acceso a datos | Todo pasa por Prisma Client. Solo se permite SQL crudo con las funciones parametrizadas de Prisma (`$queryRaw` con plantilla) y únicamente para bloqueos de fila (`SELECT ... FOR UPDATE`) |
| Módulos | ES modules (`"type": "module"`), como el laboratorio de Prisma de la clase 11 y el frontend |
| Validación | express-validator (la que nombra el reto). No instalar zod ni joi |
| Carpetas | En plural, como pide el reto: `routes/`, `controllers/`, `models/`, `middleware/`, `prisma/`. Se agregan `config/`, `services/`, `factories/`, `validators/`, `utils/` y `tests/` como en la guía |
| Puerto | 5050 |
| Versionado | El mismo router se monta en `/api/v1` (guía) y en `/api` (el reto pide literalmente `/api/auth/login`, `/api/productos`, `/api/pedidos`) |
| Nombres en la base | Tablas y columnas con los nombres del modelo en minúsculas (`producto`, `prd_precio_venta`) |
| Nombres en el código y en la API | Modelos de Prisma en PascalCase con `@@map` a la tabla, y campos en camelCase con `@map` a la columna. Las reglas exactas están en 6.1 y cada columna tiene su nombre de API en el diccionario (6.3) |
| Normalización | Ninguna relación muchos a muchos se implementa directa. Cada una tiene su tabla intermedia propia (sección 6.5). Prohibido usar las relaciones muchos a muchos implícitas de Prisma, porque crean tablas ocultas como `_ProductoToProveedor` que no están en el modelo |
| Nombre de las intermedias | Regla del equipo: `tabla1_tabla2` (por ejemplo `producto_proveedor`). Excepción acordada: `pedido_detalle` y `detalle_venta` conservan su nombre, porque el reto pide la tabla PedidoDetalle. Si en el futuro aparece otra relación N:N, su intermedia sigue la regla |
| Triggers y procedimientos del modelo | El Excel describe algunas reglas como triggers o procedimientos (estaba pensado para Oracle). Aquí no se crean triggers: esas reglas se implementan en la capa `services/`, dentro de transacciones de Prisma |
| CHECK | Las restricciones CHECK de una misma fila sí van a la base, en una migración SQL aparte (6.6) |
| Stock | `producto.prd_stock`, `producto.prd_costo_promedio` y `lote_producto.lot_cantidad_disponible` solo cambian a través del servicio de inventario, que registra el movimiento en `kardex` |
| Imágenes de productos | No van en la base (el modelo eliminó PRD_Imagen y PRD_Destacado a propósito). Las maneja el frontend por código de producto |
| Citas de nutrición | No existen (el modelo descartó la tabla CITA). El nutricionista es un profesional aliado; el frontend muestra su contacto y las solicitudes llegan como `mensaje_contacto` |

## 3. Estructura de carpetas

```text
server/
├── server.js            Levanta HTTP (o HTTPS si está activado) en 5050 y cierra en orden
├── app.js               Arma Express sin escuchar puerto, para poder probarlo con supertest
├── package.json
├── .env                 No se sube
├── .env.example
├── .gitignore           node_modules, .env, certs
├── pruebas.http         Peticiones de evidencia para el README
├── config/
│   ├── env.js           Carga y valida variables de entorno
│   └── prisma.js        Única instancia de PrismaClient (Singleton)
├── routes/              Un archivo por recurso + index que los monta
├── controllers/         Un archivo por recurso
├── services/            Reglas de negocio y transacciones
├── models/              Repositorios: únicos que usan Prisma Client
├── factories/           Factory de repositorios para el panel de tablas
├── middleware/          CORS, JSON, sanitización, validación, JWT, roles, paginación, 404, errores, logger
├── validators/          Reglas de express-validator por recurso
├── utils/               ApiError, asyncHandler, logger, DTO, fechas
├── prisma/
│   ├── schema.prisma
│   ├── migrations/      Las genera Prisma (más la de CHECK)
│   ├── sql/checks.sql   Copia de referencia de los CHECK
│   └── seed.js
└── tests/               Pruebas con node:test y supertest
```

Responsabilidad de cada capa (igual que la guía): las rutas solo asocian método, URL, middleware y controlador; los controladores leen datos ya validados, llaman al servicio y eligen el código HTTP; los servicios aplican las reglas de negocio y abren transacciones; los repositorios son los únicos que conocen Prisma. Ningún controlador ni ruta usa Prisma directamente.

## 4. Dependencias y scripts

Dependencias: express (5.x), @prisma/client (6.19.x), bcrypt (si no compila en Windows, bcryptjs con la misma API), jsonwebtoken, cors, helmet, express-rate-limit, express-validator, dotenv.
Desarrollo: prisma (6.19.x), nodemon, supertest.

Scripts de `package.json`:

| Script | Hace |
|---|---|
| `start` | Arranca `server.js` |
| `dev` | Arranca con nodemon |
| `db:migrate` | `prisma migrate dev` |
| `db:generate` | `prisma generate` |
| `db:seed` | `prisma db seed` (el seed se declara en la sección `prisma` del package.json) |
| `db:studio` | `prisma studio` |
| `db:reset` | `prisma migrate reset` |
| `test` | `node --test` |

## 5. Variables de entorno

`.env.example` debe tener todas, con valores de ejemplo no sensibles. `config/env.js` detiene el arranque si falta `DATABASE_URL` o `JWT_SECRET`, y si `CORS_ORIGINS` contiene `*` fuera de desarrollo.

| Variable | Ejemplo | Uso |
|---|---|---|
| NODE_ENV | development | Entorno |
| PORT | 5050 | Puerto |
| DATABASE_URL | postgresql://planeta_app:clave@localhost:5432/planeta_fitness?schema=public | Conexión de Prisma |
| JWT_SECRET | (cadena aleatoria de 48 bytes o más) | Firma de tokens |
| JWT_EXPIRES_IN | 2h | Vigencia del token |
| CORS_ORIGINS | http://localhost:5500,http://127.0.0.1:5500 | Orígenes del frontend (Live Server). Para CORS, localhost y 127.0.0.1 son distintos |
| JSON_LIMIT | 100kb | Tamaño máximo del cuerpo |
| PAGINATION_DEFAULT_LIMIT | 10 | |
| PAGINATION_MAX_LIMIT | 100 | |
| RATE_LIMIT_WINDOW_MS | 900000 | Ventana del límite de solicitudes |
| RATE_LIMIT_MAX | 300 | Solicitudes por ventana |
| LOGIN_RATE_LIMIT_MAX | 10 | Intentos fallidos de login o registro por ventana |
| BCRYPT_ROUNDS | 12 | Costo de bcrypt |
| HTTPS, HTTPS_KEY, HTTPS_CERT | false, ./certs/... | HTTPS opcional |
| SEED_ADMIN_PASSWORD, SEED_CLIENTE_PASSWORD | Admin12345, Cliente12345 | Contraseñas de las cuentas de prueba del seed |

## 6. Base de datos

### 6.1 Reglas para pasar el modelo a PostgreSQL con Prisma

Tipos (el Excel usa tipos de Oracle; el diccionario de 6.3 ya muestra el tipo PostgreSQL):

| En el Excel | En PostgreSQL | En Prisma |
|---|---|---|
| VARCHAR2(n) | VARCHAR(n) | String con `@db.VarChar(n)` |
| CHAR(1) | CHAR(1) | String con `@db.Char(1)` |
| NUMBER(p,s) | NUMERIC(p,s) | Decimal con `@db.Decimal(p, s)` |
| NUMBER(p) | INTEGER | Int |
| DATE que solo guarda día (inicio, fin, nacimiento, caducidad, desde, hasta, ingreso, entrega y las marcadas "solo la fecha") | DATE | DateTime con `@db.Date` |
| DATE con fecha y hora (creación, registro, último acceso, anulación, cobro...) | TIMESTAMP | DateTime |
| DEFAULT SYSDATE | DEFAULT CURRENT_TIMESTAMP (o CURRENT_DATE si la columna es DATE) | `@default(now())` |

Nombres:

- Tabla: el nombre del modelo en minúsculas (`producto_ordencompra`). Modelo de Prisma en PascalCase con `@@map` (`ProductoOrdenCompra`).
- Columna: nombre del modelo en minúsculas (`prd_precio_venta`), con `@map`.
- Campo en Prisma y en la API:
  - Clave primaria simple y propia de la tabla: `id` (PRD_Codigo es `id`, PED_Numero es `id`).
  - Columna propia: sin el prefijo de tres letras y en camelCase (PRD_Precio_Venta es `precioVenta`).
  - Clave foránea hacia otra tabla: nombre de esa tabla en camelCase más `Id` (CAT_Codigo en PRODUCTO es `categoriaId`, USR_Codigo en PEDIDO es `usuarioId`).
  - Clave foránea que lleva el prefijo de la propia tabla: sin prefijo más `Id` (INS_Emp_Autoriza es `empAutorizaId`).
- Cuando hay dos o más relaciones entre las mismas tablas (por ejemplo EMPLEADO con INSCRIPCION tres veces), cada relación lleva su propio nombre con `@relation("...")`.

Claves:

- Las claves primarias numéricas propias (`... (autoincremental)` en el diccionario) son autoincrementales.
- Los códigos de texto (rol, cargo, turno, nivel, categoría, membresía, producto, servicio, método de pago...) los escribe quien registra. Si el admin crea un producto sin código, el servicio genera uno de máximo 13 caracteres.
- Las tablas intermedias tienen clave primaria compuesta (`@@id`), salvo `pedido_detalle`, que tiene clave propia y un UNIQUE compuesto.
- Las FK compuestas del modelo se respetan: `asistencia_cliente (ins_numero, cli_cedula)` apunta a `inscripcion_cliente`, `asistencia_cliente (cla_codigo, hor_codigo)` a `clase_horario` y `lote_producto (prd_codigo, orc_numero)` a `producto_ordencompra`.
- Todas las FK con borrado restringido (comportamiento por defecto de Prisma para relaciones obligatorias). Nada se borra en cascada: el historial se conserva.
- Los UNIQUE del diccionario (simples y compuestos) se declaran en el schema.

Al terminar, `npx prisma validate` debe pasar y `npx prisma migrate dev --name init` debe crear exactamente las 48 tablas de la lista de 6.2, sin tablas extra.

### 6.2 Las 48 tablas por módulo

| Módulo | Tablas |
|---|---|
| Gimnasio | gimnasio, horario_atencion |
| Seguridad | rol, usuario, usuario_rol |
| Personal | cargo, turno, empleado, asistencia_empleado |
| Clientes | nivel, cliente |
| Membresías | servicio, membresia, membresia_servicio, promocion, membresia_promocion, inscripcion, inscripcion_cliente, suspension |
| Clases y rutinas | clase, horario, clase_horario, asistencia_cliente, rutina |
| Aliados | profesional_aliado, comision_aliado |
| Inventario y compras | categoria, unidad_medida, producto, proveedor, producto_proveedor, orden_compra, producto_ordencompra, lote_producto, tipo_movimiento, kardex |
| Ventas | pedido, pedido_detalle, venta, detalle_venta, factura |
| Caja | metodo_pago, pago, cierre_caja, cuadre_turno, movimiento_caja |
| Comunicación | notificacion, mensaje_contacto |

### 6.3 Diccionario de datos completo

En la columna "Restricciones y reglas":

- Lo que es CHECK, UNIQUE o DEFAULT sobre la misma fila va a la base (schema o migración de CHECK).
- Lo que dice "Trigger", "Procedimiento" o "job" es una regla de negocio que va en `services/` (sección 11).
- Los nombres de columnas y tablas dentro de las reglas ya están en minúsculas, como quedan en PostgreSQL.

#### 1. `gimnasio` (modelo Prisma `Gimnasio`)

Tabla que contiene la información general del gimnasio (datos tributarios, aforo y parámetros de facturación). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `gim_ruc` | `id` | VARCHAR(13) | PK | NOT NULL |  | RUC del gimnasio |
| `gim_nombre` | `nombre` | VARCHAR(100) |  | NOT NULL |  | Nombre comercial del gimnasio (Planeta Fitness) |
| `gim_direccion` | `direccion` | VARCHAR(200) |  | NOT NULL |  | Dirección del gimnasio |
| `gim_telefono` | `telefono` | VARCHAR(10) |  | NULL |  | Teléfono del gimnasio, convencional o celular |
| `gim_correo` | `correo` | VARCHAR(120) |  | NULL |  | Correo electrónico del gimnasio |
| `gim_aforo_max` | `aforoMax` | INTEGER |  | NOT NULL | CHECK (> 0) | Capacidad máxima de personas al mismo tiempo (75) |
| `gim_propietaria` | `propietaria` | VARCHAR(100) |  | NOT NULL |  | Nombre de la dueña del gimnasio |
| `gim_porcentaje_iva` | `porcentajeIva` | NUMERIC(5,2) |  | NOT NULL | CHECK (BETWEEN 0 AND 100) | Porcentaje de IVA vigente que se aplica en la facturación (parametrizable) |
| `gim_establecimiento` | `establecimiento` | VARCHAR(3) |  | NOT NULL |  | Código de establecimiento asignado por el SRI (ej. 001) |
| `gim_punto_emision` | `puntoEmision` | VARCHAR(3) |  | NOT NULL |  | Código del punto de emisión asignado por el SRI (ej. 001) |

#### 2. `horario_atencion` (modelo Prisma `HorarioAtencion`)

Tabla que contiene los horarios de atención del gimnasio por día de la semana. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `hat_codigo` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Código del horario de atención |
| `gim_ruc` | `gimnasioId` | VARCHAR(13) | FK | NOT NULL |  | RUC del gimnasio al que pertenece el horario |
| `hat_dia` | `dia` | VARCHAR(30) |  | NOT NULL |  | Día o rango de días (Lunes a viernes, Sábado, Domingo) |
| `hat_hora_apertura` | `horaApertura` | VARCHAR(5) |  | NULL | CHECK (hat_hora_apertura ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$') | Hora de apertura (06:00) |
| `hat_hora_cierre` | `horaCierre` | VARCHAR(5) |  | NULL | CHECK (hat_hora_cierre ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$'); CHECK (hat_hora_cierre > hat_hora_apertura); ambas nulas si hat_abierto = 'N' | Hora de cierre (21:30) |
| `hat_abierto` | `abierto` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N'); CHECK ((hat_abierto = 'S' AND hat_hora_apertura IS NOT NULL AND hat_hora_cierre IS NOT NULL) OR (hat_abierto = 'N' AND hat_hora_apertura IS NULL AND hat_hora_cierre IS NULL)) | Indicador si ese día abre (S=Sí, N=No) |

#### 3. `rol` (modelo Prisma `Rol`)

Tabla que contiene los roles de acceso al sistema: administrativos (ADM, REC, ENT, CON) y usuario web (CLI). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `rol_codigo` | `id` | VARCHAR(4) | PK | NOT NULL |  | Código del rol (ADM=Administrador, REC=Recepcionista, ENT=Entrenador, CON=Contadora/Supervisora, CLI=Cliente web) |
| `rol_descripcion` | `descripcion` | VARCHAR(60) |  | NOT NULL | UNIQUE | Descripción del rol |
| `rol_tipo` | `tipo` | CHAR(1) |  | NOT NULL | CHECK IN ('A','U') | Grupo del rol (A=Administrativo 'admin', U=Usuario normal 'user') |
| `rol_permisos` | `permisos` | VARCHAR(300) |  | NULL |  | Detalle de los módulos a los que tiene acceso el rol |

#### 4. `usuario` (modelo Prisma `Usuario`)

Tabla que contiene las cuentas de acceso al sistema administrativo y a la página web. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `usr_codigo` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Código del usuario (id) |
| `usr_login` | `login` | VARCHAR(120) |  | NOT NULL | UNIQUE | Correo o nombre de usuario con el que ingresa (username/email) |
| `usr_clave_hash` | `claveHash` | VARCHAR(255) |  | NOT NULL | Solo hash (bcrypt/argon2), nunca texto plano | Hash seguro de la contraseña (passwordHash) |
| `usr_fecha_creacion` | `fechaCreacion` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha de creación de la cuenta |
| `usr_ultimo_acceso` | `ultimoAcceso` | TIMESTAMP |  | NULL |  | Fecha y hora del último ingreso |
| `usr_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','I'); DEFAULT 'A' | Estado del usuario (A=Activo, I=Inactivo) |

#### 5. `usuario_rol` (modelo Prisma `UsuarioRol`)

Tabla intersección que contiene los roles asignados a cada usuario (resuelve USUARIO N:N ROL). Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `usr_codigo` | `usuarioId` | INTEGER | PK/FK | NOT NULL |  | Código del usuario |
| `rol_codigo` | `rolId` | VARCHAR(4) | PK/FK | NOT NULL |  | Código del rol asignado |
| `url_fecha_asigna` | `fechaAsigna` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha en que se le asignó el rol |
| `url_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','I') | Estado de la asignación (A=Activo, I=Inactivo) |

Clave primaria compuesta: (usr_codigo, rol_codigo).

#### 6. `cargo` (modelo Prisma `Cargo`)

Tabla que contiene los cargos que desempeñan los empleados (administrador, contadora/supervisora, entrenador, diseñador, profe de bailoterapia). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `crg_codigo` | `id` | VARCHAR(3) | PK | NOT NULL |  | Código del cargo |
| `crg_descripcion` | `descripcion` | VARCHAR(100) |  | NOT NULL | UNIQUE | Descripción del cargo |
| `crg_sueldo_base` | `sueldoBase` | NUMERIC(10,2) |  | NULL | CHECK (>= 0) | Sueldo base referencial del cargo |

#### 7. `turno` (modelo Prisma `Turno`)

Tabla que contiene los turnos de trabajo (06:00-10:00, 10:00-14:00, 14:00-21:30). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `tur_codigo` | `id` | VARCHAR(3) | PK | NOT NULL |  | Código del turno |
| `tur_descripcion` | `descripcion` | VARCHAR(50) |  | NOT NULL | Ningún turno cruza la medianoche (06:00–10:00, 10:00–14:00, 14:00–21:30) | Descripción del turno (Mañana, Medio día, Tarde-noche) |
| `tur_hora_inicio` | `horaInicio` | VARCHAR(5) |  | NOT NULL | CHECK (tur_hora_inicio ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$') | Hora de inicio del turno |
| `tur_hora_fin` | `horaFin` | VARCHAR(5) |  | NOT NULL | CHECK (tur_hora_fin ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$'); CHECK (tur_hora_fin > tur_hora_inicio) | Hora de fin del turno |

#### 8. `empleado` (modelo Prisma `Empleado`)

Tabla que contiene los empleados del gimnasio (dueña, supervisora/contadora, administrador, entrenadores, diseñador, profes de bailoterapia). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `emp_cedula` | `id` | VARCHAR(10) | PK | NOT NULL |  | Cédula del empleado |
| `crg_codigo` | `cargoId` | VARCHAR(3) | FK | NOT NULL |  | Código del cargo del empleado |
| `tur_codigo` | `turnoId` | VARCHAR(3) | FK | NULL |  | Código del turno asignado (solo personal por turnos) |
| `usr_codigo` | `usuarioId` | INTEGER | FK | NULL | UNIQUE | Cuenta de usuario si tiene acceso al sistema (relación 1:0..1) |
| `emp_nombre` | `nombre` | VARCHAR(60) |  | NOT NULL |  | Nombres del empleado |
| `emp_apellido` | `apellido` | VARCHAR(60) |  | NOT NULL |  | Apellidos del empleado |
| `emp_telefono` | `telefono` | VARCHAR(10) |  | NULL |  | Teléfono celular del empleado |
| `emp_correo` | `correo` | VARCHAR(120) |  | NULL |  | Correo electrónico del empleado |
| `emp_especialidad` | `especialidad` | VARCHAR(60) |  | NULL |  | Especialidad del entrenador (Boxeo, Bailoterapia, Rutinas personalizadas) |
| `emp_fecha_ingreso` | `fechaIngreso` | DATE |  | NOT NULL |  | Fecha de ingreso al gimnasio |
| `emp_sueldo` | `sueldo` | NUMERIC(10,2) |  | NULL | CHECK (>= 0) | Sueldo del empleado |
| `emp_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','I') | Estado del empleado (A=Activo, I=Inactivo) |

#### 9. `asistencia_empleado` (modelo Prisma `AsistenciaEmpleado`)

Tabla que contiene el registro de entrada y salida (firma) de los empleados. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ase_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del registro de asistencia |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Cédula del empleado |
| `ase_fecha` | `fecha` | DATE |  | NOT NULL | tipo DATE (solo la fecha, sin hora); UNIQUE (emp_cedula, ase_fecha) | Fecha de la asistencia |
| `ase_hora_entrada` | `horaEntrada` | VARCHAR(5) |  | NOT NULL | CHECK (ase_hora_entrada ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$') | Hora de entrada |
| `ase_hora_salida` | `horaSalida` | VARCHAR(5) |  | NULL | CHECK (ase_hora_salida ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$'); CHECK (ase_hora_salida > ase_hora_entrada); nula hasta que firme la salida | Hora de salida |
| `ase_observacion` | `observacion` | VARCHAR(200) |  | NULL |  | Observación (atraso, permiso, reemplazo) |

#### 10. `nivel` (modelo Prisma `Nivel`)

Tabla que contiene los niveles de entrenamiento (Principiante, Intermedio, Avanzado). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `niv_codigo` | `id` | VARCHAR(3) | PK | NOT NULL |  | Código del nivel |
| `niv_descripcion` | `descripcion` | VARCHAR(50) |  | NOT NULL | UNIQUE | Descripción del nivel |

#### 11. `cliente` (modelo Prisma `Cliente`)

Tabla que contiene los clientes (socios) del gimnasio. Incluye un registro genérico 'CONSUMIDOR FINAL' (CLI_Cedula 9999999999, CLI_Ruc 9999999999999, identificación que acepta el SRI) para ventas y pases diarios sin datos; cada pase diario es una inscripción distinta, así que no se mezclan las visitas. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `cli_cedula` | `id` | VARCHAR(10) | PK | NOT NULL |  | Cédula de identidad del cliente |
| `niv_codigo` | `nivelId` | VARCHAR(3) | FK | NULL |  | Código del nivel de entrenamiento del cliente |
| `usr_codigo` | `usuarioId` | INTEGER | FK | NULL | UNIQUE | Cuenta web del cliente (relación 1:0..1); nula si no se registró en la web |
| `cli_nombre` | `nombre` | VARCHAR(60) |  | NOT NULL |  | Nombres del cliente |
| `cli_apellido` | `apellido` | VARCHAR(60) |  | NOT NULL |  | Apellidos del cliente |
| `cli_ruc` | `ruc` | VARCHAR(13) |  | NULL |  | RUC del cliente si pide factura con RUC |
| `cli_direccion` | `direccion` | VARCHAR(200) |  | NULL |  | Dirección del cliente para la factura |
| `cli_telefono` | `telefono` | VARCHAR(10) |  | NULL |  | Celular del cliente, usado para las notificaciones por WhatsApp |
| `cli_correo` | `correo` | VARCHAR(120) |  | NULL |  | Correo electrónico del cliente |
| `cli_sector` | `sector` | VARCHAR(100) |  | NULL |  | Sector o ubicación donde vive el cliente |
| `cli_fecha_nacimiento` | `fechaNacimiento` | DATE |  | NULL |  | Fecha de nacimiento del cliente |
| `cli_es_estudiante` | `esEstudiante` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N'); DEFAULT 'N' | Indicador si accede a plan estudiantil (S=Sí, N=No) |
| `cli_fecha_registro` | `fechaRegistro` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha en que se registró el cliente |
| `cli_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','I') | Estado del cliente (A=Activo, I=Inactivo). No se eliminan, quedan como historial |

#### 12. `servicio` (modelo Prisma `Servicio`)

Tabla que contiene los servicios internos del gimnasio (pesas, cardio, boxeo, bailoterapia, rutinas) y los que ofrecen de forma independiente los profesionales aliados (nutrición, fisioterapia). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `srv_codigo` | `id` | VARCHAR(4) | PK | NOT NULL |  | Código del servicio |
| `srv_nombre` | `nombre` | VARCHAR(60) |  | NOT NULL | UNIQUE | Nombre del servicio |
| `srv_descripcion` | `descripcion` | VARCHAR(200) |  | NULL |  | Descripción del servicio |
| `srv_tipo` | `tipo` | CHAR(1) |  | NOT NULL | CHECK IN ('I','A'). Trigger BEFORE UPDATE: no se cambia el tipo si el servicio ya está en membresia_servicio, clase o profesional_aliado | Tipo (I=Interno del gimnasio, A=Ofrecido por un profesional aliado; el gimnasio no gestiona sus citas) |
| `srv_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','S') | Estado del servicio (A=Activo, S=Suspendido) |

#### 13. `membresia` (modelo Prisma `Membresia`)

Tabla que contiene los planes que ofrece el gimnasio (diario, mensual, trimestral, semestral, anual, grupal, estudiantil). Hay planes por tiempo (T) y la tarjeta por ingresos (I: 30 ingresos, sin fecha de vencimiento). MEM_Precio ya incluye el precio especial del plan. El diario solo da acceso al área del gimnasio (pesas y cardio), no a las clases. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `mem_codigo` | `id` | VARCHAR(4) | PK | NOT NULL |  | Código de la membresía |
| `mem_nombre` | `nombre` | VARCHAR(60) |  | NOT NULL | UNIQUE | Nombre del plan |
| `mem_descripcion` | `descripcion` | VARCHAR(200) |  | NULL |  | Descripción del plan |
| `mem_tipo` | `tipo` | CHAR(1) |  | NOT NULL | CHECK IN ('T','I'); CHECK ((mem_tipo = 'T' AND mem_duracion IS NOT NULL AND mem_unidad_duracion IS NOT NULL AND mem_num_ingresos IS NULL) OR (mem_tipo = 'I' AND mem_duracion IS NULL AND mem_unidad_duracion IS NULL AND mem_num_ingresos IS NOT NULL)) | Tipo de control (T=Por tiempo: diario, mensual, anual; I=Por ingresos: tarjeta de 30 ingresos) |
| `mem_duracion` | `duracion` | INTEGER |  | NULL | CHECK (> 0); obligatorio si mem_tipo = 'T', nulo si mem_tipo = 'I' | Cantidad de la duración (1 día, 1 mes, 3 meses, 6 meses, 12 meses); nula en la tarjeta, que no vence |
| `mem_unidad_duracion` | `unidadDuracion` | CHAR(1) |  | NULL | CHECK IN ('D','M'); obligatorio si mem_tipo = 'T', nulo si mem_tipo = 'I' | Unidad de la duración (D=Días, M=Meses calendario). Fin: D → inicio + duración − 1; M → inicio + duración meses − 1 día |
| `mem_num_ingresos` | `numIngresos` | INTEGER |  | NULL | CHECK (> 0); obligatorio si mem_tipo = 'I', nulo si mem_tipo = 'T' | Número de ingresos que da la tarjeta (30) |
| `mem_num_personas` | `numPersonas` | INTEGER |  | NOT NULL | CHECK (>= 1); DEFAULT 1 | Máximo de personas que cubre el plan (1, 2, 3). Es un tope, no una obligación: el titular paga y los acompañantes se registran solo si vienen |
| `mem_precio` | `precio` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0) | Precio vigente del plan sin IVA (incluye el precio especial del plan, no las promociones) |
| `mem_paga_iva` | `pagaIva` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Indicador si la membresía grava IVA (S=Sí, N=No) |
| `mem_incluye_rutina` | `incluyeRutina` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Indicador si incluye rutina y guía (el diario no incluye) |
| `mem_es_estudiantil` | `esEstudiantil` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Indicador si es plan estudiantil |
| `mem_publicar_web` | `publicarWeb` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Decisión de gestión: si el plan se puede contratar por la web |
| `mem_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','I') | Estado del plan (A=Activo, I=Inactivo) |

#### 14. `membresia_servicio` (modelo Prisma `MembresiaServicio`)

Tabla intersección que contiene los servicios que incluye cada membresía (resuelve MEMBRESIA N:N SERVICIO). Controla el acceso a las clases: el plan diario solo tiene pesas y cardio; boxeo y bailoterapia están en los planes desde el mensual y en la tarjeta. Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `mem_codigo` | `membresiaId` | VARCHAR(4) | PK/FK | NOT NULL |  | Código de la membresía |
| `srv_codigo` | `servicioId` | VARCHAR(4) | PK/FK | NOT NULL | Trigger BEFORE INSERT/UPDATE: servicio.srv_tipo = 'I' (los servicios de aliados no se incluyen en planes) | Código del servicio incluido |
| `msv_observacion` | `observacion` | VARCHAR(150) |  | NULL |  | Observación sobre el beneficio |

Clave primaria compuesta: (mem_codigo, srv_codigo).

#### 15. `promocion` (modelo Prisma `Promocion`)

Tabla que contiene las campañas de descuento adicional (ej. Black Friday) sobre el precio del plan. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `prm_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la promoción |
| `prm_descripcion` | `descripcion` | VARCHAR(150) |  | NOT NULL |  | Descripción de la promoción |
| `prm_fecha_ini` | `fechaIni` | DATE |  | NOT NULL |  | Fecha de inicio de la promoción |
| `prm_fecha_fin` | `fechaFin` | DATE |  | NOT NULL | CHECK (prm_fecha_fin >= prm_fecha_ini) | Fecha de fin de la promoción |
| `prm_porcentaje` | `porcentaje` | NUMERIC(5,2) |  | NOT NULL | CHECK (> 0 AND <= 100) | Porcentaje de descuento |
| `prm_requiere_autoriz` | `requiereAutoriz` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Indicador si requiere autorización del administrador |

#### 16. `membresia_promocion` (modelo Prisma `MembresiaPromocion`)

Tabla intersección que contiene las membresías que entran en una promoción (resuelve MEMBRESIA N:N PROMOCION). Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `mem_codigo` | `membresiaId` | VARCHAR(4) | PK/FK | NOT NULL |  | Código de la membresía |
| `prm_numero` | `promocionId` | INTEGER | PK/FK | NOT NULL |  | Número de la promoción |

Clave primaria compuesta: (mem_codigo, prm_numero).

#### 17. `inscripcion` (modelo Prisma `Inscripcion`)

Tabla que contiene las inscripciones (contratación de una membresía) con fechas, valores históricos y estado. Controla quién está activo o vencido y, en la tarjeta, cuántos ingresos compró. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ins_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la inscripción |
| `mem_codigo` | `membresiaId` | VARCHAR(4) | FK | NOT NULL |  | Código de la membresía contratada |
| `prm_numero` | `promocionId` | INTEGER | FK | NULL | Trigger: debe existir en membresia_promocion para mem_codigo e ins_fecha_registro debe estar entre prm_fecha_ini y prm_fecha_fin | Promoción aplicada (nula si no hay) |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NULL | Nula si se contrató desde la web | Empleado que registra la inscripción |
| `ins_emp_autoriza` | `empAutorizaId` | VARCHAR(10) | FK | NULL | FK → empleado.emp_cedula. Trigger: obligatorio si la promoción tiene prm_requiere_autoriz = 'S'; el empleado debe estar activo (emp_estado = 'A') y tener una cuenta activa (usr_estado = 'A') con rol ADM activo en usuario_rol (url_estado = 'A') | Empleado (dueña o administrador) que autorizó la promoción |
| `ins_fecha_autoriza` | `fechaAutoriza` | TIMESTAMP |  | NULL | CHECK ((ins_emp_autoriza IS NULL AND ins_fecha_autoriza IS NULL) OR (ins_emp_autoriza IS NOT NULL AND ins_fecha_autoriza IS NOT NULL)) | Fecha en que se autorizó la promoción |
| `ins_fecha_registro` | `fechaRegistro` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha en que se registra la inscripción |
| `ins_fecha_inicio` | `fechaInicio` | DATE |  | NOT NULL |  | Fecha de inicio de la membresía |
| `ins_fecha_fin` | `fechaFin` | DATE |  | NULL | CHECK (ins_fecha_fin >= ins_fecha_inicio); CHECK ((ins_fecha_fin IS NOT NULL AND ins_ingresos_total IS NULL) OR (ins_fecha_fin IS NULL AND ins_ingresos_total IS NOT NULL)). Trigger: plan 'T' → se calcula con mem_duracion y mem_unidad_duracion; plan 'I' → nula | Fecha de fin en planes por tiempo (se extiende si hay suspensión médica); nula en la tarjeta, que no vence |
| `ins_ingresos_total` | `ingresosTotal` | INTEGER |  | NULL | CHECK (> 0). Trigger: plan 'I' → se copia de mem_num_ingresos; plan 'T' → nulo | Ingresos comprados con la tarjeta, copiado de MEM_Num_Ingresos (histórico); nulo en planes por tiempo. Las entradas usadas se cuentan en ASISTENCIA_CLIENTE |
| `ins_precio_base` | `precioBase` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0) | Precio sin IVA copiado de MEM_Precio al contratar (histórico) |
| `ins_descuento` | `descuento` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0 AND <= ins_precio_base); DEFAULT 0 | Valor descontado por la promoción (histórico) |
| `ins_valor` | `valor` | NUMERIC(10,2) |  | NOT NULL | CHECK (ins_valor = ins_precio_base - ins_descuento) | Valor final sin IVA (el IVA se calcula en FACTURA) |
| `ins_porcentaje_iva` | `porcentajeIva` | NUMERIC(5,2) |  | NOT NULL | CHECK (BETWEEN 0 AND 100) | Porcentaje de IVA al contratar (0 si el plan no grava), histórico. Total a cobrar = ROUND(INS_Valor × (1 + INS_Porcentaje_IVA/100), 2) |
| `ins_canal` | `canal` | CHAR(1) |  | NOT NULL | CHECK IN ('W','L') | Canal por el que se contrató (W=Web, L=Local) |
| `ins_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('P','A','V','S','X'). Pasa de 'P' a 'A' en la misma transacción del cobro, solo si Σ pag_monto de los pagos vigentes = total a cobrar y tiene titular. 'P' significa que todavía no se ha cobrado nada. Anulación (→ 'X'): mismo procedimiento que la venta para pagos, caja y factura | Estado (P=Pendiente de pago, A=Activa, V=Vencida o tarjeta agotada, S=Suspendida, X=Anulada) |
| `ins_emp_anula` | `empAnulaId` | VARCHAR(10) | FK | NULL | FK → empleado.emp_cedula. Trigger: el empleado debe estar activo (emp_estado = 'A') y tener una cuenta activa (usr_estado = 'A') con rol ADM activo en usuario_rol (url_estado = 'A') | Empleado que registró la anulación de la inscripción |
| `ins_fecha_anula` | `fechaAnula` | TIMESTAMP |  | NULL |  | Fecha y hora de la anulación de la inscripción |
| `ins_motivo_anula` | `motivoAnula` | VARCHAR(200) |  | NULL | CHECK ((ins_estado = 'X' AND ins_emp_anula IS NOT NULL AND ins_fecha_anula IS NOT NULL AND ins_motivo_anula IS NOT NULL) OR (ins_estado <> 'X' AND ins_emp_anula IS NULL AND ins_fecha_anula IS NULL AND ins_motivo_anula IS NULL)) | Motivo de la anulación de la inscripción |

#### 18. `inscripcion_cliente` (modelo Prisma `InscripcionCliente`)

Tabla intersección que contiene los clientes que cubre cada inscripción; permite los planes de 2 y 3 personas (resuelve INSCRIPCION N:N CLIENTE). Al comprar (incluso por la web) basta el titular; los acompañantes se agregan cuando lleguen, hasta MEM_Num_Personas. Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ins_numero` | `inscripcionId` | INTEGER | PK/FK | NOT NULL |  | Número de la inscripción |
| `cli_cedula` | `clienteId` | VARCHAR(10) | PK/FK | NOT NULL |  | Cédula del cliente beneficiario |
| `icl_es_titular` | `esTitular` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N'); índice único parcial UNIQUE (ins_numero) WHERE icl_es_titular = 'S': a lo sumo un titular. Trigger con SELECT … FOR UPDATE sobre inscripcion: filas por inscripción <= mem_num_personas; la inscripción no pasa a 'A' sin titular | Indicador si es el titular. En planes de 2 o 3 personas el pago completo se hace en un solo momento, sin importar quién pone el dinero |

Clave primaria compuesta: (ins_numero, cli_cedula).

#### 19. `suspension` (modelo Prisma `Suspension`)

Tabla que contiene las suspensiones de membresía por motivo médico (con certificado), que permiten recuperar días. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `sus_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la suspensión |
| `ins_numero` | `inscripcionId` | INTEGER | FK | NOT NULL |  | Número de la inscripción suspendida |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado que autoriza la suspensión |
| `sus_fecha_inicio` | `fechaInicio` | DATE |  | NOT NULL |  | Fecha de inicio de la suspensión |
| `sus_fecha_fin` | `fechaFin` | DATE |  | NOT NULL | CHECK (sus_fecha_fin >= sus_fecha_inicio). Trigger: solo planes por tiempo, sin solaparse con otra suspensión aplicada de la misma inscripción; al insertar suma sus_dias_recuperados a ins_fecha_fin. La suspensión no se edita ni se borra: para corregirla se anula (sus_estado 'A'→'X', lo que resta esos días de ins_fecha_fin) y se registra otra | Fecha de fin de la suspensión |
| `sus_dias_recuperados` | `diasRecuperados` | INTEGER |  | NOT NULL | CHECK (sus_dias_recuperados = sus_fecha_fin - sus_fecha_inicio + 1) | Número de días que se recuperan |
| `sus_motivo` | `motivo` | VARCHAR(200) |  | NOT NULL |  | Motivo de la suspensión |
| `sus_certificado` | `certificado` | VARCHAR(200) |  | NOT NULL |  | Ruta o número del certificado médico presentado |
| `sus_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','X'); DEFAULT 'A' | Estado (A=Aplicada, X=Anulada) |
| `sus_emp_anula` | `empAnulaId` | VARCHAR(10) | FK | NULL | FK → empleado.emp_cedula. Trigger: el empleado debe estar activo (emp_estado = 'A') y tener una cuenta activa (usr_estado = 'A') con rol ADM activo en usuario_rol (url_estado = 'A') | Empleado que registró la anulación de la suspensión |
| `sus_fecha_anula` | `fechaAnula` | TIMESTAMP |  | NULL |  | Fecha y hora de la anulación de la suspensión |
| `sus_motivo_anula` | `motivoAnula` | VARCHAR(200) |  | NULL | CHECK ((sus_estado = 'X' AND sus_emp_anula IS NOT NULL AND sus_fecha_anula IS NOT NULL AND sus_motivo_anula IS NOT NULL) OR (sus_estado <> 'X' AND sus_emp_anula IS NULL AND sus_fecha_anula IS NULL AND sus_motivo_anula IS NULL)) | Motivo de la anulación de la suspensión |

#### 20. `clase` (modelo Prisma `Clase`)

Tabla que contiene las clases grupales (bailoterapia, boxeo). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `cla_codigo` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Código de la clase |
| `srv_codigo` | `servicioId` | VARCHAR(4) | FK | NOT NULL | Trigger BEFORE INSERT/UPDATE: servicio.srv_tipo = 'I' | Servicio al que pertenece la clase |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Instructor de la clase |
| `cla_nombre` | `nombre` | VARCHAR(60) |  | NOT NULL | UNIQUE | Nombre de la clase |
| `cla_descripcion` | `descripcion` | VARCHAR(200) |  | NULL |  | Descripción de la clase |
| `cla_lugar` | `lugar` | VARCHAR(60) |  | NULL |  | Lugar donde se dicta (Segundo piso, Planta baja) |
| `cla_cupo_max` | `cupoMax` | INTEGER |  | NOT NULL | CHECK (> 0) | Cupo máximo de personas por clase |
| `cla_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','S') | Estado de la clase (A=Activa, S=Suspendida, ej. boxeo) |

#### 21. `horario` (modelo Prisma `Horario`)

Tabla que contiene los bloques de horario en que se dictan las clases (día, hora de inicio y hora de fin). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `hor_codigo` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Código del horario |
| `hor_dia` | `dia` | VARCHAR(10) |  | NOT NULL | UNIQUE (hor_dia, hor_hora_inicio, hor_hora_fin) | Día de la semana |
| `hor_hora_inicio` | `horaInicio` | VARCHAR(5) |  | NOT NULL | CHECK (hor_hora_inicio ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$') | Hora de inicio del bloque (07:00) |
| `hor_hora_fin` | `horaFin` | VARCHAR(5) |  | NOT NULL | CHECK (hor_hora_fin ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$'); CHECK (hor_hora_fin > hor_hora_inicio) | Hora de fin del bloque (09:00) |

#### 22. `clase_horario` (modelo Prisma `ClaseHorario`)

Tabla intersección que contiene los horarios en que se dicta cada clase (resuelve CLASE N:N HORARIO). Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `cla_codigo` | `claseId` | INTEGER | PK/FK | NOT NULL |  | Código de la clase |
| `hor_codigo` | `horarioId` | INTEGER | PK/FK | NOT NULL |  | Código del horario |
| `clh_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','S') | Estado del horario de la clase (A=Activo, S=Suspendido) |

Clave primaria compuesta: (cla_codigo, hor_codigo).

#### 23. `asistencia_cliente` (modelo Prisma `AsistenciaCliente`)

Tabla que contiene cada entrada física de un cliente al gimnasio: una fila por cada vez que entra (si sale y vuelve a entrar, es otra fila). La persona debe ser integrante de la inscripción que usa (FK compuesta a INSCRIPCION_CLIENTE). Sirve para el aforo, para registrar los diarios y para descontar las entradas de la tarjeta; si durante esa entrada asiste a una clase, se indica la clase. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `asc_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la entrada |
| `cli_cedula` | `clienteId` | VARCHAR(10) | FK | NOT NULL | FK compuesta (ins_numero, cli_cedula) → inscripcion_cliente: solo entra quien es integrante de esa inscripción | Cliente que entra |
| `ins_numero` | `inscripcionId` | INTEGER | FK | NOT NULL | Ver cli_cedula. Trigger: inscripción activa; la misma persona no puede tener otra entrada abierta con esa inscripción; si es tarjeta, entradas registradas < ins_ingresos_total (con SELECT … FOR UPDATE sobre inscripcion); personas adentro < gim_aforo_max (con SELECT … FOR UPDATE sobre la fila de gimnasio para serializar el último cupo) | Inscripción con la que entra (el diario y la tarjeta también son inscripciones) |
| `cla_codigo` | `claseId` | INTEGER | FK | NULL | FK compuesta (cla_codigo, hor_codigo) → clase_horario; CHECK ((cla_codigo IS NULL AND hor_codigo IS NULL) OR (cla_codigo IS NOT NULL AND hor_codigo IS NOT NULL)). Trigger (con SELECT … FOR UPDATE sobre la fila de clase_horario): el plan incluye el srv_codigo de la clase en membresia_servicio, la clase y el horario están activos, hor_dia coincide con asc_fecha y los asistentes de esa clase, horario y fecha < cla_cupo_max | Clase a la que ingresa (nulo si solo usa el gimnasio) |
| `hor_codigo` | `horarioId` | INTEGER | FK | NULL | Ver cla_codigo | Horario de la clase |
| `asc_fecha` | `fecha` | DATE |  | NOT NULL | tipo DATE (solo la fecha, sin hora) | Fecha de la entrada |
| `asc_hora_ingreso` | `horaIngreso` | VARCHAR(5) |  | NOT NULL | CHECK (asc_hora_ingreso ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$') | Hora en que entra |
| `asc_hora_salida` | `horaSalida` | VARCHAR(5) |  | NULL | CHECK (asc_hora_salida ~ '^([01][0-9]\|2[0-3]):[0-5][0-9]$'); CHECK (asc_hora_salida > asc_hora_ingreso); nula mientras está adentro; al volver a entrar se crea otra fila | Hora en que sale (nula mientras está adentro) |

#### 24. `rutina` (modelo Prisma `Rutina`)

Tabla que contiene las rutinas y guías que el entrenador elabora para los clientes con membresía mensual o superior. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `rut_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la rutina |
| `cli_cedula` | `clienteId` | VARCHAR(10) | FK | NOT NULL | Trigger: el cliente tiene una inscripción activa cuyo plan tiene mem_incluye_rutina = 'S' | Cliente al que se asigna la rutina |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Entrenador que elabora la rutina |
| `niv_codigo` | `nivelId` | VARCHAR(3) | FK | NOT NULL |  | Nivel de la rutina |
| `rut_objetivo` | `objetivo` | VARCHAR(100) |  | NOT NULL |  | Objetivo (bajar de peso, hipertrofia, resistencia) |
| `rut_detalle` | `detalle` | VARCHAR(1000) |  | NOT NULL |  | Detalle de ejercicios, series y repeticiones |
| `rut_fecha_inicio` | `fechaInicio` | DATE |  | NOT NULL |  | Fecha desde la que aplica la rutina |
| `rut_fecha_fin` | `fechaFin` | DATE |  | NULL | CHECK (rut_fecha_fin >= rut_fecha_inicio) | Fecha hasta la que aplica la rutina |

#### 25. `profesional_aliado` (modelo Prisma `ProfesionalAliado`)

Tabla que contiene los profesionales externos (nutricionista y fisioterapeuta) que atienden a sus pacientes dentro del gimnasio. No son empleados y el gimnasio no gestiona sus citas. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `pal_cedula` | `id` | VARCHAR(10) | PK | NOT NULL |  | Cédula del profesional aliado |
| `srv_codigo` | `servicioId` | VARCHAR(4) | FK | NOT NULL | Trigger BEFORE INSERT/UPDATE: servicio.srv_tipo = 'A' | Servicio que ofrece (Nutrición, Fisioterapia) |
| `pal_nombre` | `nombre` | VARCHAR(60) |  | NOT NULL |  | Nombres del profesional |
| `pal_apellido` | `apellido` | VARCHAR(60) |  | NOT NULL |  | Apellidos del profesional |
| `pal_telefono` | `telefono` | VARCHAR(10) |  | NOT NULL |  | Celular del profesional (los clientes agendan directamente con él/ella) |
| `pal_correo` | `correo` | VARCHAR(120) |  | NULL |  | Correo electrónico del profesional |
| `pal_registro_prof` | `registroProf` | VARCHAR(30) |  | NULL |  | Número de registro profesional (SENESCYT / MSP) |
| `pal_consultorio` | `consultorio` | VARCHAR(60) |  | NULL |  | Consultorio que ocupa dentro del gimnasio |
| `pal_valor_comision` | `valorComision` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0) | Valor fijo vigente que paga al gimnasio por periodo por trabajar dentro del gimnasio (no depende de cuántos clientes atienda) |
| `pal_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','I') | Estado del convenio (A=Activo, I=Inactivo) |

#### 26. `comision_aliado` (modelo Prisma `ComisionAliado`)

Tabla que contiene los pagos periódicos que cada profesional aliado hace al gimnasio por trabajar dentro de sus instalaciones. Es un valor fijo por periodo, no por cliente ni por cita; el gimnasio solo registra el ingreso. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `coa_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del cobro de comisión |
| `pal_cedula` | `profesionalAliadoId` | VARCHAR(10) | FK | NOT NULL |  | Profesional que paga la comisión |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado (supervisora) que cobra y registra el ingreso |
| `mpg_codigo` | `metodoPagoId` | VARCHAR(3) | FK | NOT NULL |  | Método con el que paga (efectivo, transferencia) |
| `coa_fecha_cobro` | `fechaCobro` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha del cobro |
| `coa_fecha_desde` | `fechaDesde` | DATE |  | NOT NULL | UNIQUE (pal_cedula, coa_fecha_desde). Trigger con SELECT … FOR UPDATE sobre profesional_aliado: el periodo no se solapa con otro del mismo aliado | Inicio del periodo que cubre el pago |
| `coa_fecha_hasta` | `fechaHasta` | DATE |  | NOT NULL | CHECK (coa_fecha_hasta >= coa_fecha_desde) | Fin del periodo que cubre el pago |
| `coa_monto` | `monto` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0) | Monto recibido; normalmente igual a PAL_Valor_Comision vigente, se guarda por historial si el valor cambia |
| `coa_referencia` | `referencia` | VARCHAR(30) |  | NULL | CHECK (mpg_codigo <> 'TR' OR TRIM(coa_referencia) IS NOT NULL) | Número de comprobante si paga por transferencia |

#### 27. `categoria` (modelo Prisma `Categoria`)

Tabla que contiene las categorías de productos (Bebidas, Snacks, Suplementos, Proteínas, Ropa, Accesorios). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `cat_codigo` | `id` | VARCHAR(4) | PK | NOT NULL |  | Código de la categoría |
| `cat_descripcion` | `descripcion` | VARCHAR(120) |  | NOT NULL | UNIQUE | Descripción de la categoría |

#### 28. `unidad_medida` (modelo Prisma `UnidadMedida`)

Tabla que contiene las unidades de medida de los productos (unidad, lata, botella, libra, gramo, mililitro). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `unm_codigo` | `id` | VARCHAR(6) | PK | NOT NULL |  | Código de la unidad de medida |
| `unm_descripcion` | `descripcion` | VARCHAR(100) |  | NOT NULL | UNIQUE | Descripción (Libra, Gramo, Botella) |
| `unm_abreviatura` | `abreviatura` | VARCHAR(10) |  | NOT NULL |  | Abreviatura (lb, g, ml, und) |

#### 29. `producto` (modelo Prisma `Producto`)

Tabla que contiene los productos que vende el gimnasio (agua, galletas, bebidas energéticas, suplementos, proteínas, accesorios y ropa deportiva). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `prd_codigo` | `id` | VARCHAR(13) | PK | NOT NULL |  | Código interno del producto (id) |
| `cat_codigo` | `categoriaId` | VARCHAR(4) | FK | NOT NULL |  | Categoría del producto |
| `unm_codigo` | `unidadMedidaId` | VARCHAR(6) | FK | NOT NULL |  | Unidad de medida del producto |
| `prd_nombre` | `nombre` | VARCHAR(100) |  | NOT NULL |  | Nombre del producto (nombre) |
| `prd_descripcion` | `descripcion` | VARCHAR(300) |  | NULL |  | Descripción del producto |
| `prd_contenido` | `contenido` | NUMERIC(8,2) |  | NULL | CHECK (> 0) | Contenido según la unidad de medida (ej. 2 para 2 lb) |
| `prd_talla` | `talla` | VARCHAR(4) |  | NULL |  | Talla si es ropa (S, M, L, XL) |
| `prd_precio_venta` | `precioVenta` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0) | Precio de venta vigente sin IVA (precio) |
| `prd_costo_promedio` | `costoPromedio` | NUMERIC(12,4) |  | NOT NULL | CHECK (>= 0); DEFAULT 0; lo actualiza el trigger del kardex | Costo promedio ponderado vigente del inventario |
| `prd_paga_iva` | `pagaIva` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Indicador si el producto grava IVA |
| `prd_stock` | `stock` | INTEGER |  | NOT NULL | CHECK (>= 0); DEFAULT 0; solo lo actualiza el trigger del kardex | Existencias actuales = suma de LOT_Cantidad_Disponible (stock) |
| `prd_stock_min` | `stockMin` | INTEGER |  | NOT NULL | CHECK (>= 0) | Stock mínimo antes de hacer un pedido |
| `prd_es_contable` | `esContable` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Indicador si se controla por unidades enteras en el kárdex. Los productos se venden por unidad; la proteína que se usa por scoop tiene 'N' y no entra al kárdex |
| `prd_controla_caducidad` | `controlaCaducidad` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N'); CHECK ((prd_controla_caducidad = 'S' AND prd_dias_alerta_cad IS NOT NULL AND prd_metodo_salida = 'E') OR (prd_controla_caducidad = 'N' AND prd_dias_alerta_cad IS NULL AND prd_metodo_salida = 'F')) | Indicador si el producto vence (S: alimentos, bebidas, suplementos; N: ropa y accesorios) |
| `prd_dias_alerta_cad` | `diasAlertaCad` | INTEGER |  | NULL | CHECK (> 0); ver prd_controla_caducidad | Días de anticipación para alertar que un lote está por vencer |
| `prd_metodo_salida` | `metodoSalida` | CHAR(1) |  | NOT NULL | CHECK IN ('E','F'); ver prd_controla_caducidad | Rotación física de lotes (E=FEFO, primero el que vence antes; F=FIFO, primero el más antiguo) |
| `prd_metodo_valora` | `metodoValora` | CHAR(1) |  | NOT NULL | CHECK IN ('P'); DEFAULT 'P' | Método de valoración del costo (P=Promedio ponderado) |
| `prd_publicar_web` | `publicarWeb` | CHAR(1) |  | NOT NULL | CHECK IN ('S','N') | Decisión de gestión: si el producto se puede vender por la web (lo exige PEDIDO_DETALLE) |
| `prd_fecha_creacion` | `fechaCreacion` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha de creación del producto (createdAt) |
| `prd_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('A','P','I') | Estado (A=A la venta, P=Pendiente de autorización de la dueña, I=Inactivo) |

#### 30. `proveedor` (modelo Prisma `Proveedor`)

Tabla que contiene los proveedores de productos del gimnasio. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `prv_ci_ruc` | `id` | VARCHAR(13) | PK | NOT NULL |  | Cédula o RUC del proveedor |
| `prv_nombre` | `nombre` | VARCHAR(100) |  | NOT NULL |  | Nombre o razón social del proveedor |
| `prv_direccion` | `direccion` | VARCHAR(200) |  | NULL |  | Dirección del proveedor |
| `prv_telefono` | `telefono` | VARCHAR(10) |  | NOT NULL |  | Teléfono de contacto del proveedor |
| `prv_correo` | `correo` | VARCHAR(120) |  | NULL |  | Correo electrónico del proveedor |
| `prv_contacto` | `contacto` | VARCHAR(100) |  | NULL |  | Nombre de la persona de contacto |

#### 31. `producto_proveedor` (modelo Prisma `ProductoProveedor`)

Tabla intersección que contiene los productos que provee al gimnasio cada proveedor (resuelve PRODUCTO N:N PROVEEDOR). Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `prd_codigo` | `productoId` | VARCHAR(13) | PK/FK | NOT NULL |  | Código interno del producto |
| `prv_ci_ruc` | `proveedorId` | VARCHAR(13) | PK/FK | NOT NULL |  | Cédula o RUC del proveedor |

Clave primaria compuesta: (prd_codigo, prv_ci_ruc).

#### 32. `orden_compra` (modelo Prisma `OrdenCompra`)

Tabla que contiene los pedidos de productos que se realizan a los proveedores. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `orc_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la orden de compra |
| `prv_ci_ruc` | `proveedorId` | VARCHAR(13) | FK | NOT NULL |  | Proveedor |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado que realiza el pedido |
| `orc_emp_autoriza` | `empAutorizaId` | VARCHAR(10) | FK | NULL | FK → empleado.emp_cedula. Trigger: obligatorio cuando orc_estado pasa a 'A'; el empleado debe estar activo (emp_estado = 'A') y tener una cuenta activa (usr_estado = 'A') con rol ADM activo en usuario_rol (url_estado = 'A') | Empleado (la dueña) que autorizó la orden |
| `orc_fecha_autoriza` | `fechaAutoriza` | TIMESTAMP |  | NULL | CHECK ((orc_emp_autoriza IS NULL AND orc_fecha_autoriza IS NULL) OR (orc_emp_autoriza IS NOT NULL AND orc_fecha_autoriza IS NOT NULL)) | Fecha de autorización de la orden |
| `orc_fecha` | `fecha` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha de la orden de compra |
| `orc_fecha_entrega` | `fechaEntrega` | DATE |  | NULL | CHECK (orc_fecha_entrega >= orc_fecha) | Fecha prevista de entrega |
| `orc_monto` | `monto` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0); lo calcula el procedimiento como Σ por_cantidad × por_costo_unit | Monto total de la orden (histórico) |
| `orc_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('P','A','M','R','X'); CHECK (orc_estado IN ('P','X') OR orc_emp_autoriza IS NOT NULL) | Estado (P=Pendiente, A=Autorizada, M=Recibida parcialmente, R=Recibida completa, X=Anulada) |

#### 33. `producto_ordencompra` (modelo Prisma `ProductoOrdenCompra`)

Tabla intersección que contiene los productos de una orden de compra (resuelve ORDEN_COMPRA N:N PRODUCTO). Lo recibido se obtiene de sus lotes. Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `prd_codigo` | `productoId` | VARCHAR(13) | PK/FK | NOT NULL |  | Código interno del producto |
| `orc_numero` | `ordenCompraId` | INTEGER | PK/FK | NOT NULL |  | Número de la orden de compra |
| `por_cantidad` | `cantidad` | INTEGER |  | NOT NULL | CHECK (> 0) | Cantidad pedida |
| `por_costo_unit` | `costoUnit` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0) | Costo unitario pactado |

Clave primaria compuesta: (prd_codigo, orc_numero).

#### 34. `lote_producto` (modelo Prisma `LoteProducto`)

Tabla que contiene los lotes de cada producto recibidos en el gimnasio, con su caducidad y existencia disponible. Un lote proviene de una línea de compra (o del inventario inicial). Tipo: Fuerte - NUEVA.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `lot_codigo` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Identificador interno del lote |
| `prd_codigo` | `productoId` | VARCHAR(13) | FK | NOT NULL | FK → producto; con orc_numero forma FK → producto_ordencompra | Producto al que pertenece el lote |
| `orc_numero` | `ordenCompraId` | INTEGER | FK | NULL | FK compuesta (prd_codigo, orc_numero) → producto_ordencompra; nula solo para inventario inicial. Trigger: la orden está en estado 'A' o 'M' | Orden de compra de la que proviene el lote |
| `lot_num_fabricante` | `numFabricante` | VARCHAR(30) |  | NULL |  | Número de lote impreso por el fabricante, cuando corresponda |
| `lot_fecha_ingreso` | `fechaIngreso` | DATE |  | NOT NULL | DEFAULT CURRENT_DATE | Fecha de ingreso del lote |
| `lot_fecha_caducidad` | `fechaCaducidad` | DATE |  | NULL | CHECK (>= lot_fecha_ingreso); obligatoria si el producto controla caducidad (trigger) | Fecha de caducidad (nula para ropa y accesorios) |
| `lot_cantidad_inicial` | `cantidadInicial` | INTEGER |  | NOT NULL | CHECK (> 0). Trigger con bloqueo: Σ lot_cantidad_inicial de la misma línea (orc_numero, prd_codigo) <= por_cantidad | Cantidad recibida en el lote |
| `lot_cantidad_disponible` | `cantidadDisponible` | INTEGER |  | NOT NULL | CHECK (>= 0 AND <= lot_cantidad_inicial); solo lo actualiza el trigger del kardex | Unidades que quedan del lote |
| `lot_costo_unit` | `costoUnit` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0) | Costo unitario de compra del lote |
| `lot_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('D','A','C','B'); DEFAULT 'D'; CHECK (lot_estado <> 'A' OR lot_cantidad_disponible = 0). El trigger del kárdex lo pasa a 'A' al llegar a 0 y el job diario a 'C' al vencer; 'B' es un bloqueo manual | Estado (D=Disponible, A=Agotado, C=Caducado, B=Bloqueado) |

#### 35. `tipo_movimiento` (modelo Prisma `TipoMovimiento`)

Tabla que contiene los tipos de movimiento del kárdex (compra, venta, ajuste, baja por caducidad) y de la caja (ingreso, egreso). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `tmv_codigo` | `id` | VARCHAR(4) | PK | NOT NULL |  | Código (kárdex: COM compra, VEN venta, ANV anulación de venta, AJP/AJN ajustes, CAD caducidad; caja: ING ingreso, EGR gasto, DEV devolución) |
| `tmv_descripcion` | `descripcion` | VARCHAR(120) |  | NOT NULL | UNIQUE | Descripción del tipo de movimiento |
| `tmv_tipo` | `tipo` | CHAR(1) |  | NOT NULL | CHECK IN ('I','E') | Sentido (I=Ingreso/Entrada, E=Egreso/Salida) |
| `tmv_aplica_a` | `aplicaA` | CHAR(1) |  | NOT NULL | CHECK IN ('K','C') | A qué aplica (K=Kárdex, C=Caja) |

#### 36. `kardex` (modelo Prisma `Kardex`)

Tabla que contiene cada entrada, salida o ajuste de inventario por lote, con costo promedio ponderado y saldos. Es la única vía para modificar PRD_Stock y LOT_Cantidad_Disponible. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `krd_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del movimiento del kárdex |
| `lot_codigo` | `loteProductoId` | INTEGER | FK | NOT NULL | Procedimiento de salida: elige los lotes con lot_estado = 'D', no vencidos, en orden FEFO (lot_fecha_caducidad) si prd_metodo_salida = 'E' o FIFO (lot_fecha_ingreso) si es 'F', con SELECT … FOR UPDATE | Lote afectado (el producto se obtiene de LOTE_PRODUCTO.PRD_Codigo) |
| `tmv_codigo` | `tipoMovimientoId` | VARCHAR(4) | FK | NOT NULL | Trigger BEFORE INSERT/UPDATE: tipo_movimiento.tmv_aplica_a = 'K' | Tipo de movimiento |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado responsable del movimiento |
| `ven_numero` | `ventaId` | INTEGER | FK | NULL | Obligatorio si tmv_codigo IN ('VEN','ANV'). Trigger: las salidas 'VEN' de una venta por producto suman dve_cantidad; las entradas 'ANV' devuelven exactamente esas cantidades a los mismos lotes y al mismo costo, solo si la venta está anulada | Venta que origina la salida (las entradas se rastrean por el lote → orden de compra) |
| `krd_fecha` | `fecha` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha y hora del movimiento |
| `krd_cantidad` | `cantidad` | INTEGER |  | NOT NULL | CHECK (> 0); el sentido lo da tmv_tipo | Cantidad que entra o sale |
| `krd_costo_unit` | `costoUnit` | NUMERIC(12,4) |  | NOT NULL | CHECK (>= 0) | Costo unitario del movimiento (entrada: costo del lote; salida: costo promedio) |
| `krd_saldo_cantidad` | `saldoCantidad` | INTEGER |  | NOT NULL | CHECK (>= 0) | Saldo del producto después del movimiento |
| `krd_costo_promedio` | `costoPromedio` | NUMERIC(12,4) |  | NOT NULL | CHECK (>= 0) | Costo promedio ponderado después del movimiento |
| `krd_saldo_valor` | `saldoValor` | NUMERIC(14,2) |  | NOT NULL | CHECK (>= 0) | Valor del inventario del producto después del movimiento |
| `krd_observacion` | `observacion` | VARCHAR(200) |  | NULL | Obligatoria en ajustes y bajas | Motivo del ajuste o de la baja |

#### 37. `pedido` (modelo Prisma `Pedido`)

Tabla que contiene los pedidos que los clientes confirman desde la página web (retiro en el gimnasio). Puede existir antes de pagarse; al completarse origina una VENTA. Tipo: Fuerte - NUEVA.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ped_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del pedido (id) |
| `usr_codigo` | `usuarioId` | INTEGER | FK | NOT NULL |  | Usuario web que hace el pedido (userId) |
| `mpg_codigo` | `metodoPagoId` | VARCHAR(3) | FK | NOT NULL |  | Método de pago elegido (EF=al retirar en el local, TR=transferencia en línea) |
| `ped_fecha_creacion` | `fechaCreacion` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha y hora de confirmación del pedido (createdAt) |
| `ped_total` | `total` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0); = Σ ROUND(pde_cantidad × pde_precio_unitario × (1 + pde_porcentaje_iva/100), 2) (lo calcula el procedimiento que confirma el pedido) | Total a pagar del pedido con IVA (total) |
| `ped_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('P','R','C','E','X'); DEFAULT 'P'. Trigger: solo avanza P→R→C→E, P→C/E (efectivo al retirar), P/R→X (cancelado sin cobro) o C/E→X cuando se anula su venta | Estado (P=Pendiente de pago, R=Pago reportado en verificación, C=Pagado y convertido en venta, E=Entregado/retirado, X=Cancelado) |
| `ped_ref_transferencia` | `refTransferencia` | VARCHAR(30) |  | NULL | CHECK (ped_estado <> 'R' OR mpg_codigo <> 'TR' OR TRIM(ped_ref_transferencia) IS NOT NULL) | Número del comprobante que reporta el cliente (aún no es un ingreso) |
| `ped_comprobante` | `comprobante` | VARCHAR(200) |  | NULL |  | Ruta de la imagen del comprobante subido por el cliente |
| `ped_fecha_reporte_pago` | `fechaReportePago` | TIMESTAMP |  | NULL |  | Fecha en que el cliente reportó la transferencia |
| `ped_fecha_retiro` | `fechaRetiro` | TIMESTAMP |  | NULL | CHECK ((ped_estado = 'E' AND ped_fecha_retiro IS NOT NULL) OR (ped_estado <> 'E' AND ped_fecha_retiro IS NULL)) | Fecha en que el cliente retiró el pedido en el gimnasio |

#### 38. `pedido_detalle` (modelo Prisma `PedidoDetalle`)

Tabla intersección con clave propia que contiene los productos de cada pedido con el precio del momento (resuelve PEDIDO N:N PRODUCTO; el reto exige un id propio). Tipo: Intersección (PK propia) - NUEVA.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `pde_codigo` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Identificador de la línea del pedido (id) |
| `ped_numero` | `pedidoId` | INTEGER | FK | NOT NULL | UNIQUE (ped_numero, prd_codigo) | Pedido al que pertenece la línea (pedidoId) |
| `prd_codigo` | `productoId` | VARCHAR(13) | FK | NOT NULL | Producto con prd_publicar_web = 'S' | Producto solicitado (productoId) |
| `pde_cantidad` | `cantidad` | INTEGER |  | NOT NULL | CHECK (> 0) | Cantidad solicitada (cantidad) |
| `pde_precio_unitario` | `precioUnitario` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0) | Precio sin IVA del producto al confirmar el pedido, histórico (precioUnitario) |
| `pde_porcentaje_iva` | `porcentajeIva` | NUMERIC(5,2) |  | NOT NULL | CHECK (BETWEEN 0 AND 100) | Porcentaje de IVA de la línea al confirmar el pedido (0 si no grava), histórico |

#### 39. `venta` (modelo Prisma `Venta`)

Tabla que contiene las ventas de productos efectivamente realizadas: presenciales (L) y web completadas (W) a partir de un pedido. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ven_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la venta |
| `cli_cedula` | `clienteId` | VARCHAR(10) | FK | NOT NULL |  | Cliente (CONSUMIDOR FINAL si no da datos) |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado que registra la venta o verifica el pago web |
| `ped_numero` | `pedidoId` | INTEGER | FK | NULL | UNIQUE; CHECK ((ven_canal = 'W' AND ped_numero IS NOT NULL) OR (ven_canal = 'L' AND ped_numero IS NULL)). Trigger: cli_cedula = cliente con cliente.usr_codigo = pedido.usr_codigo; el pedido está en 'R' con transferencia verificada o en 'P' si paga en efectivo al retirar, y no está cancelado | Pedido web de origen (relación 1:0..1) |
| `ven_fecha` | `fecha` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha de la venta |
| `ven_subtotal` | `subtotal` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0) | Subtotal de la venta sin IVA (histórico) |
| `ven_descuento` | `descuento` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0); DEFAULT 0 | Descuento aplicado |
| `ven_total` | `total` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0); CHECK (ven_total >= ven_subtotal - ven_descuento). Procedimiento: ven_subtotal = Σ dve_cantidad × dve_precio_unit; ven_descuento = Σ dve_descuento; IVA por línea sobre (cantidad × precio − descuento); ven_total = ven_subtotal − ven_descuento + IVA; no se editan a mano | Total cobrado con IVA = subtotal − descuento + IVA (histórico) |
| `ven_canal` | `canal` | CHAR(1) |  | NOT NULL | CHECK IN ('W','L') | Canal de la venta (W=Web, L=Local) |
| `ven_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('C','X'); DEFAULT 'C'. Procedimiento de anulación (una transacción, con SELECT … FOR UPDATE sobre la venta): 1) kardex tipo 'ANV' (entrada) por cada salida de la venta, al mismo lote y costo; 2) cada pago vigente pasa a 'A' y genera un movimiento_caja tipo 'DEV' (egreso) en el cuadre abierto; 3) la factura pasa a 'A'; 4) si es web, el pedido pasa a 'X'. Solo C→X, una vez | Estado (C=Completada, X=Anulada) |
| `ven_emp_anula` | `empAnulaId` | VARCHAR(10) | FK | NULL | FK → empleado.emp_cedula. Trigger: el empleado debe estar activo (emp_estado = 'A') y tener una cuenta activa (usr_estado = 'A') con rol ADM activo en usuario_rol (url_estado = 'A') | Empleado que registró la anulación de la venta |
| `ven_fecha_anula` | `fechaAnula` | TIMESTAMP |  | NULL |  | Fecha y hora de la anulación de la venta |
| `ven_motivo_anula` | `motivoAnula` | VARCHAR(200) |  | NULL | CHECK ((ven_estado = 'X' AND ven_emp_anula IS NOT NULL AND ven_fecha_anula IS NOT NULL AND ven_motivo_anula IS NOT NULL) OR (ven_estado <> 'X' AND ven_emp_anula IS NULL AND ven_fecha_anula IS NULL AND ven_motivo_anula IS NULL)) | Motivo de la anulación de la venta |

#### 40. `detalle_venta` (modelo Prisma `DetalleVenta`)

Tabla intersección que contiene los productos de una venta efectivamente realizada (resuelve VENTA N:N PRODUCTO). Tipo: Intersección.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ven_numero` | `ventaId` | INTEGER | PK/FK | NOT NULL |  | Número de la venta |
| `prd_codigo` | `productoId` | VARCHAR(13) | PK/FK | NOT NULL |  | Producto vendido |
| `dve_cantidad` | `cantidad` | INTEGER |  | NOT NULL | CHECK (> 0) | Cantidad vendida |
| `dve_precio_unit` | `precioUnit` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0) | Precio unitario sin IVA (histórico) |
| `dve_costo_unit` | `costoUnit` | NUMERIC(12,4) |  | NOT NULL | CHECK (>= 0) | Costo promedio del producto en esa venta |
| `dve_descuento` | `descuento` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0); DEFAULT 0 | Descuento de la línea |
| `dve_porcentaje_iva` | `porcentajeIva` | NUMERIC(5,2) |  | NOT NULL | CHECK (BETWEEN 0 AND 100) | Porcentaje de IVA aplicado (0 o el vigente) |

Clave primaria compuesta: (ven_numero, prd_codigo).

#### 41. `factura` (modelo Prisma `Factura`)

Tabla que contiene el comprobante tributario de una venta y/o de una inscripción (subtotales, IVA y total). La contadora la emite en el SRI; sus líneas son DETALLE_VENTA o la inscripción. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `fac_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número interno de la factura |
| `cli_cedula` | `clienteId` | VARCHAR(10) | FK | NOT NULL |  | Cliente al que se factura (CONSUMIDOR FINAL si no da datos) |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Contadora que emite la factura |
| `ven_numero` | `ventaId` | INTEGER | FK | NULL | UNIQUE; CHECK (ven_numero IS NOT NULL OR ins_numero IS NOT NULL) | Venta facturada (relación 1:0..1) |
| `ins_numero` | `inscripcionId` | INTEGER | FK | NULL | UNIQUE | Inscripción facturada (relación 1:0..1) |
| `fac_num_comprobante` | `numComprobante` | VARCHAR(17) |  | NULL | UNIQUE; CHECK (fac_num_comprobante IS NULL OR fac_num_comprobante ~ '^[0-9]{3}-[0-9]{3}-[0-9]{9}$') | Número de factura del SRI |
| `fac_fecha` | `fecha` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha de la factura |
| `fac_subtotal_0` | `subtotal0` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0). Procedimiento de emisión: lo mismo con las líneas con dve_porcentaje_iva = 0 y la inscripción si no grava | Base de los ítems que no gravan IVA, ya neta de descuentos |
| `fac_subtotal_iva` | `subtotalIva` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0); CHECK (fac_subtotal_iva > 0 OR fac_valor_iva = 0). Procedimiento de emisión: Σ (dve_cantidad × dve_precio_unit − dve_descuento) de las líneas de la venta con dve_porcentaje_iva = fac_porcentaje_iva, más ins_valor si la inscripción grava. El descuento ya viene por línea | Base imponible de los ítems que gravan IVA, ya neta de descuentos (sobre ella se calcula el IVA) |
| `fac_descuento` | `descuento` | NUMERIC(10,2) |  | NOT NULL | CHECK (>= 0); DEFAULT 0. Procedimiento de emisión: Σ dve_descuento + ins_descuento | Total de descuentos aplicados (informativo: ya está restado de las dos bases) |
| `fac_porcentaje_iva` | `porcentajeIva` | NUMERIC(5,2) |  | NOT NULL | CHECK (BETWEEN 0 AND 100). Procedimiento de emisión: todas las líneas gravadas (dve_porcentaje_iva > 0) y la inscripción si grava (ins_porcentaje_iva > 0) deben tener este mismo porcentaje; las de 0 % van a FAC_Subtotal_0. Si una venta y una inscripción tienen tasas distintas (por un cambio de tasa), se emiten facturas separadas | Porcentaje de IVA de la factura: el de sus líneas gravadas, que es uno solo (histórico) |
| `fac_valor_iva` | `valorIva` | NUMERIC(10,2) |  | NOT NULL | CHECK (fac_valor_iva = ROUND(fac_subtotal_iva × fac_porcentaje_iva / 100, 2)) | Valor del IVA |
| `fac_total` | `total` | NUMERIC(10,2) |  | NOT NULL | CHECK (fac_total = FAC_Subtotal_0 + fac_subtotal_iva + fac_valor_iva) | Total de la factura = bases netas + IVA |
| `fac_clave_acceso` | `claveAcceso` | VARCHAR(49) |  | NULL | UNIQUE; CHECK (fac_clave_acceso IS NULL OR fac_clave_acceso ~ '^[0-9]{49}$') | Clave de acceso / autorización del SRI |
| `fac_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('P','E','A'); DEFAULT 'P'; CHECK (fac_estado <> 'E' OR (fac_num_comprobante IS NOT NULL AND fac_clave_acceso IS NOT NULL)). Si la venta o inscripción se anula: 'P' pasa a 'A'; si ya estaba 'E', la contadora la anula en el SRI (o emite una nota de crédito fuera del sistema si el SRI ya no permite anularla) y pasa a 'A' | Estado (P=Pendiente de emitir, E=Emitida en el SRI, A=Anulada) |

#### 42. `metodo_pago` (modelo Prisma `MetodoPago`)

Tabla que contiene los métodos de pago aceptados (EF=Efectivo, TR=Transferencia). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `mpg_codigo` | `id` | VARCHAR(3) | PK | NOT NULL |  | Código del método de pago |
| `mpg_descripcion` | `descripcion` | VARCHAR(60) |  | NOT NULL | UNIQUE | Descripción del método de pago |

#### 43. `pago` (modelo Prisma `Pago`)

Tabla que contiene el dinero efectivamente recibido y verificado por una venta o por una inscripción. Cada pago genera un ingreso en caja y, solo si se anula, una devolución. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `pag_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del pago |
| `mpg_codigo` | `metodoPagoId` | VARCHAR(3) | FK | NOT NULL |  | Método de pago |
| `ven_numero` | `ventaId` | INTEGER | FK | NULL | CHECK ((ven_numero IS NOT NULL AND ins_numero IS NULL) OR (ven_numero IS NULL AND ins_numero IS NOT NULL)): exactamente uno | Venta que se paga |
| `ins_numero` | `inscripcionId` | INTEGER | FK | NULL | Ver ven_numero | Inscripción que se paga |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado que recibe o verifica el pago |
| `pag_fecha` | `fecha` | DATE |  | NOT NULL | DEFAULT CURRENT_DATE. Regla del gimnasio: todo se cobra en un solo momento. Trigger: todos los pagos de una misma inscripción o venta tienen la misma TRUNC(pag_fecha); no se acepta un pago de otro día | Fecha y hora del pago |
| `pag_monto` | `monto` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0). Procedimiento de cobro: registra en una sola transacción todos los pagos del cobro (efectivo y/o transferencia) y solo hace COMMIT si Σ pag_monto de los pagos vigentes = total a cobrar (con SELECT … FOR UPDATE sobre la inscripción o la venta). No hay abonos ni pagos parciales | Monto pagado |
| `pag_referencia` | `referencia` | VARCHAR(30) |  | NULL | CHECK (mpg_codigo <> 'TR' OR TRIM(pag_referencia) IS NOT NULL) | Número de comprobante de la transferencia |
| `pag_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('V','A'); DEFAULT 'V'. Solo pasa a 'A' dentro del procedimiento de anulación de su venta o inscripción | Estado (V=Vigente, A=Anulado y devuelto). Las sumas de lo cobrado solo cuentan los vigentes |

#### 44. `cierre_caja` (modelo Prisma `CierreCaja`)

Tabla que contiene los cierres de caja semanales que realiza la contadora. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ccj_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del cierre de caja |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Contadora que realiza el cierre |
| `ccj_fecha_desde` | `fechaDesde` | DATE |  | NOT NULL |  | Inicio del periodo del cierre |
| `ccj_fecha_hasta` | `fechaHasta` | DATE |  | NOT NULL | CHECK (ccj_fecha_hasta >= ccj_fecha_desde). El procedimiento de cierre bloquea la fila de gimnasio (SELECT … FOR UPDATE) para que dos cierres no corran a la vez; rechaza periodos solapados y solo asocia cuadre_turno con ctu_fecha dentro del rango | Fin del periodo del cierre |
| `ccj_total_efectivo` | `totalEfectivo` | NUMERIC(12,2) |  | NOT NULL | CHECK (>= 0); lo calcula el procedimiento de cierre semanal como Σ de los cuadre_turno del periodo | Total recaudado en efectivo (histórico) |
| `ccj_total_transf` | `totalTransf` | NUMERIC(12,2) |  | NOT NULL | CHECK (>= 0); lo calcula el procedimiento de cierre semanal como Σ de los cuadre_turno del periodo | Total recaudado por transferencia (histórico) |
| `ccj_total_egresos` | `totalEgresos` | NUMERIC(12,2) |  | NOT NULL | CHECK (>= 0); lo calcula el procedimiento de cierre semanal como Σ de los cuadre_turno del periodo | Total de egresos del periodo |
| `ccj_diferencia` | `diferencia` | NUMERIC(12,2) |  | NOT NULL | Procedimiento de cierre semanal: Σ ctu_diferencia de los cuadre_turno del periodo (faltante negativo, sobrante positivo). No se edita a mano | Diferencia acumulada de la semana entre el efectivo contado y el esperado en cada cuadre |
| `ccj_observacion` | `observacion` | VARCHAR(300) |  | NULL |  | Observación del cierre |

#### 45. `cuadre_turno` (modelo Prisma `CuadreTurno`)

Tabla que contiene los cuadres diarios de lo vendido y cobrado en cada turno. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `ctu_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del cuadre |
| `tur_codigo` | `turnoId` | VARCHAR(3) | FK | NOT NULL | UNIQUE (tur_codigo, ctu_fecha) | Turno que se cuadra |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado responsable del turno |
| `ccj_numero` | `cierreCajaId` | INTEGER | FK | NULL | Nulo hasta el cierre semanal. Trigger: si ccj_numero no es nulo, se rechaza UPDATE y DELETE del cuadre y INSERT, UPDATE y DELETE de sus movimiento_caja | Cierre semanal al que pertenece |
| `ctu_fecha` | `fecha` | DATE |  | NOT NULL | tipo DATE (solo la fecha, sin hora) | Fecha del cuadre |
| `ctu_saldo_inicial` | `saldoInicial` | NUMERIC(12,2) |  | NOT NULL | CHECK (>= 0) | Saldo con el que inicia el turno |
| `ctu_total_ingresos` | `totalIngresos` | NUMERIC(12,2) |  | NOT NULL | CHECK (>= 0); lo calcula el procedimiento de cierre de turno | Ingresos en efectivo del turno (Σ de MOVIMIENTO_CAJA cuyo pago o comisión es EF) |
| `ctu_total_transf` | `totalTransf` | NUMERIC(12,2) |  | NOT NULL | CHECK (>= 0); lo calcula el procedimiento de cierre de turno | Ingresos por transferencia del turno (informativo: no es dinero físico y no entra al arqueo) |
| `ctu_total_egresos` | `totalEgresos` | NUMERIC(12,2) |  | NOT NULL | CHECK (>= 0); lo calcula el procedimiento de cierre de turno | Egresos en efectivo del turno |
| `ctu_saldo_final` | `saldoFinal` | NUMERIC(12,2) |  | NOT NULL | CHECK (ctu_saldo_final = ctu_saldo_inicial + ctu_total_ingresos − ctu_total_egresos) | Efectivo que debería haber en caja |
| `ctu_efectivo_contado` | `efectivoContado` | NUMERIC(12,2) |  | NULL | CHECK (>= 0) | Efectivo contado físicamente |
| `ctu_diferencia` | `diferencia` | NUMERIC(12,2) |  | NULL | CHECK (ctu_diferencia = ctu_efectivo_contado − ctu_saldo_final) | Diferencia entre saldo final y efectivo contado |

#### 46. `movimiento_caja` (modelo Prisma `MovimientoCaja`)

Tabla que contiene cada ingreso o egreso de dinero de la caja: pagos de ventas e inscripciones, comisiones de aliados y gastos. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `mcj_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del movimiento de caja |
| `ctu_numero` | `cuadreTurnoId` | INTEGER | FK | NOT NULL |  | Cuadre de turno al que pertenece |
| `tmv_codigo` | `tipoMovimientoId` | VARCHAR(4) | FK | NOT NULL | Trigger BEFORE INSERT/UPDATE: tipo_movimiento.tmv_aplica_a = 'C' | Tipo de movimiento (ingreso/egreso) |
| `pag_numero` | `pagoId` | INTEGER | FK | NULL | UNIQUE (pag_numero, tmv_codigo): un pago tiene como máximo un ingreso y una devolución. CHECK (pag_numero IS NULL OR coa_numero IS NULL). Trigger: ingreso → exactamente uno de pag_numero / coa_numero; egreso 'DEV' (devolución) → pag_numero de un pago anulado, por el mismo monto; otro egreso (gasto) → ambos nulos. Una devolución por transferencia no sale del efectivo del cuadre | Pago que origina el ingreso o que se devuelve |
| `coa_numero` | `comisionAliadoId` | INTEGER | FK | NULL | UNIQUE | Comisión de aliado que origina el ingreso |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NOT NULL |  | Empleado que registra el movimiento |
| `mcj_fecha` | `fecha` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha y hora del movimiento |
| `mcj_concepto` | `concepto` | VARCHAR(200) |  | NOT NULL |  | Concepto del movimiento |
| `mcj_monto` | `monto` | NUMERIC(10,2) |  | NOT NULL | CHECK (> 0) | Monto del movimiento |

#### 47. `notificacion` (modelo Prisma `Notificacion`)

Tabla que contiene los avisos a clientes (vencimiento de membresía, promociones, pedido listo) y las alertas internas a empleados (lote por caducar, stock mínimo). Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `not_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número de la notificación |
| `not_destino` | `destino` | CHAR(1) |  | NOT NULL | CHECK ((not_destino = 'C' AND cli_cedula IS NOT NULL AND emp_cedula IS NULL) OR (not_destino = 'E' AND emp_cedula IS NOT NULL AND cli_cedula IS NULL)) | Destinatario (C=Cliente, E=Empleado/alerta interna) |
| `cli_cedula` | `clienteId` | VARCHAR(10) | FK | NULL | Obligatorio si not_destino = 'C' | Cliente notificado |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NULL | Obligatorio si not_destino = 'E' | Empleado que recibe la alerta interna |
| `ins_numero` | `inscripcionId` | INTEGER | FK | NULL |  | Inscripción relacionada (aviso de vencimiento) |
| `ped_numero` | `pedidoId` | INTEGER | FK | NULL |  | Pedido relacionado (pedido listo para retirar) |
| `prm_numero` | `promocionId` | INTEGER | FK | NULL | Obligatorio si not_tipo = 'P' | Promoción anunciada |
| `prd_codigo` | `productoId` | VARCHAR(13) | FK | NULL |  | Producto relacionado (alerta de stock mínimo) |
| `lot_codigo` | `loteProductoId` | INTEGER | FK | NULL |  | Lote relacionado (alerta de caducidad) |
| `not_tipo` | `tipo` | CHAR(1) |  | NOT NULL | CHECK IN ('V','P','L','K','S'); CHECK ((not_tipo = 'V' AND not_destino = 'C' AND ins_numero IS NOT NULL AND prm_numero IS NULL AND ped_numero IS NULL AND lot_codigo IS NULL AND prd_codigo IS NULL) OR (not_tipo = 'P' AND not_destino = 'C' AND prm_numero IS NOT NULL AND ins_numero IS NULL AND ped_numero IS NULL AND lot_codigo IS NULL AND prd_codigo IS NULL) OR (not_tipo = 'L' AND not_destino = 'C' AND ped_numero IS NOT NULL AND ins_numero IS NULL AND prm_numero IS NULL AND lot_codigo IS NULL AND prd_codigo IS NULL) OR (not_tipo = 'K' AND not_destino = 'E' AND lot_codigo IS NOT NULL AND ins_numero IS NULL AND prm_numero IS NULL AND ped_numero IS NULL AND prd_codigo IS NULL) OR (not_tipo = 'S' AND not_destino = 'E' AND prd_codigo IS NOT NULL AND ins_numero IS NULL AND prm_numero IS NULL AND ped_numero IS NULL AND lot_codigo IS NULL)): un solo objeto, el que corresponde al tipo, y el destinatario correcto | Tipo (V=Membresía por vencer o tarjeta por agotarse, P=Promoción, L=Pedido listo, K=Lote por caducar, S=Stock mínimo) |
| `not_mensaje` | `mensaje` | VARCHAR(500) |  | NOT NULL |  | Texto del mensaje |
| `not_fecha_envio` | `fechaEnvio` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha y hora de generación/envío |
| `not_canal` | `canal` | CHAR(1) |  | NOT NULL | CHECK IN ('W','C','S') | Canal (W=WhatsApp, C=Correo, S=Sistema interno) |
| `not_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('P','E','F','L') | Estado (P=Pendiente, E=Enviada, F=Fallida, L=Leída) |

#### 48. `mensaje_contacto` (modelo Prisma `MensajeContacto`)

Tabla que contiene los mensajes enviados desde el formulario de contacto de la página web. Tipo: Fuerte.

| Columna | Campo en la API | Tipo PostgreSQL | Clave | Nulo | Restricciones y reglas | Descripción |
|---|---|---|---|---|---|---|
| `mct_numero` | `id` | INTEGER (autoincremental) | PK | NOT NULL |  | Número del mensaje |
| `emp_cedula` | `empleadoId` | VARCHAR(10) | FK | NULL |  | Empleado que atiende el mensaje |
| `mct_nombre` | `nombre` | VARCHAR(60) |  | NOT NULL |  | Nombre de quien escribe |
| `mct_correo` | `correo` | VARCHAR(120) |  | NOT NULL |  | Correo de quien escribe |
| `mct_telefono` | `telefono` | VARCHAR(10) |  | NULL |  | Teléfono de quien escribe |
| `mct_mensaje` | `mensaje` | VARCHAR(400) |  | NOT NULL |  | Contenido del mensaje |
| `mct_fecha` | `fecha` | TIMESTAMP |  | NOT NULL | DEFAULT CURRENT_TIMESTAMP | Fecha de envío |
| `mct_estado` | `estado` | CHAR(1) |  | NOT NULL | CHECK IN ('P','R'); DEFAULT 'P' | Estado (P=Pendiente, R=Respondido) |

### 6.4 Relaciones uno a muchos y uno a cero o uno

Cada fila es una clave foránea. En las de tipo 1:0..1 la FK es nula y UNIQUE.

| N° | Tabla padre | Cardinalidad | Tabla hija | Clave foránea que la implementa | Significado |
|---|---|---|---|---|---|
| 1 | `gimnasio` | 1:N | `horario_atencion` | horario_atencion.gim_ruc → gimnasio | Un gimnasio tiene varios horarios de atención |
| 2 | `usuario` | 1:N | `usuario_rol` | usuario_rol.usr_codigo → usuario | Un usuario tiene uno o varios roles |
| 3 | `rol` | 1:N | `usuario_rol` | usuario_rol.rol_codigo → rol | Un rol se asigna a varios usuarios |
| 4 | `usuario` | 1:0..1 | `empleado` | empleado.usr_codigo (UNIQUE, nulo) | Un empleado puede tener una cuenta de usuario |
| 5 | `usuario` | 1:0..1 | `cliente` | cliente.usr_codigo (UNIQUE, nulo) | Un cliente puede tener una cuenta web |
| 6 | `cargo` | 1:N | `empleado` | empleado.crg_codigo → cargo | Un cargo lo desempeñan varios empleados |
| 7 | `turno` | 1:N | `empleado` | empleado.tur_codigo → turno | Un turno se asigna a varios empleados |
| 8 | `empleado` | 1:N | `asistencia_empleado` | asistencia_empleado.emp_cedula → empleado | Un empleado firma muchas entradas y salidas |
| 9 | `nivel` | 1:N | `cliente` | cliente.niv_codigo → nivel | Un nivel lo tienen muchos clientes |
| 10 | `nivel` | 1:N | `rutina` | rutina.niv_codigo → nivel | Una rutina corresponde a un nivel |
| 11 | `cliente` | 1:N | `rutina` | rutina.cli_cedula → cliente | Un cliente recibe varias rutinas en el tiempo |
| 12 | `empleado` | 1:N | `rutina` | rutina.emp_cedula → empleado | Un entrenador elabora muchas rutinas |
| 13 | `membresia` | 1:N | `membresia_servicio` | membresia_servicio.mem_codigo → membresia | Una membresía incluye varios servicios |
| 14 | `servicio` | 1:N | `membresia_servicio` | membresia_servicio.srv_codigo → servicio | Un servicio está incluido en varias membresías |
| 15 | `membresia` | 1:N | `membresia_promocion` | membresia_promocion.mem_codigo → membresia | Una membresía puede estar en varias promociones |
| 16 | `promocion` | 1:N | `membresia_promocion` | membresia_promocion.prm_numero → promocion | Una promoción aplica a varias membresías |
| 17 | `membresia` | 1:N | `inscripcion` | inscripcion.mem_codigo → membresia | Una membresía se contrata en muchas inscripciones |
| 18 | `promocion` | 1:N | `inscripcion` | inscripcion.prm_numero → promocion | Una promoción se aplica a muchas inscripciones (opcional) |
| 19 | `empleado` | 1:N | `inscripcion` | inscripcion.emp_cedula → empleado | Un empleado registra muchas inscripciones (nulo si es web) |
| 20 | `empleado` | 1:N | `inscripcion` | inscripcion.ins_emp_autoriza → empleado.emp_cedula (nula) | Un empleado autoriza las promociones de muchas inscripciones (opcional) |
| 21 | `empleado` | 1:N | `inscripcion` | inscripcion.ins_emp_anula → empleado.emp_cedula (nula) | Un empleado registra anulaciones de inscripciones (opcional) |
| 22 | `inscripcion` | 1:N | `inscripcion_cliente` | inscripcion_cliente.ins_numero → inscripcion | Una inscripción cubre a 1, 2 o 3 clientes |
| 23 | `cliente` | 1:N | `inscripcion_cliente` | inscripcion_cliente.cli_cedula → cliente | Un cliente tiene muchas inscripciones en su historial |
| 24 | `inscripcion` | 1:N | `suspension` | suspension.ins_numero → inscripcion | Una inscripción puede tener varias suspensiones médicas |
| 25 | `empleado` | 1:N | `suspension` | suspension.emp_cedula → empleado | Un empleado autoriza muchas suspensiones |
| 26 | `empleado` | 1:N | `suspension` | suspension.sus_emp_anula → empleado.emp_cedula (nula) | Un empleado registra anulaciones de suspensiones (opcional) |
| 27 | `servicio` | 1:N | `clase` | clase.srv_codigo → servicio | Un servicio interno se dicta como una o varias clases |
| 28 | `empleado` | 1:N | `clase` | clase.emp_cedula → empleado | Un instructor dicta una o varias clases |
| 29 | `clase` | 1:N | `clase_horario` | clase_horario.cla_codigo → clase | Una clase se dicta en varios horarios |
| 30 | `horario` | 1:N | `clase_horario` | clase_horario.hor_codigo → horario | En un horario se pueden dictar varias clases |
| 31 | `inscripcion_cliente` | 1:N | `asistencia_cliente` | asistencia_cliente.(ins_numero, cli_cedula) → inscripcion_cliente (FK compuesta) | Un integrante de una inscripción registra muchas entradas (solo los integrantes pueden usarla) |
| 32 | `clase_horario` | 1:N | `asistencia_cliente` | asistencia_cliente.(cla_codigo, hor_codigo) → clase_horario (FK compuesta, nula) | En una clase y horario asisten muchos clientes (opcional) |
| 33 | `servicio` | 1:N | `profesional_aliado` | profesional_aliado.srv_codigo → servicio | Un servicio externo lo ofrecen uno o varios aliados |
| 34 | `profesional_aliado` | 1:N | `comision_aliado` | comision_aliado.pal_cedula → profesional_aliado | Un aliado paga una comisión por cada periodo |
| 35 | `empleado` | 1:N | `comision_aliado` | comision_aliado.emp_cedula → empleado | La supervisora cobra y registra las comisiones |
| 36 | `metodo_pago` | 1:N | `comision_aliado` | comision_aliado.mpg_codigo → metodo_pago | Una comisión se paga con un método |
| 37 | `comision_aliado` | 1:0..1 | `movimiento_caja` | movimiento_caja.coa_numero (UNIQUE, nulo) | Cada comisión cobrada genera un solo ingreso en caja |
| 38 | `categoria` | 1:N | `producto` | producto.cat_codigo → categoria | Una categoría agrupa muchos productos |
| 39 | `unidad_medida` | 1:N | `producto` | producto.unm_codigo → unidad_medida | Una unidad de medida se usa en muchos productos |
| 40 | `producto` | 1:N | `producto_proveedor` | producto_proveedor.prd_codigo → producto | Un producto puede tener varios proveedores |
| 41 | `proveedor` | 1:N | `producto_proveedor` | producto_proveedor.prv_ci_ruc → proveedor | Un proveedor provee varios productos |
| 42 | `proveedor` | 1:N | `orden_compra` | orden_compra.prv_ci_ruc → proveedor | A un proveedor se le hacen muchas órdenes |
| 43 | `empleado` | 1:N | `orden_compra` | orden_compra.emp_cedula → empleado | Un empleado realiza muchas órdenes de compra |
| 44 | `empleado` | 1:N | `orden_compra` | orden_compra.orc_emp_autoriza → empleado.emp_cedula (nula) | La dueña autoriza muchas órdenes de compra (opcional) |
| 45 | `orden_compra` | 1:N | `producto_ordencompra` | producto_ordencompra.orc_numero → orden_compra | Una orden tiene varios productos |
| 46 | `producto` | 1:N | `producto_ordencompra` | producto_ordencompra.prd_codigo → producto | Un producto se pide en muchas órdenes |
| 47 | `producto` | 1:N | `lote_producto` | lote_producto.prd_codigo → producto | Un producto tiene muchos lotes |
| 48 | `producto_ordencompra` | 1:N | `lote_producto` | lote_producto.(prd_codigo, orc_numero) → producto_ordencompra (FK compuesta; orc_numero nulo en inventario inicial) | Una línea de compra se recibe en uno o varios lotes (recepción parcial) |
| 49 | `lote_producto` | 1:N | `kardex` | kardex.lot_codigo → lote_producto | Un lote tiene muchos movimientos |
| 50 | `tipo_movimiento` | 1:N | `kardex` | kardex.tmv_codigo → tipo_movimiento | Un tipo se aplica a muchos movimientos de kárdex |
| 51 | `empleado` | 1:N | `kardex` | kardex.emp_cedula → empleado | Un empleado registra muchos movimientos |
| 52 | `venta` | 1:N | `kardex` | kardex.ven_numero → venta | Una venta genera las salidas de sus lotes |
| 53 | `usuario` | 1:N | `pedido` | pedido.usr_codigo → usuario | Un usuario web hace muchos pedidos |
| 54 | `metodo_pago` | 1:N | `pedido` | pedido.mpg_codigo → metodo_pago | Un método de pago es elegido en muchos pedidos |
| 55 | `pedido` | 1:N | `pedido_detalle` | pedido_detalle.ped_numero → pedido | Un pedido tiene varios productos |
| 56 | `producto` | 1:N | `pedido_detalle` | pedido_detalle.prd_codigo → producto | Un producto aparece en muchos pedidos |
| 57 | `pedido` | 1:0..1 | `venta` | venta.ped_numero (UNIQUE, nulo en ventas locales) | Un pedido completado origina como máximo una venta |
| 58 | `cliente` | 1:N | `venta` | venta.cli_cedula → cliente | Un cliente realiza muchas compras |
| 59 | `empleado` | 1:N | `venta` | venta.emp_cedula → empleado | Un empleado registra muchas ventas |
| 60 | `empleado` | 1:N | `venta` | venta.ven_emp_anula → empleado.emp_cedula (nula) | Un empleado registra anulaciones de ventas (opcional) |
| 61 | `venta` | 1:N | `detalle_venta` | detalle_venta.ven_numero → venta | Una venta tiene varios productos |
| 62 | `producto` | 1:N | `detalle_venta` | detalle_venta.prd_codigo → producto | Un producto se vende en muchas ventas |
| 63 | `venta` | 1:0..1 | `factura` | factura.ven_numero (UNIQUE, nulo) | Una venta se factura una sola vez |
| 64 | `inscripcion` | 1:0..1 | `factura` | factura.ins_numero (UNIQUE, nulo) | Una inscripción se factura una sola vez |
| 65 | `cliente` | 1:N | `factura` | factura.cli_cedula → cliente | A un cliente se le emiten muchas facturas |
| 66 | `empleado` | 1:N | `factura` | factura.emp_cedula → empleado | La contadora emite muchas facturas |
| 67 | `metodo_pago` | 1:N | `pago` | pago.mpg_codigo → metodo_pago | Un método se usa en muchos pagos |
| 68 | `venta` | 1:N | `pago` | pago.ven_numero → venta | Una venta se paga en uno o varios pagos |
| 69 | `inscripcion` | 1:N | `pago` | pago.ins_numero → inscripcion | Una inscripción se paga en uno o varios pagos |
| 70 | `empleado` | 1:N | `pago` | pago.emp_cedula → empleado | Un empleado recibe muchos pagos |
| 71 | `pago` | 1:N | `movimiento_caja` | movimiento_caja.pag_numero (nula; UNIQUE con tmv_codigo) | Cada pago genera un ingreso y, si se anula, una devolución (máximo 2 movimientos) |
| 72 | `tipo_movimiento` | 1:N | `movimiento_caja` | movimiento_caja.tmv_codigo → tipo_movimiento | Un tipo se aplica a muchos movimientos de caja |
| 73 | `cuadre_turno` | 1:N | `movimiento_caja` | movimiento_caja.ctu_numero → cuadre_turno | Un cuadre agrupa los movimientos del turno |
| 74 | `empleado` | 1:N | `movimiento_caja` | movimiento_caja.emp_cedula → empleado | Un empleado registra muchos movimientos de caja |
| 75 | `turno` | 1:N | `cuadre_turno` | cuadre_turno.tur_codigo → turno | Un turno se cuadra todos los días |
| 76 | `empleado` | 1:N | `cuadre_turno` | cuadre_turno.emp_cedula → empleado | Un empleado realiza muchos cuadres |
| 77 | `cierre_caja` | 1:N | `cuadre_turno` | cuadre_turno.ccj_numero → cierre_caja | Un cierre semanal agrupa los cuadres de la semana |
| 78 | `empleado` | 1:N | `cierre_caja` | cierre_caja.emp_cedula → empleado | La contadora realiza los cierres |
| 79 | `promocion` | 1:N | `notificacion` | notificacion.prm_numero → promocion | Una promoción se anuncia en muchas notificaciones |
| 80 | `cliente` | 1:N | `notificacion` | notificacion.cli_cedula → cliente | Un cliente recibe muchas notificaciones |
| 81 | `empleado` | 1:N | `notificacion` | notificacion.emp_cedula → empleado | Un empleado recibe muchas alertas internas |
| 82 | `inscripcion` | 1:N | `notificacion` | notificacion.ins_numero → inscripcion | Una inscripción genera avisos de vencimiento |
| 83 | `pedido` | 1:N | `notificacion` | notificacion.ped_numero → pedido | Un pedido genera el aviso de 'listo para retirar' |
| 84 | `producto` | 1:N | `notificacion` | notificacion.prd_codigo → producto | Un producto genera alertas de stock mínimo |
| 85 | `lote_producto` | 1:N | `notificacion` | notificacion.lot_codigo → lote_producto | Un lote genera alertas de caducidad |
| 86 | `empleado` | 1:N | `mensaje_contacto` | mensaje_contacto.emp_cedula → empleado | Un empleado atiende los mensajes de contacto |

### 6.5 Relaciones muchos a muchos ya normalizadas

Ninguna de estas se implementa como relación directa. Cada una es una tabla con dos relaciones uno a muchos (ya listadas en 6.4) y su clave primaria compuesta.

| Relación conceptual | Tabla intermedia | Clave primaria de la intermedia |
|---|---|---|
| `usuario` N:N `rol` | `usuario_rol` | usr_codigo + rol_codigo |
| `membresia` N:N `servicio` | `membresia_servicio` | mem_codigo + srv_codigo |
| `membresia` N:N `promocion` | `membresia_promocion` | mem_codigo + prm_numero |
| `inscripcion` N:N `cliente` | `inscripcion_cliente` | ins_numero + cli_cedula |
| `clase` N:N `horario` | `clase_horario` | cla_codigo + hor_codigo |
| `producto` N:N `proveedor` | `producto_proveedor` | prd_codigo + prv_ci_ruc |
| `orden_compra` N:N `producto` | `producto_ordencompra` | prd_codigo + orc_numero |
| `pedido` N:N `producto` | `pedido_detalle` | pde_codigo, UNIQUE (ped_numero, prd_codigo) |
| `venta` N:N `producto` | `detalle_venta` | ven_numero + prd_codigo |

### 6.6 Restricciones CHECK e índices especiales

Prisma no genera CHECK. Después de la migración inicial:

1. Crear una migración vacía (`prisma migrate dev --create-only --name checks`).
2. Escribir en ella un `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` por cada CHECK del diccionario que use solo columnas de la misma fila: listas `IN`, rangos, formato de horas con `~`, comparaciones entre columnas (fin mayor o igual que inicio) y las combinaciones de nulos (por ejemplo `hat_abierto` con las horas, `mem_tipo` con duración o ingresos, los datos de anulación con el estado).
3. Agregar el índice único parcial de `inscripcion_cliente`: un solo titular por inscripción (`UNIQUE (ins_numero) WHERE icl_es_titular = 'S'`).
4. Nombrar cada restricción `tabla_ck_columna_tipo` para que el error sea legible.
5. Guardar una copia del SQL en `prisma/sql/checks.sql`.
6. Aplicar la migración y comprobar que un INSERT con un estado fuera de la lista falla.

Las reglas que comparan con otras tablas (el titular debe existir antes de activar, la promoción debe estar vigente, el empleado que autoriza debe tener rol ADM activo, etc.) no van como CHECK: van en servicios.

### 6.7 Base de datos y usuario

Crear la base `planeta_fitness` y un rol `planeta_app` dueño de esa base, con permiso CREATEDB solo en desarrollo (Prisma lo necesita para su base temporal de migraciones). En el README dejar anotado que en producción se usa un usuario para migrar y otro, sin permisos de DDL, para la aplicación.

### 6.8 Seed

`prisma/seed.js` carga datos iniciales. Debe poder ejecutarse varias veces sin duplicar (upsert o comprobación previa). Contenido:

| Tabla | Datos |
|---|---|
| gimnasio | Planeta Fitness, Avenida San Rio de Janeiro y Panamá, Quito; correo planetafitness@gmail.com; aforo 75; IVA 15; establecimiento y punto de emisión 001; RUC y propietaria de relleno marcados para reemplazar |
| horario_atencion | Lunes a viernes 06:00 a 21:00; sábado 09:00 a 12:00; domingo cerrado (abierto = N, horas nulas) |
| rol | ADM Administrador (A), REC Recepcionista (A), ENT Entrenador (A), CON Contadora/Supervisora (A), CLI Cliente web (U) |
| cargo | ADM, CON, ENT, DIS (diseñador), BAI (profesor de bailoterapia) |
| turno | MAN 06:00 a 10:00, MED 10:00 a 14:00, TAR 14:00 a 21:30 |
| nivel | PRI Principiante, INT Intermedio, AVA Avanzado |
| metodo_pago | EF Efectivo, TR Transferencia |
| categoria | SUP Suplementos, ROP Ropa, ACC Accesorios, BEB Bebidas, SNK Snacks, PRO Proteínas |
| unidad_medida | UND unidad, LAT lata, BOT botella, LB libra, G gramo, ML mililitro |
| tipo_movimiento | Kárdex: COM compra (I), VEN venta (E), ANV anulación de venta (I), AJP ajuste positivo (I), AJN ajuste negativo (E), CAD baja por caducidad (E). Caja: ING ingreso (I), EGR egreso (E), DEV devolución (E) |
| servicio | PES pesas, CAR cardio, BOX boxeo, BAI bailoterapia, RUT rutinas (tipo I); NUT nutrición (tipo A) |
| empleado | Administrador General, cédula 1711111110 (cargo ADM, vinculado al usuario admin). Tres entrenadores, cargo ENT: Entrenador Uno, cédula 1700000019, especialidad Boxeo, turno MAN; Entrenador Dos, cédula 1700000027, Bailoterapia, turno TAR; Entrenador Tres, cédula 1700000035, Rutinas personalizadas, turno MED. Son cédulas ficticias que pasan el dígito verificador; el frontend usa estas mismas para las fotos |
| usuario + usuario_rol | admin@planetafitness.ec con rol ADM; cliente@planetafitness.ec con rol CLI. Contraseñas desde `.env`, guardadas con bcrypt |
| cliente | Cliente Prueba, cédula 1712345675, teléfono 0991234567, correo cliente@planetafitness.ec, nivel PRI, vinculado a su usuario. Y el registro CONSUMIDOR FINAL (cédula 9999999999, RUC 9999999999999) |
| membresia + membresia_servicio | MI1 Plan individual (1 persona, $35), MI2 Plan para 2 personas ($60), MI3 Plan para 3 personas ($85). Tipo T, duración 1, unidad M, incluye rutina, se publica en la web. Cada una con PES, CAR, BOX, BAI y RUT. `paga_iva = 'N'` para que el precio publicado sea el total, con una nota de que debe confirmarlo la contadora |
| horario + clase + clase_horario | Clase 1 Boxeo (servicio BOX, Entrenador Uno, segundo piso, cupo 20): horarios 1 lunes, 2 jueves y 3 viernes, de 07:00 a 09:00. Clase 2 Bailoterapia (servicio BAI, Entrenador Dos, planta baja, cupo 25): horarios 4 martes y 5 jueves, de 18:30 a 20:30. Los ids 1 y 2 de las clases se mantienen porque el frontend los usa para las imágenes |
| producto + lote_producto + kardex | Los 10 productos de la tabla siguiente, cada uno con un lote de inventario inicial de 30 unidades (orden de compra nula) y su movimiento AJP "Inventario inicial" en el kárdex, con saldo y costo coherentes. Si la base ya tenía el lote inicial de 20 unidades, el seed registra una entrada adicional de 10 unidades una sola vez. Suplementos con control de caducidad (30 días de alerta, salida FEFO, caducidad del lote 2027-12-31); ropa y accesorios sin caducidad (salida FIFO). Costo de ejemplo: 60 % del precio sin IVA, marcado para reemplazar |
| profesional_aliado | Nutricionista Aliado, cédula 1700000043, servicio NUT, teléfono 0990000000, consultorio planta baja, comisión 50 (datos de ejemplo) |

Productos (el precio que mostraba la tienda era el precio final; en la base se guarda sin IVA, dividido para 1,15 y redondeado a dos decimales):

| Código | Nombre | Categoría | Precio final que mostraba la tienda | Descripción |
|---|---|---|---|---|
| PF0001 | Whey Protein | SUP | 61.99 | Proteína de suero de leche sabor chocolate, 2 lb (907 g). Aporta 24 g de proteína por servicio para la recuperación muscular. |
| PF0002 | Whey Protein 2LB Chocolate | SUP | 66.99 | Whey protein concentrado sabor chocolate, 2 lb (907 g). Se mezcla con agua o leche y se toma después de entrenar. |
| PF0003 | Creatina | SUP | 24.99 | Creatina monohidrato en polvo, 500 g. Apoya el aumento de fuerza y de masa muscular en la sala de pesas. |
| PF0004 | Barra Proteica | SUP | 1.50 | Barra de 45 g con 15 g de proteína. Snack práctico para consumir entre comidas o antes de entrenar. |
| PF0005 | Short Deportivo | ROP | 15.50 | Short de entrenamiento en tejido transpirable con cordón y bolsillo lateral. Tallas S, M, L y XL. |
| PF0006 | Short Gymshark | ROP | 25.99 | Short de entrenamiento de la marca Gymshark, con corte anatómico y cinta reflectante. Tallas S, M, L y XL. |
| PF0007 | Buzo de Compresión | ROP | 39.99 | Buzo de compresión de manga larga con costuras planas y cierre storm flap. Tallas S, M, L y XL. |
| PF0008 | Straps | ACC | 5.99 | Par de straps de cuero para levantar peso muerto y press banca. Ayudan a no soltar la barra en series pesadas. |
| PF0009 | Muñequeras | ACC | 5.30 | Cinta de acolchado para muñecas. Protege las articulaciones en los ejercicios de peso y evita que la venda se deslice. |
| PF0010 | Cinturón de Cuero | ACC | 33.40 | Cinturón de cuero de 10 cm con hebilla para levantar peso muerto. Sostiene la columna con pesos altos. |

Si el seed inserta ids explícitos en tablas autoincrementales (horario_atencion, horario, clase), al final debe mover la secuencia de PostgreSQL al máximo id para que el siguiente registro creado desde el panel no choque.

## 7. Patrones

| Patrón | Dónde | Regla |
|---|---|---|
| N capas | routes, middleware, controllers, services, models | Cada capa solo llama a la siguiente |
| MVC | models = repositorios, view = JSON armado por los DTO, controllers | El controlador no tiene reglas de negocio |
| Repository | `models/*.repository.js` | Cada función recibe opcionalmente la transacción (`tx`); si no, usa la instancia Singleton |
| Singleton | `config/prisma.js` | Una sola instancia de PrismaClient en todo el proceso. Nunca crear una por solicitud |
| Factory | `factories/repository.factory.js` | Entrega el repositorio de una tabla para el panel solo si está en una lista controlada. Nunca usa el texto de la URL para importar módulos ni para armar consultas |
| DTO | `utils/dto.js` | Convierte lo que devuelve Prisma en el JSON de la API: nombres del reto, Decimal a número, sin campos sensibles |

## 8. Middleware

Orden global en `app.js`:

| Orden | Middleware | Comportamiento |
|---|---|---|
| 1 | correlation / logger | Asigna `X-Correlation-Id` (reutiliza el que llega si es válido) y registra una línea JSON por solicitud: método, ruta, estado, milisegundos, id de usuario. Nunca registra contraseñas, tokens ni cuerpos |
| 2 | helmet | Cabeceras de seguridad; además desactivar `x-powered-by` |
| 3 | cors | Solo los orígenes de `CORS_ORIGINS`. Métodos GET, POST, PUT, PATCH, DELETE. Cabeceras permitidas Content-Type, Authorization y X-Correlation-Id. Sin credenciales (el token viaja en Authorization). Un origen no permitido no recibe cabeceras CORS |
| 4 | límite general | 429 con el formato de error de la sección 12 |
| 5 | exigir JSON | 415 si un POST, PUT o PATCH trae cuerpo que no es application/json |
| 6 | parser JSON | Con `JSON_LIMIT`. JSON mal formado: 400. Demasiado grande: 413 |
| 7 | sanitización global | Rechaza cuerpos que no sean objeto (400) y elimina claves `__proto__`, `constructor` y `prototype` en cualquier nivel |
| | rutas en `/api/v1` y `/api` | |
| último-1 | 404 | Ruta inexistente con el formato de error |
| último | manejador de errores | Sección 12 |

Por ruta:

| Middleware | Comportamiento |
|---|---|
| verificarToken | Lee `Authorization: Bearer <token>`, verifica firma, algoritmo HS256 y emisor. Vuelve a cargar el usuario desde la base en cada solicitud: si está inactivo o ya no tiene roles activos, 401 o 403 aunque el token no haya vencido. Deja en la solicitud los datos de la sección 9 |
| permitirRoles('admin' / 'user') | 403 si el grupo del rol no coincide |
| permitirCodigos('ADM', ...) | 403 si no tiene ninguno de esos códigos de rol |
| validar(reglas) | Corre las reglas de express-validator. Con errores, 400 con la lista de campos. Además rechaza con 400 cualquier campo del body que no tenga regla (`checkExact`), salvo en las rutas genéricas del panel. Los controladores leen solo los datos validados (`matchedData`), nunca `req.body` directo |
| paginar | Valida `page` y `limit` como enteros, aplica el máximo y calcula el salto. No modifica `req.query` (en Express 5 es de solo lectura) |
| límite de login | En login y registro, 10 intentos fallidos por ventana |
| límite de contacto | 5 mensajes por hora por IP |

## 9. Autenticación y roles

- Contraseñas con bcrypt (costo `BCRYPT_ROUNDS`, 12 por defecto). Nunca se guarda ni se devuelve la contraseña ni `claveHash`.
- Login: busca por `login` (correo en minúsculas). Si el correo no existe, igual compara contra un hash de relleno para que la respuesta tarde lo mismo. Mensaje único "Correo o contraseña incorrectos" (401). Actualiza `usr_ultimo_acceso`.
- Token JWT firmado con HS256, emisor `planeta-fitness-api`, `sub` = id del usuario, y en el contenido `login`, `rol` y `roles`. Vigencia `JWT_EXPIRES_IN`.
- Rol del reto: un usuario es `admin` si tiene al menos un rol activo (`usuario_rol.url_estado = 'A'`) cuyo `rol_tipo` es A; si no, es `user`. `roles` es la lista de códigos activos (ADM, REC, ENT, CON, CLI).
- Datos que `verificarToken` deja disponibles y que devuelve `/auth/me`: id, login, rol, roles, nombre (del cliente o del empleado vinculado), clienteId y empleadoId.
- Registro de clientes, en una sola transacción: crea el usuario, le asigna el rol CLI activo y crea el cliente con cédula, nombres, apellidos, teléfono, correo y nivel. Si la cédula ya existe en `cliente` sin cuenta web y su correo coincide, se vincula en lugar de crear; si no coincide o ya tiene cuenta, 409 con el mensaje "Esa cédula ya está registrada en el gimnasio. Acércate a recepción para activar tu cuenta web". La cédula 9999999999 no se acepta. Devuelve un token para que la persona quede con sesión.
- Validaciones del registro: cédula ecuatoriana con dígito verificador (módulo 10, provincia 01 a 24 o 30, tercer dígito menor que 6), nombres y apellidos de 2 a 60 letras, correo válido de hasta 120 caracteres, celular de 10 dígitos que empiece en 09, nivel existente, contraseña de 8 a 72 caracteres con letras y números.

## 10. Endpoints (contrato con el frontend)

Esta sección está copiada en el documento del frontend. Si hace falta cambiar una ruta, un campo o una forma de respuesta, avisar al equipo para que actualice los dos lados.

Todas las rutas existen con prefijo `/api` y `/api/v1`. En la columna Acceso, "user" es el rol CLI y "admin" cualquier rol administrativo. Desde la fase 2 lo administrativo ya no exige ADM en general: cada ruta pide un permiso `grupo:accion` de la matriz de `config/permisos.js` (ADM los tiene todos). `/auth/me` devuelve la lista `permisos` del usuario. Las rutas nuevas de la fase 2 están en la sección 10.4.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | /salud | Público | Comprueba API y base (503 si la base no responde) |
| POST | /auth/register | Público, límite de intentos | Registro de cliente (sección 9). 201 con sesión |
| POST | /auth/login | Público, límite de intentos | 200 con sesión |
| GET | /auth/me | JWT | Datos de la sesión |
| GET | /productos | Público | Catálogo paginado. Solo estado A y publicar web S. Filtro opcional `categoria` |
| GET | /productos/:id | Público | Un producto publicado; 404 si no existe o no se publica |
| POST | /productos | JWT admin | Crea producto. Si trae stock, entra por kárdex como inventario inicial |
| PUT | /productos/:id | JWT admin | Reemplaza datos editables. Si cambia el stock, se registra un ajuste en el kárdex |
| DELETE | /productos/:id | JWT admin | Baja lógica (estado I, no se publica). 204 |
| POST | /pedidos | JWT user o admin | Registra el pedido con sus detalles a partir del carrito |
| GET | /pedidos/mis-pedidos | JWT | Pedidos del usuario, paginados |
| GET | /pedidos | JWT admin | Todos los pedidos, paginados, filtro opcional `estado` |
| GET | /pedidos/:id | JWT dueño o admin | Un pedido. A un cliente que pide uno ajeno se le responde 404 |
| PATCH | /pedidos/:id/estado | JWT `pedidos:gestionar` | P→R (pago reportado, `refTransferencia`), P→C y R→C (convertir en venta, con `pagos`), C→E (entregado), P→X y R→X (cancelado). Cualquier otra transición: 409 |
| PATCH | /pedidos/:id/cancelar | JWT dueño | Cancela su pedido si sigue en P |
| GET | /membresias | Público | Planes activos que se publican en la web, con sus servicios |
| POST | /inscripciones | JWT user | Contrata un plan desde la web (inscripción pendiente de pago) |
| GET | /inscripciones/mis-inscripciones | JWT | Planes del cliente |
| GET | /clases | Público | Clases activas con instructor y horarios activos |
| GET | /entrenadores | Público | Empleados activos con cargo ENT y las clases que dictan |
| GET | /gimnasio | Público | Datos del gimnasio, horarios de atención, servicios activos y niveles |
| GET | /categorias, /metodos-pago, /niveles | Público | Catálogos para listas desplegables |
| GET | /aliados | Público | Profesionales aliados activos: solo nombre, teléfono, correo, consultorio y servicio (sin cédula ni comisión) |
| POST | /contacto | Público, 5 por hora | Guarda un mensaje de contacto en estado P |
| GET | /admin/resumen | JWT admin | Totales del dashboard |
| GET | /admin/productos | JWT admin | Productos incluidos inactivos, con datos internos (costo, stock mínimo, banderas) |
| POST | /admin/usuarios | JWT ADM | Crea una cuenta del personal: login, contraseña, roles y empleado a vincular |
| PATCH | /admin/usuarios/:id/estado | JWT ADM | Activa o desactiva una cuenta (no puede desactivarse a sí mismo) |
| GET | /admin/tablas | JWT admin | Lista de las 48 tablas con grupo y modo (crud o lectura) |
| GET | /admin/tablas/:tabla/meta | JWT admin | Columnas de la tabla (sección 10.3) |
| GET | /admin/tablas/:tabla/opciones | JWT admin | Valores para listas desplegables de claves foráneas (sección 10.3) |
| GET | /admin/tablas/:tabla | JWT admin | Filas paginadas, con filtros opcionales por igualdad |
| GET | /admin/tablas/:tabla/:id | JWT admin | Una fila. Clave compuesta separada con `~` (por ejemplo `usuario_rol/5~ADM`) |
| POST, PUT, DELETE | /admin/tablas/:tabla[/:id] | JWT ADM | Solo en tablas con modo crud |

### 10.1 Formas de las respuestas principales

Producto (público): id, nombre, descripcion, categoriaId, categoria (descripción), unidadMedidaId, contenido, talla, precio (sin IVA), porcentajeIva (el del gimnasio si paga IVA, si no 0), precioConIva, stock, disponible (estado A y stock mayor que 0), createdAt. En `/admin/productos` se agregan stockMin, costoPromedio, pagaIva, esContable, controlaCaducidad, diasAlertaCad, publicarWeb y estado.

Cuerpo para crear o editar producto: nombre, categoriaId y precio obligatorios; opcionales id (solo al crear), descripcion, unidadMedidaId (por defecto UND), contenido, talla, stock, stockMin, costoUnit, pagaIva, esContable, controlaCaducidad, diasAlertaCad, publicarWeb, estado, fechaCaducidad (AAAA-MM-DD, para el lote que entra) y motivoAjuste.

Pedido: id, userId, metodoPago, total, estado, estadoNombre (Pendiente de pago, Pago reportado, Pagado, Retirado, Cancelado), refTransferencia, createdAt, fechaRetiro, usuario (id y login, solo para admin) y detalles con id, pedidoId, productoId, nombre, cantidad, precioUnitario, porcentajeIva y subtotal.

Cuerpo para crear pedido: metodoPago (EF o TR), refTransferencia opcional (4 a 30 letras, números o guion), items con 1 a 30 elementos de productoId y cantidad (1 a 20). Cualquier otro campo, como un precio enviado por el carrito, no se usa.

Membresía: id, nombre, descripcion, tipo, duracion, unidadDuracion, numIngresos, personas, precio, porcentajeIva, precioConIva, incluyeRutina y beneficios (nombres de servicios).

Inscripción: id, membresiaId, plan, fechaInicio, fechaFin, ingresosTotal, valor, porcentajeIva, totalCobrar, canal, estado, createdAt.

Clase: id, nombre, descripcion, lugar, cupoMax, entrenador (id, nombre, especialidad) y horarios (id, dia, horaInicio, horaFin).

Entrenador: id (cédula), nombre completo, especialidad, claseIds.

Sesión (login y registro): token, tipo Bearer, expiraEn y usuario con los datos de la sección 9.

Resumen del admin: productosActivos, bajoStock (stock menor o igual al mínimo), pedidosPendientes (P y R), clientes activos, inscripcionesPendientes, mensajesPendientes.

### 10.2 Listas paginadas

Siempre con `data` y `pagination` (page, limit, total, totalPages), como en la guía.

### 10.3 Panel de tablas genérico

Sirve para que el frontend administre las tablas del modelo sin un endpoint por tabla.

- El repositorio genérico lee la estructura de cada modelo desde los metadatos de Prisma (`Prisma.dmmf`), así no hay que escribir 48 repositorios.
- La lista de tablas permitidas vive en la Factory. Cada tabla tiene grupo (los módulos de 6.2) y modo.
- Modo lectura (no se crean, editan ni borran desde el panel porque cambian con procesos o son sensibles): usuario (sin mostrar `claveHash`), inscripcion, inscripcion_cliente, suspension, asistencia_cliente, comision_aliado, producto (se administra con `/productos`), orden_compra, producto_ordencompra, lote_producto, kardex, pedido, pedido_detalle, venta, detalle_venta, factura, pago, cierre_caja, cuadre_turno, movimiento_caja y notificacion. Las demás son crud.
- `meta` devuelve: modelo, tabla, modo, idCampos y por cada columna nombre, tipo (String, Int, Decimal, DateTime), requerido, esId, autoincremental, longitud máxima y referencia (la tabla a la que apunta si es clave foránea).
- `opciones` devuelve una lista de valor y texto para llenar listas desplegables: valor es el id (o la clave compuesta con `~`) y texto es la primera columna descriptiva (nombre, descripción, login o apellido junto al nombre).
- Al crear o editar, el repositorio solo acepta columnas reales de la tabla, ignora ids autoincrementales y campos ocultos, convierte tipos, revisa longitudes y obligatorios, y quita `<` y `>` de los textos. Los CHECK de la base son la última defensa.
- Filtros por igualdad en la lista (`?estado=P&canal=W`): solo sobre columnas que existan en la tabla; cualquier otro parámetro aparte de page y limit da 400.
- Un nombre de tabla que no está en la lista da 404 (incluidos `__proto__` y `constructor`).
- Permisos por tabla: cada tabla se lee con el permiso de su grupo (por ejemplo `clientes:leer`) o con `tablas:leer` (CON), y se escribe solo con `tablas:escribir` (ADM).

### 10.4 Endpoints de la fase 2

Contrato copiado de `BACKEND_FASE2.md` sección 5. Todas piden JWT salvo `/tareas/diarias`. Las listas aceptan `page` y `limit`. Los rechazos de reglas de negocio son 409 con un mensaje para mostrar tal cual. Los cobros reciben `pagos`: uno o dos elementos con `metodoPago` (EF o TR), `monto` y `referencia` (obligatoria en TR); la suma tiene que ser exactamente el total que calcula el servidor (si no, 400 con el total esperado) y hace falta una caja abierta (si no, 409).

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | /admin/usuarios | `usuarios:gestionar` | Cuentas con roles y empleado o cliente vinculado |
| PUT | /admin/usuarios/:id | `usuarios:gestionar` | Cambiar correo o contraseña |
| PUT | /admin/usuarios/:id/roles | `usuarios:gestionar` | Reemplaza los roles activos (`roles`). Quitar es poner I; no deja una cuenta sin roles ni quita ADM a uno mismo |
| GET, PUT | /admin/gimnasio, /admin/gimnasio/horario | `gimnasio:leer` / `gimnasio:editar` | Datos tributarios, aforo, IVA y horario de atención |
| POST | /admin/personal/asistencia/entrada, /salida | `asistencia:marcar` | Marca la propia; ADM puede enviar `empleadoId` |
| PATCH | /admin/personal/asistencia/:id | `asistencia:gestionar` | Corrige horas u observación (ADM) |
| GET | /admin/personal/asistencia | `asistencia:reporte` | Atrasos y faltas por rango (`desde`, `hasta`, `empleadoId`) |
| GET, POST, PUT | /admin/clientes, /admin/clientes/:cedula | `clientes:leer` / `clientes:editar` | Lista con `buscar`, crear y editar (CONSUMIDOR FINAL no se edita) |
| GET | /admin/clientes/:cedula/historial | `clientes:leer` | Inscripciones, entradas, ventas, pedidos, pagos y facturas |
| GET | /admin/clientes/:cedula/acceso | `entradas:gestionar` | Inscripciones activas y clases de hoy para recepción |
| GET, POST | /admin/inscripciones | `inscripciones:leer` / `inscripciones:gestionar` | Lista con filtros; inscribir y cobrar en el local |
| GET | /admin/inscripciones/:id | `inscripciones:leer` | Detalle con integrantes, pagos, entradas, suspensiones y factura |
| POST | /admin/inscripciones/:id/cobrar | `inscripciones:gestionar` | Cobra una inscripción web pendiente |
| POST, DELETE | /admin/inscripciones/:id/integrantes[/:cedula] | `inscripciones:gestionar` | Agregar o quitar acompañante |
| POST | /admin/inscripciones/:id/renovar | `inscripciones:gestionar` | Renueva para el mismo titular y acompañantes |
| POST | /admin/inscripciones/:id/suspensiones | `inscripciones:gestionar` | Suspensión médica (`fechaInicio`, `fechaFin`, `motivo`, `certificado`) |
| PATCH | /admin/suspensiones/:id/anular | `inscripciones:anular` + ADM activo | Anula la suspensión y resta sus días (`motivo`) |
| PATCH | /admin/inscripciones/:id/anular | `inscripciones:anular` + ADM activo | Anula la inscripción y sus suspensiones (`motivo`) |
| POST | /admin/entradas | `entradas:gestionar` | Registrar entrada (cliente, inscripción, clase y horario opcionales) |
| PATCH | /admin/entradas/:id/salida | `entradas:gestionar` | Registrar salida |
| GET | /admin/entradas | `entradas:gestionar` | Entradas de un día (`fecha`, `abiertas=S`) |
| GET | /admin/aforo | `aforo:ver` | Personas adentro y aforo máximo |
| GET, POST, PUT | /admin/rutinas, /admin/rutinas/:id | `rutinas:leer` / `rutinas:gestionar` | El entrenador ve y edita solo las suyas |
| GET | /rutinas/mi-rutina | JWT cliente | Rutina vigente del cliente (404 si no tiene) |
| POST | /admin/caja/turnos | `caja:operar` | Abrir turno con saldo inicial |
| GET | /admin/caja/turnos/actual, /admin/caja/turnos[/:id] | `caja:operar` o `caja:leer` | Turno abierto con totales en vivo; cuadres por rango |
| POST | /admin/caja/movimientos | `caja:operar` | Gasto (EGR) o devolución (DEV) manual |
| PATCH | /admin/caja/turnos/:id/cuadre | `caja:operar` | Cierra el turno con `efectivoContado` |
| GET, POST | /admin/caja/cierres | `caja:leer` / `caja:cierre` | Cierre semanal (CON) |
| GET, POST | /admin/ventas, /admin/ventas/:id | `ventas:leer` / `ventas:crear` | Venta en mostrador, lista y detalle |
| PATCH | /admin/ventas/:id/anular | `ventas:anular` + ADM activo | Anular venta (`motivo`) |
| GET, POST | /admin/facturas, /admin/facturas/:id | `facturas:leer` / `facturas:generar` | Generar factura (`ventaId`, `inscripcionId` o ambos, `clienteId` opcional) |
| PATCH | /admin/facturas/:id/sri | `facturas:sri` | Número `001-001-000000123` y clave de acceso de 49 dígitos |
| GET | /admin/facturas/por-anular | `facturas:sri` | Facturas emitidas de operaciones anuladas |
| PATCH | /admin/facturas/:id/anular | `facturas:sri` | Marcar anulada en el SRI |
| POST | /admin/inventario/entradas | `inventario:gestionar` | Recibir mercadería sin orden (COM) |
| POST | /admin/inventario/ajustes | `inventario:gestionar` | Ajuste positivo o negativo con observación |
| POST | /admin/inventario/lotes/:id/baja | `inventario:gestionar` | Baja por caducidad (CAD) |
| PATCH | /admin/inventario/lotes/:id/bloqueo | `inventario:gestionar` | Bloquear (B) o desbloquear (D) |
| GET | /admin/inventario/lotes, /admin/inventario/kardex/:productoId | `inventario:leer` | Lotes (`productoId`, `estado`, `porCaducar=S`) y kárdex |
| GET, PUT | /admin/productos/:id/proveedores | `inventario:leer` / `inventario:gestionar` | Proveedores del producto |
| GET, POST | /admin/compras, /admin/compras/:id | `compras:leer` / `compras:gestionar` | Órdenes de compra con líneas |
| PATCH | /admin/compras/:id/autorizar | `compras:gestionar` + ADM activo | P → A |
| PATCH | /admin/compras/:id/anular | `compras:gestionar` | Solo sin recepciones (P o A) |
| POST | /admin/compras/:id/recepciones | `compras:gestionar` | Recibir con cantidades, costos y caducidades por línea |
| POST | /admin/aliados/:cedula/comisiones | `aliados:cobrar` | Cobrar comisión de un periodo |
| GET | /admin/aliados/comisiones | `aliados:leer` | Pagados y pendientes por mes (`desde`, `hasta`, `cedula`) |
| GET | /admin/mensajes | `mensajes:gestionar` | Bandeja con `estado` y número de pendientes |
| PATCH | /admin/mensajes/:id/respondido | `mensajes:gestionar` | Marcar respondido con el empleado que atendió |
| GET | /notificaciones | JWT | Avisos del usuario (cliente o empleado), `noLeidas=S`, devuelve `noLeidas` |
| PATCH | /notificaciones/:id/leida | JWT | Marcar leída (solo las propias; ajenas dan 404) |
| POST | /tareas/diarias | Cabecera `X-Tarea-Token` | Tarea diaria (sección 11). 503 si falta `TAREAS_TOKEN` en el servidor |
| GET | /admin/reportes/clientes, /entradas | `reportes:clientes` / `reportes:entradas` (REC) o `reportes:todos` | Activos, por vencer y vencidos; entradas por día, por hora y pico frente al aforo |
| GET | /admin/reportes/ventas, /ganancia, /inventario, /inscripciones, /caja, /comisiones | `reportes:todos` | Con `desde` y `hasta` (por defecto los últimos 30 días, máximo un año). `?formato=csv&seccion=` devuelve una de sus listas en CSV |

## 11. Reglas de negocio

Inventario (servicio de inventario):

- Entrada (COM o AJP): crea un lote, calcula el costo promedio ponderado, escribe el movimiento en kárdex con saldo de cantidad, costo promedio y saldo de valor, y actualiza stock y costo promedio del producto. Si el producto controla caducidad, la fecha de caducidad del lote es obligatoria.
- Salida (VEN, AJN o CAD): toma lotes disponibles y no vencidos, en orden FEFO si `metodo_salida` es E o FIFO si es F, al costo promedio vigente. Un lote que llega a cero pasa a estado A. Si no alcanza, 409.
- Antes de calcular, bloquea la fila del producto dentro de la transacción (`SELECT ... FOR UPDATE`).
- Solo productos con `es_contable = 'S'` entran al kárdex.
- Ajustes y bajas llevan observación obligatoria.

Productos:

- Si `controla_caducidad` es S: `metodo_salida` E y días de alerta obligatorios (30 por defecto). Si es N: `metodo_salida` F y días de alerta nulos.
- Crear con stock mayor que cero exige que el admin tenga empleado vinculado (el kárdex necesita `emp_cedula`); si no, 403 con un mensaje claro.
- DELETE es baja lógica.

Pedidos:

- Precio unitario e IVA salen siempre de la base, nunca del carrito. IVA de la línea: el del gimnasio si el producto paga IVA, si no 0.
- Total = suma de ROUND(cantidad × precio × (1 + IVA/100), 2).
- Si el carrito repite un producto, se suman las cantidades (UNIQUE pedido + producto).
- Solo productos activos y publicados en la web; si no, 400 indicando el producto.
- Se verifica que alcance el stock (409 con productoId y disponible), pero no se descuenta: en el modelo el stock sale cuando el pedido se cobra y se convierte en venta.
- Con TR y número de comprobante, el pedido nace en estado R con fecha de reporte. Sin comprobante, en P.
- Todo en una transacción.

Inscripciones web:

- Solo cuentas con cliente vinculado. Plan activo y publicado.
- Si el cliente ya tiene una inscripción en P como titular, 409.
- Se copian precio base, descuento 0, valor e IVA (0 si el plan no paga IVA). Canal W, estado P, empleado nulo. El cliente queda como titular en `inscripcion_cliente`.
- Fecha de inicio: la enviada (no puede ser pasada) o hoy según la hora de Ecuador. Fin para planes por tiempo: unidad D, inicio + duración − 1 día; unidad M, inicio + duración meses − 1 día (31 de enero + 1 mes = último día de febrero). Planes por ingresos: sin fecha de fin y con los ingresos del plan.

Fechas: las columnas DATE se arman con el día local de Ecuador (UTC−5) para que una compra a las 20:00 no quede con la fecha del día siguiente.

Reglas de la fase 2 (cada proceso de varias tablas va en una transacción; montos con `Prisma.Decimal`, calculados en el servidor):

- Operaciones con `emp_cedula`: usan el empleado de la cuenta; sin empleado vinculado, 403. Las "solo ADM" (anular venta, inscripción o suspensión, autorizar promoción u orden de compra) exigen además empleado activo con cuenta activa y ADM activo.
- Pedidos: pasar a C es convertir en venta (venta canal W, líneas con el precio e IVA del pedido, salida VEN por lote FEFO/FIFO, pago y movimiento de caja). Si ya no alcanza el stock, 409 y el pedido queda igual. Pasar a E guarda la fecha de retiro y crea el aviso "pedido listo" (tipo L).
- Caja: un turno por turno y día; queda abierto mientras `efectivoContado` sea nulo. Cada pago y cada comisión cobrada crea su ING en el turno abierto. El cuadre exige el efectivo contado (A2) y guarda la diferencia. Las devoluciones por transferencia no salen del efectivo ni restan `ctu_total_transf`, que es el ingreso bruto por transferencias; se informan aparte (A1). Un cierre semanal no se solapa con otro, solo toma cuadres contados, y después nada de ese periodo se modifica (409).
- Inscripciones en el local: se crean y se cobran en la misma transacción. Una promoción que pide autorización necesita la cédula de un ADM activo. Acompañantes sin superar las personas del plan; a lo sumo un titular. Renovar empieza el día siguiente al fin si sigue activa, o hoy.
- Suspensión médica: solo planes por tiempo, con certificado, sin solaparse con otra aplicada; suma los días a la fecha de fin. Si empieza hoy, la inscripción pasa a S; la tarea diaria la pasa a S o la devuelve a A según las fechas. Anularla (ADM) resta los días.
- Anular inscripción (ADM): solo sin entradas. Anula los pagos con su devolución DEV, deja la factura para anular en el SRI y anula también sus suspensiones aplicadas (A4).
- Entradas: inscripción activa y vigente, la persona es integrante, sin otra entrada abierta, quedan ingresos, no se supera el aforo; si va a una clase, el plan incluye el servicio, la clase y el horario están activos, el día coincide y hay cupo. El pase diario rechaza cualquier clase (A3). La última entrada de una tarjeta la pasa a V.
- Ventas en mostrador: descuento por línea sin superar la línea. Anular devuelve las unidades al mismo lote (ANV), anula los pagos con su DEV, deja la factura por anular y, si venía de un pedido, el pedido pasa a X.
- Facturas: una por venta o inscripción; número del SRI y clave de acceso únicos.
- Compras: la orden nace en P con el monto calculado; ADM la autoriza (A). Cada recepción crea lotes ligados a la orden (entrada COM) y la orden pasa a M (parcial) o R (completa). Solo se anula sin recepciones.
- Rutinas: solo para clientes con una inscripción activa en un plan con rutina. El entrenador ve y edita solo las suyas.
- Comisiones de aliados: periodo sin solaparse con otro del mismo aliado (bloqueo del aliado); el monto por defecto es el valor de comisión vigente; crea el ingreso en caja.
- Asistencia del personal: una entrada por empleado y día; la salida va después. Atraso: entrada después del inicio del turno. Falta: día abierto (según el horario de atención) sin registro, sin contar hoy.
- Tarea diaria (`POST /tareas/diarias`, la llama el workflow `tarea-diaria.yml` a las 05:00 de Ecuador): se puede correr varias veces el mismo día sin duplicar nada (candado `pg_advisory_xact_lock` y búsqueda previa de cada aviso). Pasa a S o A las inscripciones según sus suspensiones, a V las inscripciones por tiempo vencidas, a C los lotes caducados (con alerta K a los ADM si les quedan unidades), crea avisos V al cliente (membresía que vence en 3 días o tarjeta con 3 ingresos o menos, uno por inscripción y persona), alertas K de lotes dentro de los días de alerta del producto y alertas S de stock mínimo (una mientras la anterior siga sin leer, como máximo una por día). Devuelve un resumen. Las notificaciones usan el canal S (sistema interno) y nacen en estado E; al leerlas pasan a L.

## 12. Respuestas de error y códigos HTTP

Todo error responde con: status ("error"), mensaje, correlationId y, cuando ayuda, detalles (en validación, una lista de campo y mensaje). Nunca stack traces, SQL ni detalles de infraestructura; eso va solo al log.

Errores de Prisma que hay que traducir: P2002 (valor único repetido) a 409, P2003 (registro relacionado) a 409, P2025 (no existe) a 404, error de validación de Prisma a 400 y error de conexión a 503.

| Código | Cuándo |
|---|---|
| 200 | Consultas y actualizaciones |
| 201 | Creaciones (con cabecera Location en productos y pedidos) |
| 204 | DELETE sin cuerpo |
| 400 | Validación, JSON mal formado, campo no permitido, regla de negocio |
| 401 | Sin token, token vencido o inválido, credenciales incorrectas, cuenta inactiva |
| 403 | Rol sin permiso, tabla de solo lectura, admin sin empleado para el kárdex |
| 404 | Ruta o recurso inexistente, pedido ajeno |
| 409 | Duplicados, stock insuficiente, inscripción pendiente, relación que impide borrar |
| 413 | Cuerpo demasiado grande |
| 415 | Cuerpo que no es JSON |
| 429 | Límite de solicitudes |
| 500 | Error inesperado (mensaje genérico) |
| 503 | Base de datos no disponible |

## 13. Seguridad para el README (OWASP Top 10)

El agente debe dejar en el README esta tabla (el reto pide al menos tres):

| Riesgo | Mitigación en el sistema |
|---|---|
| A01 Pérdida de control de acceso | JWT obligatorio, permitirRoles y permitirCodigos, roles releídos de la base en cada solicitud, pedidos ajenos responden 404, contrato estricto que rechaza campos como `rol` en el registro |
| A02 Fallas criptográficas | bcrypt, `claveHash` nunca sale de la API, secreto JWT largo en `.env`, algoritmo fijo al verificar, HTTPS opcional |
| A03 Inyección | Prisma con consultas parametrizadas, Factory con lista blanca de tablas, limpieza de `__proto__` |
| A05 Configuración incorrecta | helmet, CORS solo con los orígenes del frontend, errores sin stack trace, límite de tamaño del JSON |
| A07 Fallas de autenticación | Límite de intentos en login y registro, mismo mensaje y tiempo exista o no el correo, tokens con vencimiento, contraseñas con letras y números |

## 14. Pruebas

Pruebas de integración con node:test y supertest sobre `app.js` (con la base migrada y el seed cargado). Deben existir y pasar:

1. Login admin devuelve token y rol admin.
2. Admin crea un producto (201) y el stock enviado se refleja.
3. Login user y crear producto: 403.
4. Catálogo público sin token: 200 con data y pagination.
5. User confirma un pedido (201) y la fila existe en pedido y pedido_detalle.
6. Admin ve todos los pedidos (200); user en la misma ruta, 403.
7. Sin token en mis pedidos: 401. JSON roto: 400. Cuerpo en texto plano: 415. Campo extra en el login: 400.
8. Un precio enviado dentro de un item del carrito no cambia el total: se usa el de la base.
9. Pedido con más cantidad que el stock: 409.
10. Panel: escribir en `kardex` por la ruta genérica responde 403; pedir la tabla `__proto__`, 404.

Además, `pruebas.http` (extensión REST Client o importable en Postman) con las peticiones de evidencia del reto, en este orden: salud, login admin, crear producto, login user, crear producto con user (403), catálogo, confirmar pedido, mis pedidos, todos los pedidos con admin, todos los pedidos con user (403), sin token (401), registro, inscripción, lista de tablas.

## 15. HTTPS opcional (puntos extra)

Si `HTTPS=true`, `server.js` levanta HTTPS con el certificado y la llave de `.env`. En el README explicar cómo generarlos con mkcert o con OpenSSL (self-signed) en la carpeta `certs/`, que está en `.gitignore`.

## 16. Fuera de alcance por ahora

La lista anterior quedó anulada por la fase 2 (`BACKEND_FASE2.md`): todos esos procesos ya están construidos (sección 10.4 y reglas de la sección 11). Lo que sigue fuera de alcance:

- Imagen del comprobante de transferencia: mientras el equipo no decida (fase 2, sección 7), se usa el número de comprobante obligatorio; `pedido.comprobante` queda listo para recibir una URL de un servicio externo.
- Envío de notificaciones por WhatsApp o correo (canales W y C). Hoy solo se usa el canal S (sistema interno).
- Notificaciones de promociones (tipo P): la tabla lo admite, pero no hay proceso que las cree.

## 17. Orden de trabajo y cómo comprobar cada paso

| Paso | Qué hacer | Cómo se comprueba |
|---|---|---|
| 1 | Crear `server/`, package.json con las dependencias y scripts de la sección 4, `.env.example`, `.gitignore` | `npm install` sin errores |
| 2 | config, utils, app.js con los middleware globales, ruta /salud, server.js con cierre ordenado | `npm run dev` arranca en 5050; /salud responde (503 si aún no hay base) |
| 3 | `schema.prisma` con las 48 tablas, siguiendo 6.1 a 6.5 | `npx prisma validate` pasa; `prisma migrate dev --name init` crea 48 tablas y ninguna extra; los nombres de tablas y columnas coinciden con el diccionario |
| 4 | Migración de CHECK e índice parcial (6.6) | Un INSERT con un valor fuera de la lista falla en la base |
| 5 | Seed (6.8) | `prisma db seed` corre dos veces seguidas sin duplicar; `prisma studio` muestra los datos |
| 6 | Auth: repositorios de usuario y cliente, servicio, validadores, rutas, verificarToken y roles | Login admin y cliente, registro, /auth/me, 401 y 403 |
| 7 | Productos con servicio de inventario | CRUD con admin; 403 con user; el kárdex registra el inventario inicial y los ajustes |
| 8 | Pedidos | Crear, mis pedidos, todos, cambio de estado, cancelar |
| 9 | Público: membresías, inscripciones, clases, entrenadores, gimnasio, catálogos, aliados, contacto | Cada endpoint responde con la forma de 10.1 |
| 10 | Panel: resumen, admin productos, usuarios del personal, tablas genéricas | Lista de tablas, meta, opciones, CRUD en una tabla crud, 403 en una de lectura |
| 11 | Pruebas de la sección 14 y `pruebas.http` | `npm test` pasa |
| 12 | README del backend: instalación, base, migraciones, seed, ejecución, endpoints y roles, seguridad, capturas | Revisión con la lista de la sección 18 |

## 18. Lista final contra el reto

- [ ] Carpetas `routes`, `controllers`, `models`, `middleware`, `prisma` con separación real de responsabilidades.
- [ ] Prisma con PostgreSQL, schema y migraciones incluidos en la entrega.
- [ ] Tablas mínimas del reto presentes: producto (id, nombre, precio, stock, createdAt), usuario (id, login, passwordHash, rol), pedido (id, userId, total, createdAt), pedido_detalle (id, pedidoId, productoId, cantidad, precioUnitario).
- [ ] El pedido final se guarda en la base; el carrito no.
- [ ] Endpoints de auth, productos y pedidos con los roles que pide el reto.
- [ ] JWT en Authorization Bearer; rutas protegidas por rol.
- [ ] CORS solo con el origen del frontend, nunca `*` en producción.
- [ ] bcrypt; ninguna contraseña en texto plano.
- [ ] Validación de body y params, sanitización de textos, errores consistentes sin stack trace.
- [ ] Middleware de errores centralizado, logger, async/await con manejo de errores.
- [ ] `.env.example` presente y `.env` fuera de la entrega.
- [ ] Panel con acceso a todas las tablas.
- [ ] Pruebas mínimas del reto pasando.
- [ ] README con descripción, arquitectura, ejecución, endpoints y roles, OWASP y capturas.
