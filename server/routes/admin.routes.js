import { Router } from 'express';
import { verifyToken, permitir } from '../middleware/auth.js';
import { asyncHandler as wrap } from '../utils/asyncHandler.js';
import { validated, body, exact, idParam } from '../validators/index.js';
import { accountRules, rolesRules, gymRules, scheduleRules } from '../validators/admin.js';
import * as security from '../controllers/security.controller.js';
import * as gym from '../controllers/gym.controller.js';

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

export default router;
