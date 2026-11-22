import { ApiError } from '../utils/ApiError.js';

// Conversión de pedido web en venta: se completa con la caja (paso 5).
export async function convertOrderToSale() { throw new ApiError(409, 'Abre la caja del turno antes de cobrar'); }
