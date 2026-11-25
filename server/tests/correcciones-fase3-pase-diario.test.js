import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { tokens, api, cedula, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { dateStr } from '../utils/dates.js';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

test('correcciones fase 3 §2: pase diario sin cédula', async () => {
  const tk = await tokens(), rec = api(tk.REC);
  await ensureShift(tk.REC);
  await prisma.membresia.update({ where: { id: 'PDI' }, data: { estado: 'A', precio: '3.00', pagaIva: 'N', publicarWeb: 'N' } });
  const ced = cedula(`175${String(Date.now()).slice(-6)}`);
  assert.equal((await rec.post('/admin/clientes', { cedula: ced, nombre: 'Pase', apellido: 'Diario' })).status, 201);
  assert.equal((await request(app).post('/api/v1/admin/entradas/pase-diario').send({ metodoPago: 'EF' })).status, 401);
  assert.equal((await api(tk.CLI).post('/admin/entradas/pase-diario').send({ metodoPago: 'EF' })).status, 403);
  assert.equal((await rec.post('/admin/entradas/pase-diario').send({ clienteId: ced, metodoPago: 'XX' })).status, 400);
  const anonimo = await rec.post('/admin/entradas/pase-diario', { clienteId: null, metodoPago: 'EF' });
  assert.equal(anonimo.status, 201, JSON.stringify(anonimo.body));
  assert.deepEqual(Object.keys(anonimo.body).sort(), ['cliente', 'clienteId', 'entradaId', 'inscripcionId', 'total']);
  assert.equal(anonimo.body.clienteId, '9999999999');
  assert.equal(anonimo.body.total, 3);
  const nombrado = await rec.post('/admin/entradas/pase-diario', { clienteId: ced, metodoPago: 'TR', referencia: 'TR-1234' });
  assert.equal(nombrado.status, 201, JSON.stringify(nombrado.body));
  assert.equal(nombrado.body.clienteId, ced);
  assert.equal(nombrado.body.cliente, 'Pase Diario');
  const ins = await prisma.inscripcion.findUnique({ where: { id: nombrado.body.inscripcionId }, include: { inscripcionClientes: true } });
  assert.equal(ins.membresiaId, 'PDI');
  assert.equal(ins.canal, 'L');
  assert.equal(ins.estado, 'A');
  assert.equal(ins.precioBase.toNumber(), 3);
  assert.equal(ins.porcentajeIva.toNumber(), 0);
  assert.equal(dateStr(ins.fechaInicio), dateStr(ins.fechaFin));
  assert.deepEqual(ins.inscripcionClientes.map((m) => m.clienteId), [ced]);
  const entrada = await prisma.asistenciaCliente.findUnique({ where: { id: nombrado.body.entradaId } });
  assert.equal(entrada.clienteId, ced);
  assert.equal(entrada.claseId, null);
  const pago = await prisma.pago.findFirst({ where: { inscripcionId: ins.id }, include: { movimientoCajas: true } });
  assert.equal(pago.metodoPagoId, 'TR');
  assert.equal(pago.monto.toNumber(), 3);
  assert.equal(pago.movimientoCajas.length, 1);
  assert.equal(pago.movimientoCajas[0].tipoMovimientoId, 'ING');
  const hoy = DIAS[new Date(Date.now() - 5 * 3600000).getUTCDay()];
  const boxeo = await prisma.clase.findUnique({ where: { nombre: 'Boxeo' } });
  const horario = await prisma.horario.upsert({ where: { dia_horaInicio_horaFin: { dia: hoy, horaInicio: '00:01', horaFin: '23:58' } }, create: { dia: hoy, horaInicio: '00:01', horaFin: '23:58' }, update: {} });
  await prisma.claseHorario.upsert({ where: { claseId_horarioId: { claseId: boxeo.id, horarioId: horario.id } }, create: { claseId: boxeo.id, horarioId: horario.id, estado: 'A' }, update: { estado: 'A' } });
  await prisma.asistenciaCliente.update({ where: { id: entrada.id }, data: { horaSalida: '23:59' } });
  const clase = await rec.post('/admin/entradas', { clienteId: ced, inscripcionId: ins.id, claseId: boxeo.id, horarioId: horario.id });
  assert.equal(clase.status, 409);
  assert.match(clase.body.mensaje, /pase diario no incluye clases/);
  await prisma.membresia.update({ where: { id: 'PDI' }, data: { estado: 'I' } });
  try {
    const inactivo = await rec.post('/admin/entradas/pase-diario', { clienteId: ced, metodoPago: 'EF' });
    assert.equal(inactivo.status, 409);
    assert.match(inactivo.body.mensaje, /pase diario/i);
  } finally {
    await prisma.membresia.update({ where: { id: 'PDI' }, data: { estado: 'A' } });
  }
  const abiertos = await prisma.cuadreTurno.findMany({ where: { efectivoContado: null }, select: { id: true } });
  const ids = abiertos.map((x) => x.id);
  await prisma.cuadreTurno.updateMany({ where: { id: { in: ids } }, data: { efectivoContado: 0 } });
  try {
    const sinCaja = await rec.post('/admin/entradas/pase-diario', { clienteId: ced, metodoPago: 'EF' });
    assert.equal(sinCaja.status, 409);
    assert.match(sinCaja.body.mensaje, /Abre la caja/i);
  } finally {
    await prisma.cuadreTurno.updateMany({ where: { id: { in: ids } }, data: { efectivoContado: null } });
  }
});
