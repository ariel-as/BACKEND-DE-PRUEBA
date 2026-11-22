import { body, exact, texto } from './index.js';

export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const accountRules = [body('correo').optional().isEmail().isLength({ max: 120 }).withMessage('Ingresa un correo válido.'), body('contrasena').optional().isString().isLength({ min: 8, max: 72 }).withMessage('La contraseña debe tener entre 8 y 72 caracteres.'), exact()];
export const rolesRules = [body('roles').isArray({ min: 1, max: 5 }).withMessage('Envía la lista de roles activos.'), body('roles.*').isString().isLength({ min: 3, max: 4 }), exact()];
export const gymRules = [
  texto('nombre', 100).optional(), texto('direccion', 200).optional(), body('telefono').optional({ values: 'null' }).matches(/^0\d{8,9}$/).withMessage('Teléfono no válido.'),
  body('correo').optional({ values: 'null' }).isEmail().isLength({ max: 120 }), body('aforoMax').optional().isInt({ min: 1, max: 10000 }).withMessage('El aforo debe ser un entero positivo.').toInt(),
  texto('propietaria', 100).optional(), body('porcentajeIva').optional().isFloat({ min: 0, max: 100 }).withMessage('El IVA va de 0 a 100.'),
  body('establecimiento').optional().matches(/^\d{3}$/).withMessage('El establecimiento tiene 3 dígitos.'), body('puntoEmision').optional().matches(/^\d{3}$/).withMessage('El punto de emisión tiene 3 dígitos.'), exact()
];
export const scheduleRules = [body('dias').isArray({ min: 1, max: 7 }).withMessage('Envía entre 1 y 7 días.'), body('dias.*.dia').isString().trim().isLength({ min: 3, max: 30 }), body('dias.*.abierto').isIn(['S', 'N']), body('dias.*.horaApertura').optional({ values: 'null' }).matches(HORA).withMessage('Hora con formato HH:MM.'), body('dias.*.horaCierre').optional({ values: 'null' }).matches(HORA).withMessage('Hora con formato HH:MM.'), exact()];
