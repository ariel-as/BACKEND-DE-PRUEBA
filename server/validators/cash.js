import { body, exact, texto, fecha, idParam } from './index.js';

export const openShiftRules = [body('turnoId').isString().isLength({ min: 1, max: 3 }).withMessage('Indica el turno.'), body('saldoInicial').isFloat({ min: 0 }).withMessage('El saldo inicial es un número igual o mayor que cero.'), exact()];
export const movementRules = [body('tipo').isIn(['EGR', 'DEV']).withMessage('El tipo es EGR (gasto) o DEV (devolución).'), texto('concepto', 200, 3), body('monto').optional().isFloat({ gt: 0 }).withMessage('El monto debe ser mayor que cero.'), body('pagoId').optional().isInt({ min: 1 }).toInt(), exact()];
// A2: el efectivo contado es obligatorio para cerrar el turno.
export const closeShiftRules = [idParam(), body('efectivoContado').exists({ values: 'null' }).withMessage('Ingresa el efectivo contado para cerrar el turno.').bail().isFloat({ min: 0 }).withMessage('El efectivo contado es un número igual o mayor que cero.'), exact()];
export const weeklyCloseRules = [fecha('fechaDesde'), fecha('fechaHasta'), texto('observacion', 300).optional(), exact()];
