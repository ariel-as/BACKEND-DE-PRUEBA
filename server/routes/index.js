import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { verifyToken, allowRoles, allowCodes } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as auth from '../controllers/auth.controller.js';
import * as products from '../controllers/product.controller.js';
import * as orders from '../controllers/order.controller.js';
import * as admin from '../controllers/admin.controller.js';
import * as publicApi from '../controllers/public.controller.js';
import { listTables } from '../factories/repository.factory.js';
import { loginRules, registerRules } from '../validators/auth.js';
import { body, checkExact, validationResult } from 'express-validator';

const router = Router();
const wrap = (fn) => asyncHandler(fn);
const authLimiter = rateLimit({ windowMs: env.rateWindowMs, limit: env.loginRateMax, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req,_res,next) => next(new ApiError(429,'Demasiados intentos. Espera unos minutos y vuelve a probar.')) });
const contactLimiter = rateLimit({ windowMs: 60*60*1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req,_res,next) => next(new ApiError(429,'Has enviado muchos mensajes. Inténtalo más tarde.')) });
const validated = (rules) => [...rules, (req,_res,next)=>{const e=validationResult(req);if(!e.isEmpty())return next(new ApiError(400,'Revisa los datos enviados.',e.array().map(({path,msg})=>({campo:path,mensaje:msg}))));next();}];

router.get('/salud', wrap(auth.health));
router.post('/auth/login', authLimiter, validated(loginRules), wrap(auth.signIn));
router.post('/auth/register', authLimiter, validated(registerRules), wrap(auth.signUp));
router.get('/auth/me', verifyToken, wrap(auth.me));
router.get('/productos', wrap(products.list));
router.get('/productos/:id', wrap(products.get));
router.get('/admin/productos', verifyToken, allowCodes('ADM'), wrap(products.adminList));
router.post('/productos', verifyToken, allowCodes('ADM'), wrap(products.create));
router.put('/productos/:id', verifyToken, allowCodes('ADM'), wrap(products.update));
router.delete('/productos/:id', verifyToken, allowCodes('ADM'), wrap(products.remove));

router.post('/pedidos', verifyToken, allowRoles('user','admin','staff'), wrap(orders.create));
router.get('/pedidos/mis-pedidos', verifyToken, wrap(orders.mine));
router.get('/pedidos', verifyToken, allowCodes('ADM'), wrap(orders.all));
router.get('/pedidos/:id', verifyToken, wrap(orders.get));
router.patch('/pedidos/:id/estado', verifyToken, allowCodes('ADM'), validated([body('estado').isIn(['R','C','E','X']),checkExact()]), wrap(orders.setState));
router.patch('/pedidos/:id/cancelar', verifyToken, wrap(orders.cancel));

router.get('/admin/resumen', verifyToken, allowCodes('ADM'), wrap(admin.summary));
router.get('/admin/tablas', verifyToken, allowCodes('ADM'), wrap(admin.tableList));
router.get('/admin/entidades', verifyToken, allowCodes('ADM'), wrap(admin.tableList));
for (const entidad of listTables()) {
  const base = `/admin/entidades/${entidad.tabla}`;
  const bind = admin.entityTable(entidad.tabla);
  router.get(base, verifyToken, allowCodes('ADM'), bind, wrap(admin.tableRows));
  router.get(`${base}/meta`, verifyToken, allowCodes('ADM'), bind, wrap(admin.tableMeta));
  router.get(`${base}/opciones`, verifyToken, allowCodes('ADM'), bind, wrap(admin.tableOptions));
  router.get(`${base}/:id`, verifyToken, allowCodes('ADM'), bind, wrap(admin.tableRow));
  if (entidad.modo === 'crud') {
    router.post(base, verifyToken, allowCodes('ADM'), bind, wrap(admin.tableCreate));
    router.put(`${base}/:id`, verifyToken, allowCodes('ADM'), bind, wrap(admin.tableUpdate));
    router.delete(`${base}/:id`, verifyToken, allowCodes('ADM'), bind, wrap(admin.tableDelete));
  }
}
router.get('/admin/tablas/:tabla/meta', verifyToken, allowCodes('ADM'), wrap(admin.tableMeta));
router.get('/admin/tablas/:tabla/opciones', verifyToken, allowCodes('ADM'), wrap(admin.tableOptions));
router.get('/admin/tablas/:tabla/:id', verifyToken, allowCodes('ADM'), wrap(admin.tableRow));
router.get('/admin/tablas/:tabla', verifyToken, allowCodes('ADM'), wrap(admin.tableRows));
router.post('/admin/tablas/:tabla', verifyToken, allowCodes('ADM'), wrap(admin.tableCreate));
router.put('/admin/tablas/:tabla/:id', verifyToken, allowCodes('ADM'), wrap(admin.tableUpdate));
router.delete('/admin/tablas/:tabla/:id', verifyToken, allowCodes('ADM'), wrap(admin.tableDelete));
router.post('/admin/usuarios', verifyToken, allowCodes('ADM'), wrap(admin.createStaff));
router.patch('/admin/usuarios/:id/estado', verifyToken, allowCodes('ADM'), validated([body('estado').isIn(['A','I']),checkExact()]), wrap(admin.staffState));

router.get('/categorias', wrap(async (_req,res)=>res.json(await (await import('../config/prisma.js')).prisma.categoria.findMany({orderBy:{descripcion:'asc'}}))));
router.get('/metodos-pago', wrap(async (_req,res)=>res.json(await (await import('../config/prisma.js')).prisma.metodoPago.findMany({orderBy:{descripcion:'asc'}}))));
router.get('/niveles', wrap(async (_req,res)=>res.json(await (await import('../config/prisma.js')).prisma.nivel.findMany({orderBy:{descripcion:'asc'}}))));
router.get('/membresias', wrap(publicApi.memberships));
router.post('/inscripciones', verifyToken, allowRoles('user'), wrap(publicApi.createEnrollment));
router.get('/inscripciones/mis-inscripciones', verifyToken, wrap(publicApi.myEnrollments));
router.get('/clases', wrap(publicApi.classes));
router.get('/entrenadores', wrap(publicApi.trainers));
router.get('/gimnasio', wrap(publicApi.gym));
router.get('/aliados', wrap(publicApi.allies));
router.post('/contacto', contactLimiter, wrap(publicApi.contact));

export default router;
