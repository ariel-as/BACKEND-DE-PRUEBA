import { body, query, exact, exactQuery, idParam, fecha } from './index.js';

const id = (field) => body(field).isInt({ min: 1 }).withMessage(`${field} debe ser un entero positivo.`).toInt();
const texto = (field, max) => body(field).optional({ values: 'null' }).isString().trim().isLength({ max }).withMessage(`${field} es demasiado largo.`);

export const classFilters = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1 }).toInt(),
  query('estado').optional().isIn(['A', 'I']).withMessage('estado debe ser A o I.'),
  query('entrenadorId').optional().matches(/^\d{10}$/).withMessage('entrenadorId tiene 10 dígitos.'),
  query('dia').optional().isString().trim().isLength({ min: 3, max: 15 })
];

const campos = [
  body('nombre').isString().trim().isLength({ min: 2, max: 60 }).withMessage('El nombre tiene entre 2 y 60 caracteres.'),
  body('servicioId').isString().isLength({ min: 1, max: 4 }),
  body('empleadoId').matches(/^\d{10}$/).withMessage('Indica un entrenador con cédula de 10 dígitos.'),
  texto('descripcion', 200), texto('lugar', 60),
  id('cupoMax').withMessage('El cupo es un entero positivo.'),
  body('estado').optional().isIn(['A', 'I']).withMessage('estado debe ser A o I.'),
  body('horarios').isArray({ min: 1, max: 7 }).withMessage('Indica entre 1 y 7 horarios.'),
  body('horarios.*').isInt({ min: 1 }).toInt()
];

export const classRules = [...campos, exact()];
export const classUpdateRules = campos.map((rule) => rule.optional?.() ?? rule);

export const reserveRules = [idParam(), id('claseId'), id('horarioId'), id('cupoMax').withMessage('El cupo es un entero positivo.'), exact()];

export const attendanceFilters = [
  fecha('desde', query).optional(), fecha('hasta', query).optional(),
  query('claseId').optional().isInt({ min: 1 }).toInt(),
  query('entrenadorId').optional().matches(/^\d{10}$/),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1 }).toInt()
];
