import { body, param, exact, pagosRules, fecha, idParam } from './index.js';
import { cedulaValida } from './auth.js';

const NAME = /^[\p{L}][\p{L} '’-]{0,58}[\p{L}]$/u;
const opt = (f) => body(f).optional({ values: 'null' });
const common = [
  opt('nivelId').isString().isLength({ min: 3, max: 3 }), opt('telefono').matches(/^09\d{8}$/).withMessage('El teléfono tiene 10 dígitos y empieza con 09.'),
  opt('correo').isEmail().isLength({ max: 120 }).withMessage('Ingresa un correo válido.'), opt('ruc').matches(/^\d{13}$/).withMessage('El RUC tiene 13 dígitos.'),
  opt('direccion').isString().isLength({ max: 200 }), opt('sector').isString().isLength({ max: 100 }), fecha('fechaNacimiento').optional({ values: 'null' }),
  opt('esEstudiante').isIn(['S', 'N'])
];
export const createClientRules = [body('cedula').custom(cedulaValida).withMessage('La cédula ecuatoriana no es válida.'), body('nombre').matches(NAME).withMessage('El nombre debe tener entre 2 y 60 letras.'), body('apellido').matches(NAME).withMessage('El apellido debe tener entre 2 y 60 letras.'), ...common, exact()];
export const updateClientRules = [param('cedula').matches(/^\d{10}$/), body('nombre').optional().matches(NAME).withMessage('El nombre debe tener entre 2 y 60 letras.'), body('apellido').optional().matches(NAME).withMessage('El apellido debe tener entre 2 y 60 letras.'), ...common, body('estado').optional().isIn(['A', 'I']), exact()];
const plan = [body('membresiaId').isString().isLength({ min: 1, max: 4 }).withMessage('Indica el plan.'), fecha('fechaInicio').optional(), body('promocionId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), body('empAutorizaId').optional({ values: 'null' }).matches(/^\d{10}$/).withMessage('La cédula de quien autoriza tiene 10 dígitos.')];
export const createEnrollmentRules = [body('clienteId').matches(/^\d{10}$/).withMessage('Indica la cédula del titular.'), body('acompanantes').optional().isArray({ max: 4 }), body('acompanantes.*').matches(/^\d{10}$/), ...plan, ...pagosRules(), exact()];
export const chargeRules = [idParam(), ...pagosRules(), exact()];
export const memberRules = [idParam(), body('clienteId').matches(/^\d{10}$/).withMessage('Indica la cédula del acompañante.'), exact()];
export const renewRules = [idParam(), body('membresiaId').optional().isString().isLength({ min: 1, max: 4 }), body('promocionId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), body('empAutorizaId').optional({ values: 'null' }).matches(/^\d{10}$/), ...pagosRules(), exact()];
