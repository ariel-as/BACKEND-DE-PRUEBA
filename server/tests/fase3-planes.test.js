import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { tokens, api, cedula } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { dateStr, planEnd } from '../utils/dates.js';

const servicios = ['PES', 'CAR', 'BOX', 'BAI', 'RUT'];
const nuevos = [
  { id: 'TRI', nombre: 'Trimestral', descripcion: 'Plan trimestral individual de acceso al gimnasio.', duracion: 3, precio: '73.91' },
  { id: 'ANU', nombre: 'Anual', descripcion: 'Plan anual individual de acceso al gimnasio.', duracion: 12, precio: '295.65' }
];

test('fase 3 §3: planes, total con IVA y fechas de fin', async () => {
  const tk = await tokens(), rec = api(tk.REC);
  for (const plan of nuevos) {
    const data = { id: plan.id, nombre: plan.nombre, descripcion: plan.descripcion, tipo: 'T', duracion: plan.duracion, unidadDuracion: 'M', numIngresos: null, numPersonas: 1, precio: plan.precio, pagaIva: 'S', incluyeRutina: 'S', esEstudiantil: 'N', publicarWeb: 'S', estado: 'A' };
    await prisma.membresia.upsert({ where: { id: plan.id }, create: data, update: data });
    for (const servicioId of servicios) await prisma.membresiaServicio.upsert({ where: { membresiaId_servicioId: { membresiaId: plan.id, servicioId } }, create: { membresiaId: plan.id, servicioId }, update: {} });
  }
  const catalogo = await request(app).get('/api/v1/membresias');
  assert.equal(catalogo.status, 200);
  assert.equal(catalogo.body.some((x) => x.id === 'PDI'), false);
  for (const [id, total] of [['TRI', 85], ['ANU', 340]]) {
    const plan = catalogo.body.find((x) => x.id === id);
    assert.equal(plan.precioConIva, total);
  }
  const panel = await rec.get('/admin/membresias');
  assert.equal(panel.status, 200);
  assert.equal(panel.body.find((x) => x.id === 'PDI').precioConIva, 3);
  const diario = await prisma.membresia.findUnique({ where: { id: 'PDI' } });
  assert.equal(Number(diario.precio), 3);
  assert.equal(diario.pagaIva, 'N');
  const tarjeta = await prisma.membresia.findUnique({ where: { id: 'TAR' } });
  assert.equal(Number(tarjeta.precio), 40);
  assert.equal(tarjeta.pagaIva, 'N');
  for (const plan of nuevos) {
    const guardado = await prisma.membresia.findUnique({ where: { id: plan.id }, include: { membresiaServicios: true } });
    assert.equal(guardado.duracion, plan.duracion);
    assert.equal(guardado.numPersonas, 1);
    assert.equal(guardado.incluyeRutina, 'S');
    assert.deepEqual(guardado.membresiaServicios.map((x) => x.servicioId).sort(), [...servicios].sort());
  }
  assert.equal(await prisma.membresia.count({ where: { id: 'SEM' } }), 0);
  assert.equal(dateStr(planEnd('2026-01-30', { unidadDuracion: 'D', duracion: 1 })), '2026-01-30');
  assert.equal(dateStr(planEnd('2026-01-31', { unidadDuracion: 'M', duracion: 3 })), '2026-04-29');
  assert.equal(dateStr(planEnd('2026-02-28', { unidadDuracion: 'M', duracion: 12 })), '2027-02-27');
  const suf = String(Date.now()).slice(-6);
  const casos = [['PDI', 3], ['TRI', 85], ['ANU', 340]];
  for (const [i, [membresiaId, total]] of casos.entries()) {
    const ced = cedula(`17${i}${suf}`);
    const creado = await rec.post('/admin/clientes', { cedula: ced, nombre: 'Plan', apellido: 'Fase' });
    assert.equal(creado.status, 201, JSON.stringify(creado.body));
    const r = await rec.post('/admin/inscripciones', { clienteId: ced, membresiaId, pagos: [{ metodoPago: 'EF', monto: total }] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.total, total);
    assert.ok(r.body.fechaFin);
  }
});
