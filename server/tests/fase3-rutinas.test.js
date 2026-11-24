import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, cedula, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { localToday } from '../utils/dates.js';

test('fase 3 §5: plantillas, detalle validado, ficha y permisos de rutina', async () => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC), ent = api(tk.ENT);
  await ensureShift(tk.REC);
  const plantillas = await ent.get('/admin/rutinas/plantillas');
  assert.equal(plantillas.status, 200, JSON.stringify(plantillas.body));
  assert.deepEqual(plantillas.body.map((p) => p.nivel), ['PRI', 'INT', 'AVA']);
  assert.deepEqual(plantillas.body.map((p) => p.dias.length), [3, 4, 5]);
  assert.ok(plantillas.body.every((p) => p.editable && p.dias.every((d) => d.editable && d.ejercicios.length >= 8)));
  assert.equal((await rec.get('/admin/rutinas/plantillas')).status, 200);
  const ejercicios = await ent.get('/admin/rutinas/ejercicios');
  assert.equal(ejercicios.status, 200, JSON.stringify(ejercicios.body));
  assert.ok(['Pecho', 'Espalda', 'Pierna', 'Core'].every((g) => ejercicios.body.some((e) => e.grupo === g && e.editable && e.ejercicios.length >= 5)));

  const suf = String(Date.now()).slice(-6), clienteId = cedula(`173${suf}`), sinRutina = cedula(`174${suf}`);
  assert.equal((await rec.post('/admin/clientes', { cedula: clienteId, nombre: 'Rutina', apellido: 'Fase Tres' })).status, 201);
  assert.equal((await rec.post('/admin/clientes', { cedula: sinRutina, nombre: 'Diario', apellido: 'Fase Tres' })).status, 201);
  const ins = async (clienteId, membresiaId, monto) => {
    const r = await rec.post('/admin/inscripciones', { clienteId, membresiaId, fechaInicio: localToday(), pagos: [{ metodoPago: 'EF', monto }] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body;
  };
  await ins(clienteId, 'MI1', 35);
  await ins(sinRutina, 'PDI', 3);

  const detalle = { editable: true, dias: plantillas.body[0].dias };
  assert.ok(JSON.stringify(detalle).length > 1000);
  const invalida = await ent.post('/admin/rutinas', { clienteId, nivelId: 'PRI', objetivo: 'Tonificar', detalle: { editable: true, dias: [{ nombre: 'Día 1', ejercicios: [{ nombre: 'Sentadilla', series: 0, repeticiones: 12, descanso: '60s', nota: '' }] }] } });
  assert.equal(invalida.status, 400, JSON.stringify(invalida.body));
  const creada = await ent.post('/admin/rutinas', { clienteId, nivelId: 'PRI', objetivo: 'Tonificar', detalle });
  assert.equal(creada.status, 201, JSON.stringify(creada.body));
  assert.equal(creada.body.detalle.dias.length, 3);
  assert.equal(creada.body.detalle.dias[0].ejercicios[0].series, 3);
  const guardada = await prisma.rutina.findUnique({ where: { id: creada.body.id } });
  assert.ok(guardada.detalle.length > 1000);

  const ficha = await ent.get(`/admin/rutinas/cliente/${clienteId}`);
  assert.equal(ficha.status, 200, JSON.stringify(ficha.body));
  assert.equal(ficha.body.cedula, clienteId);
  assert.equal(ficha.body.planActivo.nombre, 'Plan individual');
  assert.equal(ficha.body.planActivo.incluyeRutina, 'S');
  assert.equal(ficha.body.rutinaVigente.id, creada.body.id);
  assert.equal(ficha.body.rutinaVigente.entrenador, 'Entrenador Cuatro');
  assert.equal(JSON.stringify(ficha.body).match(/precio|valor|descuento|iva|pago|factura|monto/i), null);

  const mias = await ent.get('/admin/rutinas?mias=S');
  assert.equal(mias.status, 200, JSON.stringify(mias.body));
  assert.ok(mias.body.data.some((r) => r.id === creada.body.id));
  assert.ok(mias.body.data.every((r) => r.empleadoId === creada.body.empleadoId && ['vigente', 'por vencer'].includes(r.estado)));
  assert.equal((await ent.get('/admin/rutinas?otro=1')).status, 400);

  await prisma.rutina.update({ where: { id: creada.body.id }, data: { empleadoId: '1700000019' } });
  assert.equal((await ent.put(`/admin/rutinas/${creada.body.id}`, { objetivo: 'Otro' })).status, 404);
  assert.equal((await rec.put(`/admin/rutinas/${creada.body.id}`, { objetivo: 'Otro' })).status, 403);
  assert.equal((await adm.put(`/admin/rutinas/${creada.body.id}`, { objetivo: 'Otro' })).status, 200);

  const sinPlan = await ent.post('/admin/rutinas', { clienteId: sinRutina, nivelId: 'PRI', objetivo: 'Tonificar', detalle });
  assert.equal(sinPlan.status, 409, JSON.stringify(sinPlan.body));
  await prisma.$disconnect();
});
