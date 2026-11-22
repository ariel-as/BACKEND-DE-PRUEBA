# Resultados BACKEND fase 2 (parcial)

## Pasos

| Paso | Estado | Commit | Pruebas |
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
| 10 Tarea diaria, workflow, notificaciones | Pendiente | — | Se alcanzó el límite de uso de la sesión |
| 11 Reportes de prioridad 2 | Pendiente | — | Ídem |
| 12 Prioridad 3 (asistencia, suspensiones, anulación de inscripción, compras, rutinas, aliados, contacto, resto de reportes) | Pendiente | — | Ídem |
| 13 BACKEND.md y README | Pendiente | — | Ídem |

Despliegue: CI en verde y `/api/v1/salud` responde 200 en Render en los pasos 1 a 8 (se comprobó también que cada ruta nueva responde 401 sin token, es decir, que ya está desplegada). El paso 9: CI en verde; la verificación de Render quedó en curso.

## Endpoints de la sección 5

Hechos: /auth/me (permisos); /admin/usuarios (GET, PUT, PUT roles); /admin/gimnasio y /horario; /admin/clientes (GET, POST, PUT, historial, acceso); /admin/inscripciones (POST, GET, GET :id, cobrar, integrantes POST/DELETE, renovar); /admin/entradas (POST, salida, GET); /admin/aforo; /admin/caja/* (turnos, actual, movimientos, cuadre, cierres); PATCH /pedidos/:id/estado; /admin/ventas (POST, GET, :id, anular); /admin/facturas (POST, GET, :id, sri, por-anular, anular); /admin/inventario/* (entradas, ajustes, baja, bloqueo, lotes, kardex); /admin/productos/:id/proveedores.

Pendientes: /admin/personal/asistencia (3); PATCH /admin/suspensiones/:id/anular; POST /admin/inscripciones/:id/suspensiones; PATCH /admin/inscripciones/:id/anular; /admin/rutinas y /rutinas/mi-rutina; /admin/compras/*; /admin/aliados/*; /admin/mensajes/*; /notificaciones/*; POST /tareas/diarias; /admin/reportes/*.

## Script de reparación (modo de prueba, base local)

`npm run reparar:pedidos` (sin `--aplicar`). No se ejecutó en Render ni se aplicó en ninguna base.
- 4 movimientos VEN sin venta (pedidos 7, 8, 9 y 10): devolvería 1 u. a cada lote con ANV.
- 2 productos con `prd_stock` 1 unidad menor que sus lotes sin movimiento VEN (pedidos anteriores al kárdex); el último saldo del kárdex coincide con los lotes, así que corregiría `prd_stock`.
- Verificación proyectada: 19 de 19 productos con stock igual a la suma de sus lotes.
- Para Render: correr primero sin `--aplicar`, revisar, y aplicar solo con autorización.

## B01, B02 y A1–A4

- B01: ningún controlador importa Prisma; las consultas están en repositorios de `models/` y las transacciones en `services/`.
- B02: resuelto; crear pedido ya no descuenta stock, así que cancelar no tiene nada que devolver.
- A1: `ctu_total_transf` es el ingreso bruto por transferencia; las devoluciones TR se informan aparte (`devolucionesTransf`) y no salen del efectivo. Sin cambiar la base.
- A2: el cuadre exige `efectivoContado` (validador y servicio).
- A3: una entrada con el pase diario (plan T, 1 día) rechaza cualquier clase.
- A4: pendiente (es parte de la anulación de inscripción, paso 12).

## Cuentas de prueba agregadas al seed

recepcion@planetafitness.ec, entrenador@planetafitness.ec, contadora@planetafitness.ec (contraseñas con SEED_RECEPCION_PASSWORD, SEED_ENTRENADOR_PASSWORD, SEED_CONTADORA_PASSWORD en producción). El seed no corre solo en Render.

## render.yaml

`CORS_ORIGINS` pasó de `https://planeta-fitness-api.onrender.com` a `https://ariel-as.github.io`. El servicio en Render ya respondía `Access-Control-Allow-Origin: https://ariel-as.github.io`.

## Decisiones y dudas para el equipo

- Transiciones no permitidas de pedidos responden 409 (antes 400).
- El repuesto ANV del script no lleva `ven_numero` porque esos movimientos nunca tuvieron venta.
- REC tiene `ventas:leer` y `caja:leer` para ver lo que registra; ENT ve todas sus clases del panel filtradas a las suyas.
- Al cobrar una inscripción web cuya fecha de inicio ya pasó, se corre el inicio a hoy.
- Al anular una venta de un pedido entregado, el pedido pasa a X y pierde la fecha de retiro (lo exige el CHECK).
- Se agregó el cargo REC al seed y los planes PDI (pase diario) y TAR (tarjeta de 30 ingresos).
- Pruebas: `npm test` corre los archivos en serie (`--test-concurrency=1`); algunas pruebas crean datos de apoyo con Prisma en la base local.
