import { Router } from 'express';
import { verifyToken, permitir } from '../middleware/auth.js';
import { asyncHandler as wrap } from '../utils/asyncHandler.js';
import { validated, exactQuery, idParam } from '../validators/index.js';
import { classFilters, classRules, classUpdateRules, reserveRules, attendanceFilters } from '../validators/class.js';
import * as classes from '../controllers/class.controller.js';

const router = Router();
const auth = (...perms) => [verifyToken, permitir(...perms)];

router.get('/admin/clases', ...auth('clases:leer', 'clases:propias'), validated([...classFilters, exactQuery(classFilters)]), wrap(classes.list));
router.post('/admin/clases', ...auth('clases:editar'), validated(classRules), wrap(classes.create));
router.get('/admin/clases/:id', ...auth('clases:leer', 'clases:propias'), validated([idParam()]), wrap(classes.detail));
router.put('/admin/clases/:id', ...auth('clases:editar'), validated([idParam(), ...classUpdateRules]), wrap(classes.update));
router.delete('/admin/clases/:id', ...auth('clases:editar'), validated([idParam()]), wrap(classes.deactivate));
router.post('/admin/inscripciones/:id/clases', ...auth('inscripciones:gestionar'), validated(reserveRules), wrap(classes.reserve));
router.get('/admin/reportes/asistencia', ...auth('reportes:entradas', 'reportes:todos'), validated([...attendanceFilters, exactQuery(attendanceFilters)]), wrap(classes.attendance));

export default router;
