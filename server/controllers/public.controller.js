import { ApiError } from '../utils/ApiError.js';
import { publicRepository } from '../models/public.repository.js';
import { createWebEnrollment } from '../services/enrollment.service.js';
import { conIva, num } from '../utils/money.js';

export async function categories(_req, res) { res.json(await publicRepository.categories()); }
export async function paymentMethods(_req, res) { res.json(await publicRepository.paymentMethods()); }
export async function levels(_req, res) { res.json(await publicRepository.levels()); }
const membershipDto = (m, iva) => ({ id: m.id, nombre: m.nombre, descripcion: m.descripcion, tipo: m.tipo, duracion: m.duracion, unidadDuracion: m.unidadDuracion, numIngresos: m.numIngresos, personas: m.numPersonas, precio: num(m.precio), porcentajeIva: iva, precioConIva: num(conIva(m.precio, iva)), incluyeRutina: m.incluyeRutina === 'S', beneficios: m.membresiaServicios.map((x) => x.servicioIdRef1.nombre) });
export async function memberships(_req, res) {
  const [rows, gym] = await Promise.all([publicRepository.memberships(), publicRepository.gym()]);
  const pct = num(gym?.porcentajeIva || 0);
  res.json(rows.map((m) => membershipDto(m, m.pagaIva === 'S' ? pct : 0)));
}
export async function adminMemberships(req, res) {
  const [rows, gym] = await Promise.all([publicRepository.adminMemberships(req.query), publicRepository.gym()]);
  const pct = num(gym?.porcentajeIva || 0);
  res.json(rows.map((m) => ({ ...membershipDto(m, m.pagaIva === 'S' ? pct : 0), publicarWeb: m.publicarWeb === 'S', estado: m.estado })));
}
export async function classes(_req, res) { const rows = await publicRepository.classes(); res.json(rows.map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, lugar: c.lugar, cupoMax: c.cupoMax, entrenador: { id: c.empleadoIdRef1.id, nombre: `${c.empleadoIdRef1.nombre} ${c.empleadoIdRef1.apellido}`, especialidad: c.empleadoIdRef1.especialidad }, horarios: c.claseHorarios.map((h) => ({ id: h.horarioIdRef1.id, dia: h.horarioIdRef1.dia, horaInicio: h.horarioIdRef1.horaInicio, horaFin: h.horarioIdRef1.horaFin, cupoMax: c.cupoMax, reservas: h.asistenciaClientes.length, cupoDisponible: Math.max(0, c.cupoMax - h.asistenciaClientes.length) })) }))); }
export async function trainers(_req, res) { const rows = await publicRepository.trainers(); res.json(rows.map((e) => ({ id: e.id, nombre: `${e.nombre} ${e.apellido}`, especialidad: e.especialidad, claseIds: e.clases.filter((c) => c.estado === 'A').map((c) => c.id) }))); }
export async function gym(_req, res) { const [gimnasio, horarios, servicios, niveles] = await publicRepository.gymInfo(); if (!gimnasio) throw new ApiError(404, 'No hay datos del gimnasio.'); res.json({ id: gimnasio.id, nombre: gimnasio.nombre, direccion: gimnasio.direccion, telefono: gimnasio.telefono, correo: gimnasio.correo, aforoMax: gimnasio.aforoMax, porcentajeIva: num(gimnasio.porcentajeIva), horarios, servicios, niveles }); }
export async function allies(_req, res) { const rows = await publicRepository.allies(); res.json(rows.map((a) => ({ nombre: `${a.nombre} ${a.apellido}`, telefono: a.telefono, correo: a.correo, consultorio: a.consultorio, servicio: a.servicioIdRef1.nombre }))); }
export async function contact(req, res) {
  if (Object.keys(req.body).some((k) => !['nombre', 'correo', 'telefono', 'mensaje'].includes(k))) throw new ApiError(400, 'El cuerpo contiene campos no permitidos.');
  const { nombre, correo, telefono, mensaje } = req.body;
  if (typeof nombre !== 'string' || nombre.length < 2 || nombre.length > 60 || typeof correo !== 'string' || correo.length > 120 || !/^\S+@\S+\.\S+$/.test(correo) || typeof mensaje !== 'string' || mensaje.length < 5 || mensaje.length > 400 || (telefono !== undefined && !/^09\d{8}$/.test(telefono))) throw new ApiError(400, 'Revisa el nombre, correo, teléfono y mensaje enviados.');
  const saved = await publicRepository.createContact({ nombre, correo: correo.toLowerCase(), telefono: telefono || null, mensaje, estado: 'P' });
  res.status(201).json({ id: saved.id, mensaje: 'Tu mensaje fue enviado.' });
}
export async function createEnrollment(req, res) {
  const created = await createWebEnrollment(req.user, req.body);
  res.status(201).json({ id: created.id, membresiaId: created.membresiaId, plan: created.membresiaIdRef1.nombre, fechaInicio: created.fechaInicio, fechaFin: created.fechaFin, ingresosTotal: created.ingresosTotal, valor: num(created.valor), porcentajeIva: num(created.porcentajeIva), totalCobrar: num(conIva(created.valor, created.porcentajeIva)), canal: created.canal, estado: created.estado, createdAt: created.fechaRegistro });
}
export async function myEnrollments(req, res) {
  if (!req.user.clienteId) throw new ApiError(403, 'La cuenta no está vinculada a un cliente.');
  const rows = await publicRepository.myEnrollments(req.user.clienteId);
  res.json(rows.map(({ inscripcionIdRef1: i }) => ({ id: i.id, membresiaId: i.membresiaId, plan: i.membresiaIdRef1.nombre, fechaInicio: i.fechaInicio, fechaFin: i.fechaFin, ingresosTotal: i.ingresosTotal, valor: num(i.valor), porcentajeIva: num(i.porcentajeIva), totalCobrar: num(conIva(i.valor, i.porcentajeIva)), canal: i.canal, estado: i.estado, createdAt: i.fechaRegistro })));
}
