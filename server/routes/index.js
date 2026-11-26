import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { verifyToken, allowRoles, permitir, requireTaskToken } from '../middleware/auth.js';
import * as notifications from '../controllers/notification.controller.js';
import * as routines from '../controllers/routine.controller.js';
import { idParam, query, exactQuery, body, exact, param } from '../validators/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as auth from '../controllers/auth.controller.js';
import * as products from '../controllers/product.controller.js';
import * as orders from '../controllers/order.controller.js';
import * as admin from '../controllers/admin.controller.js';
import * as publicApi from '../controllers/public.controller.js';
import { listTables } from '../factories/repository.factory.js';
import { tablePermissions } from '../config/permisos.js';
import { loginRules, registerRules } from '../validators/auth.js';
import { createOrderRules, orderStateRules } from '../validators/order.js';
import { validated } from '../validators/index.js';
import adminRoutes from './admin.routes.js';
import classRoutes from './class.routes.js';

const router = Router();
const wrap = (fn) => asyncHandler(fn);
const authLimiter = rateLimit({ windowMs: env.rateWindowMs, limit: env.loginRateMax, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req,_res,next) => next(new ApiError(429,'Demasiados intentos. Espera unos minutos y vuelve a probar.')) });
const contactLimiter = rateLimit({ windowMs: 60*60*1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req,_res,next) => next(new ApiError(429,'Has enviado muchos mensajes. Inténtalo más tarde.')) });
const staff = allowRoles('admin', 'staff');
// Permiso por tabla del panel genérico, según la matriz de la sección 3.
const tableRead = (tabla) => permitir(...tablePermissions(tabla).leer);
const tableWrite = (tabla) => permitir(...tablePermissions(tabla).escribir);
const tableParam = (mode) => (req, res, next) => (mode === 'leer' ? tableRead : tableWrite)(req.params.tabla)(req, res, next);

router.get('/salud', wrap(auth.health));
router.post('/auth/login', authLimiter, validated(loginRules), wrap(auth.signIn));
router.post('/auth/register', authLimiter, validated(registerRules), wrap(auth.signUp));
router.get('/auth/me', verifyToken, wrap(auth.me));
router.get('/productos', wrap(products.list));
router.get('/productos/:id', wrap(products.get));
router.get('/admin/productos', verifyToken, permitir('inventario:leer'), validated([query('estado').optional().isIn(['A','I']), query('orden').optional().isIn(['caducidad']), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }), exactQuery([query('estado'), query('orden'), query('page'), query('limit')])]), wrap(products.adminList));
router.get('/admin/productos/:id', verifyToken, permitir('inventario:leer'), wrap(products.adminGet));
const fotoRules = [body('fotoUrl').isString().trim().isLength({ min: 1, max: 200 }).withMessage('fotoUrl debe tener entre 1 y 200 caracteres.'), exact()];
router.get('/admin/productos/:id/fotos', verifyToken, permitir('inventario:leer'), validated([param('id').isString().notEmpty(), exactQuery([])]), wrap(products.listFotos));
router.post('/admin/productos/:id/fotos', verifyToken, permitir('inventario:gestionar'), validated([param('id').isString().notEmpty(), ...fotoRules]), wrap(products.createFoto));
router.delete('/admin/fotos/:id', verifyToken, permitir('inventario:gestionar'), validated([idParam()]), wrap(products.deleteFoto));
router.post('/productos', verifyToken, permitir('inventario:gestionar'), wrap(products.create));
router.put('/productos/:id', verifyToken, permitir('inventario:gestionar'), wrap(products.update));
router.delete('/productos/:id', verifyToken, permitir('inventario:gestionar'), wrap(products.remove));

router.post('/pedidos', verifyToken, allowRoles('user','admin','staff'), validated(createOrderRules), wrap(orders.create));
router.get('/pedidos/mis-pedidos', verifyToken, wrap(orders.mine));
router.get('/pedidos', verifyToken, permitir('pedidos:leer'), wrap(orders.all));
router.get('/pedidos/:id', verifyToken, wrap(orders.get));
router.patch('/pedidos/:id/estado', verifyToken, permitir('pedidos:gestionar'), validated(orderStateRules), wrap(orders.setState));
router.patch('/pedidos/:id/cancelar', verifyToken, wrap(orders.cancel));

router.get('/admin/resumen', verifyToken, permitir('resumen:ver'), wrap(admin.summary));
router.get('/admin/tablas', verifyToken, staff, wrap(admin.tableList));
router.get('/admin/entidades', verifyToken, staff, wrap(admin.tableList));
for (const entidad of listTables()) {
  const base = `/admin/entidades/${entidad.tabla}`;
  const bind = admin.entityTable(entidad.tabla), read = tableRead(entidad.tabla), write = tableWrite(entidad.tabla);
  router.get(base, verifyToken, read, bind, wrap(admin.tableRows));
  router.get(`${base}/meta`, verifyToken, read, bind, wrap(admin.tableMeta));
  router.get(`${base}/opciones`, verifyToken, read, bind, wrap(admin.tableOptions));
  router.get(`${base}/:id`, verifyToken, read, bind, wrap(admin.tableRow));
  if (entidad.modo === 'crud') {
    router.post(base, verifyToken, write, bind, wrap(admin.tableCreate));
    router.put(`${base}/:id`, verifyToken, write, bind, wrap(admin.tableUpdate));
    router.delete(`${base}/:id`, verifyToken, write, bind, wrap(admin.tableDelete));
  }
}
router.get('/admin/tablas/:tabla/meta', verifyToken, tableParam('leer'), wrap(admin.tableMeta));
router.get('/admin/tablas/:tabla/opciones', verifyToken, tableParam('leer'), wrap(admin.tableOptions));
router.get('/admin/tablas/:tabla/:id', verifyToken, tableParam('leer'), wrap(admin.tableRow));
router.get('/admin/tablas/:tabla', verifyToken, tableParam('leer'), wrap(admin.tableRows));
router.post('/admin/tablas/:tabla', verifyToken, tableParam('escribir'), wrap(admin.tableCreate));
router.put('/admin/tablas/:tabla/:id', verifyToken, tableParam('escribir'), wrap(admin.tableUpdate));
router.delete('/admin/tablas/:tabla/:id', verifyToken, tableParam('escribir'), wrap(admin.tableDelete));
router.use(adminRoutes);
router.use(classRoutes);

router.get('/categorias', wrap(publicApi.categories));
router.get('/metodos-pago', wrap(publicApi.paymentMethods));
router.get('/niveles', wrap(publicApi.levels));
router.get('/membresias', wrap(publicApi.memberships));
router.post('/inscripciones', verifyToken, allowRoles('user'), wrap(publicApi.createEnrollment));
router.get('/inscripciones/mis-inscripciones', verifyToken, wrap(publicApi.myEnrollments));
router.get('/clases', wrap(publicApi.classes));
router.get('/entrenadores', wrap(publicApi.trainers));
router.get('/gimnasio', wrap(publicApi.gym));
router.get('/aliados', wrap(publicApi.allies));
router.post('/contacto', contactLimiter, wrap(publicApi.contact));

// 4.14 Notificaciones del usuario actual y 4.15 tarea diaria (sin JWT, con X-Tarea-Token)
const taskLimiter = rateLimit({ windowMs: 60*60*1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req,_res,next) => next(new ApiError(429,'Demasiadas ejecuciones de la tarea diaria.')) });
router.get('/rutinas/mi-rutina', verifyToken, wrap(routines.mine));
router.get('/notificaciones', verifyToken, wrap(notifications.list));
router.patch('/notificaciones/:id/leida', verifyToken, validated([idParam()]), wrap(notifications.markRead));
router.post('/tareas/diarias', taskLimiter, requireTaskToken, wrap(notifications.daily));

export default router;
