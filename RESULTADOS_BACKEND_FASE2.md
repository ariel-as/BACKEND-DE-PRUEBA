# Resultados BACKEND fase 2

## Pasos

| Paso | Estado | Commit | Pruebas (base local) |
|---|---|---|---|
| 1 Pedidos sin descuento de stock + script de reparación | Hecho | 22b57f2 | 24/24 |
| 2 Matriz de permisos, `permisos` en /auth/me, cuentas por rol, CORS | Hecho | 4bde42e | 32/32 |
| 3 Seguridad (4.1) y gimnasio (4.2) | Hecho | c0614fe | 40/40 |
| 4 Caja (4.9) | Hecho | 014d849 | 48/48 |
| 5 Pedidos: convertir en venta y entregar (4.10) | Hecho | b5db654 | 55/55 |
| 6 Clientes (4.4) e inscripciones en el local (4.6) | Hecho | 1a89678 | 65/65 |
| 7 Entradas y aforo (4.7) | Hecho | 20e8f0f | 76/76 |
| 8 Ventas (4.11) y facturación (4.12) | Hecho | cdd03d1 | 84/84 |
| 9 Inventario (4.13 sin compras) | Hecho | 3ec5e10 | 92/92 |
| 10 Tarea diaria y workflow (4.15), notificaciones (4.14) | Hecho, salvo correr el workflow a mano (ver abajo) | 550c3c9 (+ e8d84de, corrección del YAML) | 99/99 |
| 11 Reportes de prioridad 2 (4.16) | Hecho | 4c13206 | 107/107 |
| 12 Prioridad 3: asistencia, suspensiones, anulación de inscripción (A4), promociones con autorización, compras, rutinas, aliados, contacto y reporte de comisiones | Hecho | fa1bb2d | 115/115 |
| 13 BACKEND.md (10, 11 y 16), README y colección de Thunder Client | Hecho (pendiente la revisión del equipo) | ee0df7f | 115/115 (sin cambios de código) |

Despliegue: CI en verde y `/api/v1/salud` responde 200 en Render en cada paso. Además se comprobó que las rutas nuevas de cada paso responden 401 sin token, es decir, que ya están desplegadas (las de inventario del paso 9 quedaron comprobadas con los despliegues siguientes).

Pendiente del paso 10: correr el workflow `Tarea diaria` a mano desde Actions. Para eso hay que poner `TAREAS_TOKEN` en Render (Environment del servicio) y el mismo valor como secreto `TAREAS_TOKEN` del repositorio. No lo hice porque cambia la configuración de Render y de GitHub, y porque la tarea modifica datos de la base de Render (estados de inscripciones y lotes, notificaciones). La tarea se probó contra la base local: la primera corrida vence inscripciones, caduca lotes y crea avisos; la segunda no duplica nada. Mientras falten el secreto o la variable, el workflow termina con un error claro (secreto faltante, o 503 de la API). Hoy Render responde 503 en `POST /tareas/diarias`, lo que confirma que la variable todavía no está puesta.

El workflow falló en los pushes de los pasos 10 a 13 por un error de sintaxis YAML (un `: ` dentro de un valor sin comillas). Se corrigió en e8d84de. Esos fallos no afectaron a CI ni al despliegue.

## Endpoints de la sección 5

| Método | Ruta | Estado | Paso |
|---|---|---|---|
| GET | /auth/me (con `permisos`) | Hecho | 2 |
| GET | /admin/usuarios | Hecho | 3 |
| PUT | /admin/usuarios/:id | Hecho | 3 |
| PUT | /admin/usuarios/:id/roles | Hecho | 3 |
| GET, PUT | /admin/gimnasio | Hecho | 3 |
| GET, PUT | /admin/gimnasio/horario | Hecho | 3 |
| POST | /admin/personal/asistencia/entrada | Hecho | 12 |
| POST | /admin/personal/asistencia/salida | Hecho | 12 |
| GET | /admin/personal/asistencia | Hecho | 12 |
| GET | /admin/clientes | Hecho | 6 |
| POST, PUT | /admin/clientes, /admin/clientes/:cedula | Hecho | 6 |
| GET | /admin/clientes/:cedula/historial | Hecho | 6 |
| GET | /admin/clientes/:cedula/acceso | Hecho | 7 |
| POST | /admin/inscripciones | Hecho | 6 |
| GET | /admin/inscripciones | Hecho | 6 |
| GET | /admin/inscripciones/:id | Hecho | 6 |
| POST | /admin/inscripciones/:id/cobrar | Hecho | 6 |
| POST | /admin/inscripciones/:id/integrantes | Hecho | 6 |
| DELETE | /admin/inscripciones/:id/integrantes/:cedula | Hecho | 6 |
| POST | /admin/inscripciones/:id/renovar | Hecho | 6 |
| POST | /admin/inscripciones/:id/suspensiones | Hecho | 12 |
| PATCH | /admin/suspensiones/:id/anular | Hecho | 12 |
| PATCH | /admin/inscripciones/:id/anular | Hecho | 12 |
| POST | /admin/entradas | Hecho | 7 |
| PATCH | /admin/entradas/:id/salida | Hecho | 7 |
| GET | /admin/entradas | Hecho | 7 |
| GET | /admin/aforo | Hecho | 7 |
| GET, POST, PUT | /admin/rutinas, /admin/rutinas/:id | Hecho | 12 |
| GET | /rutinas/mi-rutina | Hecho | 12 |
| POST | /admin/caja/turnos | Hecho | 4 |
| GET | /admin/caja/turnos/actual | Hecho | 4 |
| POST | /admin/caja/movimientos | Hecho | 4 |
| PATCH | /admin/caja/turnos/:id/cuadre | Hecho | 4 |
| GET | /admin/caja/turnos | Hecho | 4 |
| POST | /admin/caja/cierres | Hecho | 4 |
| GET | /admin/caja/cierres | Hecho | 4 |
| PATCH | /pedidos/:id/estado (transiciones nuevas) | Hecho | 1 y 5 |
| POST | /admin/ventas | Hecho | 8 |
| GET | /admin/ventas, /admin/ventas/:id | Hecho | 8 |
| PATCH | /admin/ventas/:id/anular | Hecho | 8 |
| POST | /admin/facturas | Hecho | 8 |
| GET | /admin/facturas, /admin/facturas/:id | Hecho | 8 |
| PATCH | /admin/facturas/:id/sri | Hecho | 8 |
| GET | /admin/facturas/por-anular | Hecho | 8 |
| PATCH | /admin/facturas/:id/anular | Hecho | 8 |
| POST | /admin/inventario/entradas | Hecho | 9 |
| POST | /admin/inventario/ajustes | Hecho | 9 |
| POST | /admin/inventario/lotes/:id/baja | Hecho | 9 |
| PATCH | /admin/inventario/lotes/:id/bloqueo | Hecho | 9 |
| GET | /admin/inventario/lotes | Hecho | 9 |
| GET | /admin/inventario/kardex/:productoId | Hecho | 9 |
| GET, PUT | /admin/productos/:id/proveedores | Hecho | 9 |
| POST | /admin/compras | Hecho | 12 |
| GET | /admin/compras, /admin/compras/:id | Hecho | 12 |
| PATCH | /admin/compras/:id/autorizar | Hecho | 12 |
| PATCH | /admin/compras/:id/anular | Hecho | 12 |
| POST | /admin/compras/:id/recepciones | Hecho | 12 |
| POST | /admin/aliados/:cedula/comisiones | Hecho | 12 |
| GET | /admin/aliados/comisiones | Hecho | 12 |
| GET | /admin/mensajes | Hecho | 12 |
| PATCH | /admin/mensajes/:id/respondido | Hecho | 12 |
| GET | /notificaciones | Hecho | 10 |
| PATCH | /notificaciones/:id/leida | Hecho | 10 |
| POST | /tareas/diarias | Hecho | 10 |
| GET | /admin/reportes/clientes | Hecho | 11 |
| GET | /admin/reportes/entradas | Hecho | 11 |
| GET | /admin/reportes/ventas | Hecho | 11 |
| GET | /admin/reportes/ganancia | Hecho | 11 |
| GET | /admin/reportes/inventario | Hecho | 11 |
| GET | /admin/reportes/inscripciones | Hecho | 11 |
| GET | /admin/reportes/caja | Hecho | 11 |
| GET | /admin/reportes/comisiones | Hecho | 12 |

Extra, fuera del contrato: `PATCH /admin/personal/asistencia/:id` para que ADM corrija un registro (la matriz dice "ADM marca y corrige la de todos").

## Script de reparación (modo de prueba, base local)

`npm run reparar:pedidos` (sin `--aplicar`). No se ejecutó en Render ni se aplicó en ninguna base.
- 4 movimientos VEN sin venta (pedidos 7, 8, 9 y 10): devolvería 1 u. a cada lote con ANV.
- 2 productos con `prd_stock` 1 unidad menor que sus lotes sin movimiento VEN (pedidos anteriores al kárdex). El último saldo del kárdex coincide con los lotes, así que el script corregiría `prd_stock`.
- Verificación proyectada: 19 de 19 productos con stock igual a la suma de sus lotes.
- Para Render: correr primero sin `--aplicar`, revisar el resultado y aplicar solo con autorización.

## B01, B02 y A1–A4

- B01: ningún controlador importa Prisma. Las consultas están en repositorios de `models/` y las transacciones en `services/`. Se comprobó con una búsqueda al terminar el paso 12.
- B02: resuelto. Crear un pedido ya no descuenta stock, así que cancelarlo no tiene nada que devolver.
- A1: `ctu_total_transf` es el ingreso bruto por transferencia. Las devoluciones TR se informan aparte (`devolucionesTransf`) y no salen del efectivo. Sin cambiar la base.
- A2: el cuadre exige `efectivoContado` (en el validador y en el servicio).
- A3: una entrada con el pase diario (plan T de 1 día) rechaza cualquier clase.
- A4: al anular una inscripción se anulan en la misma transacción sus suspensiones aplicadas (estado X, con el empleado, la fecha y el motivo "Anulación de la inscripción N: …"). Probado en `tests/prioridad3.test.js`.

Ningún cambio exigió tocar tablas ni columnas.

## Cuentas de prueba agregadas al seed

recepcion@planetafitness.ec, entrenador@planetafitness.ec y contadora@planetafitness.ec. En producción, las contraseñas salen de SEED_RECEPCION_PASSWORD, SEED_ENTRENADOR_PASSWORD y SEED_CONTADORA_PASSWORD. El seed no corre solo en Render.

## render.yaml

- `CORS_ORIGINS` pasó de `https://planeta-fitness-api.onrender.com` a `https://ariel-as.github.io`. El servicio en Render ya respondía `Access-Control-Allow-Origin: https://ariel-as.github.io`.
- Se agregó `TAREAS_TOKEN` con `sync: false`: el valor se pone a mano en Render y no se guarda en Git.

## Decisiones y dudas para el equipo

Pasos 1 a 9:
- Las transiciones no permitidas de pedidos responden 409 (antes 400).
- El repuesto ANV del script no lleva `ven_numero` porque esos movimientos nunca tuvieron venta.
- REC tiene `ventas:leer` y `caja:leer` para ver lo que registra. ENT ve en el panel solo sus clases.
- Al cobrar una inscripción web cuya fecha de inicio ya pasó, el inicio se corre a hoy.
- Al anular una venta de un pedido entregado, el pedido pasa a X y pierde la fecha de retiro (lo exige el CHECK).
- Se agregó el cargo REC al seed y los planes PDI (pase diario) y TAR (tarjeta de 30 ingresos).

Pasos 10 a 13:
- Notificaciones: se crean con canal S y estado E (enviada al sistema interno); al leerlas pasan a L.
- Aviso de tarjeta por agotarse: usa el tipo V (el diccionario lo define como "membresía por vencer o tarjeta por agotarse"). Hay un solo aviso V por inscripción y persona, y se avisa a todos los integrantes, no solo al titular.
- Alerta de stock mínimo: no se repite mientras la anterior siga sin leer, y como máximo sale una por día. La alerta de lote caducado solo sale si al lote le quedan unidades. Un lote bloqueado (B) con la fecha cumplida también pasa a C.
- Suspensiones y estado S: si la suspensión empieza hoy, la inscripción pasa a S. La tarea diaria la pasa a S o la devuelve a A según las fechas. La suspensión tiene que empezar hoy o después, y antes del fin de la membresía.
- `/tareas/diarias` tiene un límite de 10 llamadas por hora y usa un candado de PostgreSQL para que dos corridas al mismo tiempo no dupliquen nada.
- Prioridad de los reportes (el documento no la separa): consideré de prioridad 2 los de clientes, entradas, ventas, ganancia, inventario, inscripciones y caja (paso 11), y de prioridad 3 el de comisiones, porque los aliados son prioridad 3 (paso 12).
- Reportes:
  - El rango por defecto son los últimos 30 días (7 en el de entradas) y el máximo un año.
  - La "ocupación frente al aforo" es el pico de personas adentro al mismo tiempo cada día. Las entradas sin salida cuentan hasta el fin del día.
  - Los ingresos por inscripciones salen de los pagos vigentes, según su fecha de pago.
  - Con `?formato=csv` se descarga una sola lista del reporte, la que se indique con `seccion=`.
- Asistencia: no son falta los días que el horario de atención marca como cerrados, ni el día de hoy. El atraso se cuenta desde el inicio del turno, sin tolerancia (se informan los minutos).
- Comisiones pendientes: se calculan por mes calendario dentro del rango pedido. El monto sugerido es el valor de comisión vigente del aliado.
- Compras: una orden solo se anula sin recepciones (P o A). No se exige que el producto esté asociado al proveedor.
- Rutinas: REC lee todas, ENT solo las suyas y ADM todas. Solo el entrenador que creó la rutina (o un ADM) la edita.
- Promociones con autorización: ya estaban hechas desde el paso 6 (la inscripción exige la cédula de un ADM activo y guarda la fecha de autorización).
- Validación de cédula del empleado en el panel genérico: ya existía.
- Thunder Client: se agregaron 79 solicitudes en la carpeta "Fase 2". El nombre de cada una indica el rol con el que hay que iniciar sesión (variable `token`); para la tarea diaria se usa la variable `tareasToken`.

Entorno local:
- El `JWT_SECRET` del `.env` local no pasa la validación de `config/env.js` porque parece un texto de ejemplo. Las pruebas de los pasos 10 a 13 se corrieron con el valor de prueba de CI en la variable de entorno. Conviene poner un valor aleatorio en el `.env` local.
- Git no tiene identidad configurada en esta máquina. Los commits de los pasos 10 a 13 usan el mismo autor que los anteriores (ariel-as, correo noreply de GitHub) pasado en cada comando, sin cambiar la configuración.
- `npm test` corre los archivos en serie (`--test-concurrency=1`). Algunas pruebas crean datos de apoyo con Prisma en la base local.
