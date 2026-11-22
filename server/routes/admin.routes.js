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

export default router;
