import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2 } from '../utils/money.js';
import { localToday, asDate, validDate, planEnd } from '../utils/dates.js';

// Inscripción web: queda en P hasta que recepción la cobre.
export async function createWebEnrollment(user, body) {
  if (!user.clienteId) throw new ApiError(403, 'La cuenta no está vinculada a un cliente.');
  const { membresiaId, fechaInicio } = body;
  if (!membresiaId || Object.keys(body).some((k) => !['membresiaId', 'fechaInicio'].includes(k))) throw new ApiError(400, 'Indica una membresía válida y una fecha de inicio opcional.');
  const today = localToday(), start = fechaInicio || today;
  if (!validDate(start) || start < today) throw new ApiError(400, 'La fecha de inicio no puede ser anterior a hoy.');
  return prisma.$transaction(async (tx) => {
    const membership = await tx.membresia.findFirst({ where: { id: String(membresiaId), estado: 'A', publicarWeb: 'S' } });
    if (!membership) throw new ApiError(400, 'La membresía no está disponible.');
    const pending = await tx.inscripcion.findFirst({ where: { estado: 'P', inscripcionClientes: { some: { clienteId: user.clienteId, esTitular: 'S' } } } });
    if (pending) throw new ApiError(409, 'Ya tienes una inscripción pendiente de pago.');
    if (membership.tipo === 'T' && (!membership.duracion || !membership.unidadDuracion)) throw new ApiError(400, 'El plan no tiene una duración válida.');
    const gym = await tx.gimnasio.findFirst(), iva = membership.pagaIva === 'S' ? dec(gym?.porcentajeIva || 0) : dec(0), price = r2(membership.precio);
    return tx.inscripcion.create({ data: { membresiaId: membership.id, fechaInicio: asDate(start), fechaFin: membership.tipo === 'T' ? planEnd(start, membership) : null, ingresosTotal: membership.tipo === 'I' ? membership.numIngresos : null, precioBase: price, descuento: dec(0), valor: price, porcentajeIva: iva, canal: 'W', estado: 'P', inscripcionClientes: { create: { clienteId: user.clienteId, esTitular: 'S' } } }, include: { membresiaIdRef1: true } });
  });
}
