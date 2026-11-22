import { Router } from 'express';
import { verifyToken, permitir } from '../middleware/auth.js';
import { asyncHandler as wrap } from '../utils/asyncHandler.js';
import { validated, body, exact, idParam } from '../validators/index.js';
import { accountRules, rolesRules, gymRules, scheduleRules } from '../validators/admin.js';
import * as security from '../controllers/security.controller.js';
import * as gym from '../controllers/gym.controller.js';
import * as cash from '../controllers/cash.controller.js';
import { openShiftRules, movementRules, closeShiftRules, weeklyCloseRules } from '../validators/cash.js';
import { requireEmployee } from '../middleware/auth.js';
import * as clients from '../controllers/client.controller.js';
import * as enrollments from '../controllers/enrollment.controller.js';
import { createClientRules, updateClientRules, createEnrollmentRules, chargeRules, memberRules, renewRules } from '../validators/client.js';
import { param } from '../validators/index.js';
import * as entries from '../controllers/entry.controller.js';
import * as sales from '../controllers/sale.controller.js';
import * as inventory from '../controllers/inventory.controller.js';
import { fecha } from '../validators/index.js';
import { requireActiveAdmin } from '../middleware/auth.js';
import { pagosRules, texto } from '../validators/index.js';

// Rutas administrativas de la fase 2. Cada grupo usa permitir('grupo:accion') de config/permisos.js.
const router = Router();
const auth = (...perms) => [verifyToken, permitir(...perms)];

// 4.1 Seguridad (solo ADM)
router.get('/admin/usuarios', ...auth('usuarios:gestionar'), wrap(security.list));
router.post('/admin/usuarios', ...auth('usuarios:gestionar'), wrap(security.create));
router.put('/admin/usuarios/:id', ...auth('usuarios:gestionar'), validated([idParam(), ...accountRules]), wrap(security.update));
router.put('/admin/usuarios/:id/roles', ...auth('usuarios:gestionar'), validated([idParam(), ...rolesRules]), wrap(security.roles));
router.patch('/admin/usuarios/:id/estado', ...auth('usuarios:gestionar'), validated([idParam(), body('estado').isIn(['A', 'I']), exact()]), wrap(security.state));

// 4.2 Datos del gimnasio y horario de atención
router.get('/admin/gimnasio', ...auth('gimnasio:leer'), wrap(gym.get));
router.put('/admin/gimnasio', ...auth('gimnasio:editar'), validated(gymRules), wrap(gym.update));
router.get('/admin/gimnasio/horario', ...auth('gimnasio:leer'), wrap(gym.schedule));
router.put('/admin/gimnasio/horario', ...auth('gimnasio:editar'), validated(scheduleRules), wrap(gym.replaceSchedule));

// 4.9 Caja: turnos, movimientos, cuadre y cierre semanal
router.post('/admin/caja/turnos', ...auth('caja:operar'), requireEmployee, validated(openShiftRules), wrap(cash.open));
router.get('/admin/caja/turnos/actual', ...auth('caja:operar', 'caja:leer'), wrap(cash.current));
router.get('/admin/caja/turnos', ...auth('caja:operar', 'caja:leer'), wrap(cash.list));
router.get('/admin/caja/turnos/:id', ...auth('caja:operar', 'caja:leer'), validated([idParam()]), wrap(cash.detail));
router.patch('/admin/caja/turnos/:id/cuadre', ...auth('caja:operar'), requireEmployee, validated(closeShiftRules), wrap(cash.close));
router.post('/admin/caja/movimientos', ...auth('caja:operar'), requireEmployee, validated(movementRules), wrap(cash.movement));
router.post('/admin/caja/cierres', ...auth('caja:cierre'), requireEmployee, validated(weeklyCloseRules), wrap(cash.createClose));
router.get('/admin/caja/cierres', ...auth('caja:leer', 'caja:cierre'), wrap(cash.closes));

// 4.4 Clientes
router.get('/admin/clientes', ...auth('clientes:leer'), wrap(clients.list));
router.post('/admin/clientes', ...auth('clientes:editar'), validated(createClientRules), wrap(clients.create));
router.put('/admin/clientes/:cedula', ...auth('clientes:editar'), validated(updateClientRules), wrap(clients.update));
router.get('/admin/clientes/:cedula/historial', ...auth('clientes:leer'), validated([param('cedula').matches(/^\d{10}$/)]), wrap(clients.history));

// 4.6 Inscripciones en el local
router.get('/admin/inscripciones', ...auth('inscripciones:leer'), wrap(enrollments.list));
router.post('/admin/inscripciones', ...auth('inscripciones:gestionar'), requireEmployee, validated(createEnrollmentRules), wrap(enrollments.create));
router.get('/admin/inscripciones/:id', ...auth('inscripciones:leer'), validated([idParam()]), wrap(enrollments.detail));
router.post('/admin/inscripciones/:id/cobrar', ...auth('inscripciones:gestionar'), requireEmployee, validated(chargeRules), wrap(enrollments.charge));
router.post('/admin/inscripciones/:id/integrantes', ...auth('inscripciones:gestionar'), validated(memberRules), wrap(enrollments.addMember));
router.delete('/admin/inscripciones/:id/integrantes/:cedula', ...auth('inscripciones:gestionar'), validated([idParam(), param('cedula').matches(/^\d{10}$/)]), wrap(enrollments.removeMember));
router.post('/admin/inscripciones/:id/renovar', ...auth('inscripciones:gestionar'), requireEmployee, validated(renewRules), wrap(enrollments.renew));

// 4.7 Control de entradas y aforo
const entryRules = [body('clienteId').matches(/^\d{10}$/).withMessage('Indica la cédula de quien entra.'), body('inscripcionId').isInt({ min: 1 }).toInt(), body('claseId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), body('horarioId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), exact()];
router.post('/admin/entradas', ...auth('entradas:gestionar'), validated(entryRules), wrap(entries.create));
router.patch('/admin/entradas/:id/salida', ...auth('entradas:gestionar'), validated([idParam()]), wrap(entries.exit));
router.get('/admin/entradas', ...auth('entradas:gestionar'), wrap(entries.list));
router.get('/admin/aforo', ...auth('aforo:ver'), wrap(entries.aforo));
router.get('/admin/clientes/:cedula/acceso', ...auth('entradas:gestionar'), validated([param('cedula').matches(/^\d{10}$/)]), wrap(entries.access));

// 4.11 Ventas en mostrador
const saleRules = [body('clienteId').optional({ values: 'null' }).matches(/^\d{10}$/), body('items').isArray({ min: 1, max: 30 }).withMessage('La venta tiene entre 1 y 30 productos.'), body('items.*.productoId').isString().isLength({ min: 1, max: 13 }), body('items.*.cantidad').isInt({ min: 1, max: 999 }).withMessage('Cantidad entera entre 1 y 999.').toInt(), body('items.*.descuento').optional().isFloat({ min: 0 }).withMessage('El descuento no puede ser negativo.'), ...pagosRules(), exact()];
const motivoRules = [idParam(), texto('motivo', 200, 5), exact()];
router.post('/admin/ventas', ...auth('ventas:crear'), requireEmployee, validated(saleRules), wrap(sales.createSale));
router.get('/admin/ventas', ...auth('ventas:leer'), wrap(sales.listSales));
router.get('/admin/ventas/:id', ...auth('ventas:leer'), validated([idParam()]), wrap(sales.getSale));
router.patch('/admin/ventas/:id/anular', ...auth('ventas:anular'), requireActiveAdmin, validated(motivoRules), wrap(sales.annul));

// 4.12 Facturación
const invoiceRules = [body('ventaId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), body('inscripcionId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), body('clienteId').optional({ values: 'null' }).matches(/^\d{10}$/), exact()];
const sriRules = [idParam(), body('numComprobante').matches(/^\d{3}-\d{3}-\d{9}$/).withMessage('El número del SRI tiene el formato 001-001-000000123.'), body('claveAcceso').matches(/^\d{49}$/).withMessage('La clave de acceso tiene 49 dígitos.'), exact()];
router.post('/admin/facturas', ...auth('facturas:generar'), requireEmployee, validated(invoiceRules), wrap(sales.createInvoice));
router.get('/admin/facturas', ...auth('facturas:leer'), wrap(sales.listInvoices));
router.get('/admin/facturas/por-anular', ...auth('facturas:sri'), wrap(sales.toAnnul));
router.get('/admin/facturas/:id', ...auth('facturas:leer'), validated([idParam()]), wrap(sales.getInvoice));
router.patch('/admin/facturas/:id/sri', ...auth('facturas:sri'), validated(sriRules), wrap(sales.sri));
router.patch('/admin/facturas/:id/anular', ...auth('facturas:sri'), validated([idParam()]), wrap(sales.annulInvoice));

// 4.13 Inventario: recepción sin orden, ajustes, bajas, bloqueo, lotes, kárdex y proveedores del producto
const prod = body('productoId').isString().isLength({ min: 1, max: 13 }).withMessage('Indica el producto.');
const receiveRules = [prod, body('cantidad').isInt({ min: 1, max: 100000 }).withMessage('La cantidad es un entero positivo.').toInt(), body('costoUnit').isFloat({ min: 0 }).withMessage('El costo unitario es un número igual o mayor que cero.'), fecha('fechaCaducidad').optional({ values: 'null' }), body('numFabricante').optional({ values: 'null' }).isString().isLength({ max: 30 }), texto('observacion', 200).optional(), exact()];
const adjustRules = [prod, body('cantidad').isInt({ min: -100000, max: 100000 }).custom((v) => Number(v) !== 0).withMessage('La cantidad es un entero distinto de cero (negativo para ajuste negativo).').toInt(), texto('observacion', 200, 3), body('costoUnit').optional().isFloat({ min: 0 }), fecha('fechaCaducidad').optional({ values: 'null' }), exact()];
router.post('/admin/inventario/entradas', ...auth('inventario:gestionar'), requireEmployee, validated(receiveRules), wrap(inventory.receive));
router.post('/admin/inventario/ajustes', ...auth('inventario:gestionar'), requireEmployee, validated(adjustRules), wrap(inventory.adjust));
router.post('/admin/inventario/lotes/:id/baja', ...auth('inventario:gestionar'), requireEmployee, validated([idParam(), texto('observacion', 200, 3), exact()]), wrap(inventory.writeOff));
router.patch('/admin/inventario/lotes/:id/bloqueo', ...auth('inventario:gestionar'), validated([idParam(), body('bloquear').isBoolean().withMessage('bloquear es true o false.').toBoolean(), exact()]), wrap(inventory.block));
router.get('/admin/inventario/lotes', ...auth('inventario:leer'), wrap(inventory.lots));
router.get('/admin/inventario/kardex/:productoId', ...auth('inventario:leer'), wrap(inventory.kardex));
router.get('/admin/productos/:id/proveedores', ...auth('inventario:leer', 'compras:leer'), wrap(inventory.suppliers));
router.put('/admin/productos/:id/proveedores', ...auth('inventario:gestionar'), validated([body('proveedores').isArray({ max: 50 }), body('proveedores.*').isString().isLength({ min: 10, max: 13 }), exact()]), wrap(inventory.replaceSuppliers));

export default router;
