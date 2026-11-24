import { body, param, query, checkExact, validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

// Ejecuta las reglas y responde 400 con el detalle de cada campo.
export const validated = (rules) => [...rules, (req, _res, next) => { const e = validationResult(req); if (!e.isEmpty()) return next(new ApiError(400, 'Revisa los datos enviados.', e.array().map(({ path, msg }) => ({ campo: path, mensaje: msg })))); next(); }];
export const exact = () => checkExact([], { message: 'El cuerpo contiene campos no permitidos.' });
export const exactQuery = (rules = []) => checkExact(rules, { locations: ['query'], message: 'Hay filtros no permitidos.' });
export const idParam = (name = 'id') => param(name).isInt({ min: 1 }).withMessage('El identificador debe ser un entero positivo.').toInt();
export const fecha = (field, where = body) => where(field).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${field} debe tener el formato AAAA-MM-DD.`);
export const texto = (field, max, min = 1) => body(field).isString().trim().isLength({ min, max }).withMessage(`${field} debe tener entre ${min} y ${max} caracteres.`);
// Forma común de los pagos en todos los cobros: uno o dos, EF y/o TR, referencia obligatoria en TR.
export const pagosRules = (optional = false) => {
  const base = body('pagos');
  return [
    (optional ? base.optional() : base).isArray({ min: 1, max: 2 }).withMessage('Envía uno o dos pagos.'),
    body('pagos.*.metodoPago').isIn(['EF', 'TR']).withMessage('El método de pago debe ser EF o TR.'),
    body('pagos.*.monto').isFloat({ gt: 0 }).withMessage('El monto del pago debe ser mayor que cero.'),
    body('pagos.*.referencia').optional({ values: 'null' }).isString().matches(/^[\p{L}\d-]{4,30}$/u).withMessage('La referencia debe tener entre 4 y 30 letras, números o guiones.')
  ];
};
export { body, param, query };
