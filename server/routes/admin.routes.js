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

export default router;
