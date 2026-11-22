import { body, exact, pagosRules } from './index.js';

export const createOrderRules = [body('metodoPago').isIn(['EF', 'TR']).withMessage('El método de pago debe ser EF o TR.'), body('refTransferencia').optional({ values: 'null' }).isString(), body('items').isArray({ min: 1, max: 30 }).withMessage('El pedido debe tener entre 1 y 30 productos.'), exact()];
export const orderStateRules = [body('estado').isIn(['R', 'C', 'E', 'X']).withMessage('El estado debe ser R, C, E o X.'), body('refTransferencia').optional().isString(), ...pagosRules(true), exact()];
