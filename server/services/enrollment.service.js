import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2, conIva } from '../utils/money.js';
import { localToday, asDate, validDate, planEnd, addDays, dateStr, todayDate } from '../utils/dates.js';
import { registerPayments } from './cash.service.js';
import { CONSUMIDOR_FINAL } from './sale.service.js';

// Pase diario: plan por tiempo de un día. Solo da acceso al área del gimnasio (A3: ninguna clase).
export const isDayPass = (m) => m.tipo === 'T' && m.unidadDuracion === 'D' && m.duracion === 1;
const lockEnrollment = (tx, id) => tx.$queryRaw`SELECT ins_numero FROM inscripcion WHERE ins_numero = ${id} FOR UPDATE`;
const needEmployee = (user) => { if (!user.empleadoId) throw new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación'); };

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

// Empleado que autoriza: activo, con cuenta activa y rol ADM activo (diccionario de inscripcion).
export async function checkAdminEmployee(tx, empleadoId, label = 'autoriza') {
  const e = await tx.empleado.findUnique({ where: { id: String(empleadoId || '') }, include: { usuario: { include: { rolesAsignados: { where: { rolId: 'ADM', estado: 'A' } } } } } });
  if (!e || e.estado !== 'A' || !e.usuario || e.usuario.estado !== 'A' || !e.usuario.rolesAsignados.length) throw new ApiError(409, `El empleado que ${label} debe estar activo y tener una cuenta activa con rol de administrador.`);
  return e;
}

// Calcula los valores de la inscripción con la promoción vigente (si la hay).
async function pricing(tx, membership, { promocionId, empAutorizaId }) {
  const gym = await tx.gimnasio.findFirst();
  const iva = membership.pagaIva === 'S' ? dec(gym?.porcentajeIva || 0) : dec(0), precioBase = r2(membership.precio);
  let descuento = dec(0), promo = null, autoriza = {};
  if (promocionId) {
    promo = await tx.promocion.findFirst({ where: { id: promocionId, fechaIni: { lte: todayDate() }, fechaFin: { gte: todayDate() }, membresiaPromocions: { some: { membresiaId: membership.id } } } });
    if (!promo) throw new ApiError(409, 'La promoción no está vigente o no aplica a este plan.');
    if (promo.requiereAutoriz === 'S') {
      if (!empAutorizaId) throw new ApiError(409, 'Esta promoción necesita la cédula del administrador que la autoriza.');
      await checkAdminEmployee(tx, empAutorizaId);
      autoriza = { empAutorizaId: String(empAutorizaId), fechaAutoriza: new Date() };
    }
    descuento = r2(precioBase.times(promo.porcentaje).div(100));
  } else if (empAutorizaId) throw new ApiError(400, 'Solo se indica quién autoriza cuando hay una promoción que lo pide.');
  const valor = precioBase.minus(descuento);
  return { precioBase, descuento, valor, porcentajeIva: iva, total: conIva(valor, iva), promocionId: promo?.id ?? null, ...autoriza };
}

async function activeClient(tx, cedula) {
  const c = await tx.cliente.findUnique({ where: { id: String(cedula) } });
  if (!c || c.estado !== 'A') throw new ApiError(409, `El cliente ${cedula} no existe o está inactivo.`);
  return c;
}

// Crea la inscripción canal L y la cobra en la misma transacción (pasa a A).
async function createAndCharge(tx, user, { titularId, acompanantes = [], membresiaId, fechaInicio, promocionId, empAutorizaId, pagos }) {
  const membership = await tx.membresia.findFirst({ where: { id: String(membresiaId), estado: 'A' } });
  if (!membership) throw new ApiError(409, 'El plan no existe o está inactivo.');
  if (titularId === CONSUMIDOR_FINAL && !isDayPass(membership)) throw new ApiError(409, 'CONSUMIDOR FINAL solo puede comprar el pase diario.');
  if (acompanantes.length + 1 > membership.numPersonas) throw new ApiError(409, `El plan ${membership.nombre} cubre ${membership.numPersonas} persona(s).`);
  await activeClient(tx, titularId);
  for (const a of acompanantes) { if (a === CONSUMIDOR_FINAL) throw new ApiError(409, 'CONSUMIDOR FINAL no puede ser acompañante.'); await activeClient(tx, a); }
  const start = fechaInicio || localToday();
  if (!validDate(start) || start < localToday()) throw new ApiError(400, 'La fecha de inicio no puede ser anterior a hoy.');
  const p = await pricing(tx, membership, { promocionId, empAutorizaId });
  const { total, ...values } = p;
  const ins = await tx.inscripcion.create({ data: { membresiaId: membership.id, empleadoId: user.empleadoId, fechaInicio: asDate(start), fechaFin: membership.tipo === 'T' ? planEnd(start, membership) : null, ingresosTotal: membership.tipo === 'I' ? membership.numIngresos : null, ...values, canal: 'L', estado: 'P', inscripcionClientes: { create: [{ clienteId: titularId, esTitular: 'S' }, ...acompanantes.map((clienteId) => ({ clienteId, esTitular: 'N' }))] } } });
  await registerPayments(tx, { pagos, total, inscripcionId: ins.id, empleadoId: user.empleadoId, concepto: `Inscripción ${ins.id} (${membership.nombre})` });
  await tx.inscripcion.update({ where: { id: ins.id }, data: { estado: 'A' } });
  return ins.id;
}

export async function createLocalEnrollment(user, body) {
  needEmployee(user);
  return prisma.$transaction((tx) => createAndCharge(tx, user, { ...body, titularId: body.clienteId, acompanantes: body.acompanantes || [] }));
}

// Cobrar una inscripción web pendiente (P → A), con el mismo procedimiento de cobro.
export async function chargePending(user, id, { pagos }) {
  needEmployee(user);
  return prisma.$transaction(async (tx) => {
    await lockEnrollment(tx, id);
    const ins = await tx.inscripcion.findUnique({ where: { id }, include: { inscripcionClientes: true, membresiaIdRef1: true } });
    if (!ins) throw new ApiError(404, 'No se encontró la inscripción.');
    if (ins.estado !== 'P') throw new ApiError(409, 'Solo se cobra una inscripción pendiente de pago.');
    if (!ins.inscripcionClientes.some((c) => c.esTitular === 'S')) throw new ApiError(409, 'La inscripción no tiene titular.');
    if (ins.fechaInicio.toISOString().slice(0, 10) < localToday() && ins.fechaFin) {
      // Si la fecha de inicio ya pasó, se corre al día de hoy para no perder días pagados.
      await tx.inscripcion.update({ where: { id }, data: { fechaInicio: todayDate(), fechaFin: planEnd(localToday(), ins.membresiaIdRef1) } });
    }
    await registerPayments(tx, { pagos, total: conIva(ins.valor, ins.porcentajeIva), inscripcionId: id, empleadoId: user.empleadoId, concepto: `Inscripción web ${id} (${ins.membresiaIdRef1.nombre})` });
    await tx.inscripcion.update({ where: { id }, data: { estado: 'A', empleadoId: ins.empleadoId ?? user.empleadoId } });
    return id;
  });
}

// Acompañante: sin superar las personas del plan, con bloqueo de la inscripción.
export async function addMember(id, clienteId) {
  return prisma.$transaction(async (tx) => {
    await lockEnrollment(tx, id);
    const ins = await tx.inscripcion.findUnique({ where: { id }, include: { inscripcionClientes: true, membresiaIdRef1: true } });
    if (!ins) throw new ApiError(404, 'No se encontró la inscripción.');
    if (!['P', 'A'].includes(ins.estado)) throw new ApiError(409, 'Solo se agregan acompañantes a una inscripción pendiente o activa.');
    if (clienteId === CONSUMIDOR_FINAL) throw new ApiError(409, 'CONSUMIDOR FINAL no puede ser acompañante.');
    if (ins.inscripcionClientes.some((c) => c.clienteId === clienteId)) throw new ApiError(409, 'El cliente ya es integrante de esta inscripción.');
    if (ins.inscripcionClientes.length >= ins.membresiaIdRef1.numPersonas) throw new ApiError(409, `El plan ${ins.membresiaIdRef1.nombre} ya tiene sus ${ins.membresiaIdRef1.numPersonas} persona(s).`);
    await activeClient(tx, clienteId);
    await tx.inscripcionCliente.create({ data: { inscripcionId: id, clienteId, esTitular: 'N' } });
    return id;
  });
}

export async function removeMember(id, clienteId) {
  return prisma.$transaction(async (tx) => {
    await lockEnrollment(tx, id);
    const m = await tx.inscripcionCliente.findUnique({ where: { inscripcionId_clienteId: { inscripcionId: id, clienteId } } });
    if (!m) throw new ApiError(404, 'El cliente no es integrante de esta inscripción.');
    if (m.esTitular === 'S') throw new ApiError(409, 'No se puede quitar al titular.');
    if (await tx.asistenciaCliente.count({ where: { inscripcionId: id, clienteId } })) throw new ApiError(409, 'El acompañante ya registró entradas con esta inscripción y no se puede quitar.');
    await tx.inscripcionCliente.delete({ where: { inscripcionId_clienteId: { inscripcionId: id, clienteId } } });
    return id;
  });
}

// Renovar: nueva inscripción para el mismo titular y acompañantes, desde el día siguiente al fin si sigue activa.
export async function renew(user, id, body) {
  needEmployee(user);
  return prisma.$transaction(async (tx) => {
    await lockEnrollment(tx, id);
    const prev = await tx.inscripcion.findUnique({ where: { id }, include: { inscripcionClientes: true } });
    if (!prev) throw new ApiError(404, 'No se encontró la inscripción.');
    if (['P', 'X'].includes(prev.estado)) throw new ApiError(409, 'Solo se renueva una inscripción cobrada que no esté anulada.');
    const fin = dateStr(prev.fechaFin);
    const start = ['A', 'S'].includes(prev.estado) && fin && fin >= localToday() ? addDays(fin, 1) : localToday();
    const titular = prev.inscripcionClientes.find((c) => c.esTitular === 'S').clienteId;
    const acompanantes = prev.inscripcionClientes.filter((c) => c.esTitular === 'N').map((c) => c.clienteId);
    return createAndCharge(tx, user, { titularId: titular, acompanantes, membresiaId: body.membresiaId || prev.membresiaId, fechaInicio: start, promocionId: body.promocionId, empAutorizaId: body.empAutorizaId, pagos: body.pagos });
  });
}
