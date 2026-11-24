import { body, exact, fecha, query, texto } from './index.js';

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

export const routineFilters = [query('clienteId').optional().matches(/^\d{10}$/), query('mias').optional().isIn(['S', 'N']), query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1 }).toInt()];
export const routineRules = (editing = false) => {
  const opt = (rule) => (editing ? rule.optional() : rule);
  const detalle = (rule) => (editing ? rule.optional() : rule);
  return [
    opt(body('nivelId')).isString().isLength({ min: 1, max: 3 }).withMessage('Indica el nivel.'),
    opt(texto('objetivo', 100, 3)),
    opt(body('detalle')).isObject().withMessage('detalle debe ser un objeto con días y ejercicios.'),
    detalle(body('detalle.dias')).isArray({ min: 1, max: 7 }).withMessage('Envía entre 1 y 7 días.'),
    detalle(body('detalle.dias.*.nombre')).isString().trim().isLength({ min: 3, max: 30 }),
    detalle(body('detalle.dias.*.ejercicios')).isArray({ min: 1, max: 10 }).withMessage('Cada día tiene entre 1 y 10 ejercicios.'),
    detalle(body('detalle.dias.*.ejercicios.*.nombre')).isString().trim().isLength({ min: 2, max: 60 }),
    detalle(body('detalle.dias.*.ejercicios.*.grupo')).optional({ values: 'null' }).isString().trim().isLength({ min: 3, max: 30 }),
    detalle(body('detalle.dias.*.ejercicios.*.series')).isInt({ min: 1, max: 10 }).toInt(),
    detalle(body('detalle.dias.*.ejercicios.*.repeticiones')).optional({ values: 'null' }).isInt({ min: 1, max: 100 }).toInt(),
    detalle(body('detalle.dias.*.ejercicios.*.tiempo')).optional({ values: 'null' }).isInt({ min: 1, max: 3600 }).toInt(),
    detalle(body('detalle.dias.*.ejercicios.*.descanso')).isString().trim().isLength({ min: 1, max: 15 }),
    detalle(body('detalle.dias.*.ejercicios.*.nota')).isString().trim().isLength({ min: 0, max: 120 }),
    detalle(body('detalle.dias.*.ejercicios.*.editable')).optional().isBoolean(),
    detalle(body('detalle.editable')).optional().isBoolean(),
    detalle(body('detalle.dias.*.ejercicios.*')).custom((e) => {
      const reps = Number(e?.repeticiones), tiempo = Number(e?.tiempo);
      if (!((Number.isFinite(reps) && reps > 0) || (Number.isFinite(tiempo) && tiempo > 0))) throw new Error('Cada ejercicio necesita repeticiones o tiempo.');
      return true;
    }),
    fecha('fechaInicio').optional(), fecha('fechaFin').optional({ values: 'null' })
  ];
};
