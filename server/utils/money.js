import { Prisma } from '@prisma/client';

// Cálculos de dinero con Prisma.Decimal para no arrastrar errores de coma flotante.
export const Decimal = Prisma.Decimal;
export const dec = (x) => new Decimal(x ?? 0);
export const r2 = (x) => dec(x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export const r4 = (x) => dec(x).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
export const sum = (values) => values.reduce((acc, x) => acc.plus(dec(x)), dec(0));
// Total de una base con IVA: ROUND(base × (1 + iva/100), 2).
export const conIva = (base, iva) => r2(dec(base).times(dec(1).plus(dec(iva).div(100))));
// Para las respuestas JSON: número con dos decimales.
export const num = (x) => (x === null || x === undefined ? null : Number(dec(x).toFixed(2)));
export const num4 = (x) => (x === null || x === undefined ? null : Number(dec(x).toFixed(4)));
