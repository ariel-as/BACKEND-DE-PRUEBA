import test from 'node:test';
import assert from 'node:assert/strict';

// El token se fija antes de cargar la app porque env.js lo lee al importarse.
process.env.TAREAS_TOKEN = 'token-de-prueba-tarea-diaria-1234567890';
const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { tokens, api, cedula } = await import('./helpers.js');
const { prisma } = await import('../config/prisma.js');

const hoy = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const dia = (n) => { const d = new Date(`${hoy()}T12:00:00-05:00`); d.setUTCDate(d.getUTCDate() + n); return d; };
const correr = (token = process.env.TAREAS_TOKEN) => request(app).post('/api/v1/tareas/diarias').set('X-Tarea-Token', token);

test('tarea diaria (4.15) y notificaciones (4.14)', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), cli = api(tk.CLI), rec = api(tk.REC);
  // Fixtures en la base local: una inscripción vencida, otra que vence en 2 días y un lote caducado.
  const suf = String(Date.now()).slice(-6), a = cedula(`176${suf}`);
  await prisma.cliente.create({ data: { id: a, nombre: 'Tarea', apellido: 'Diaria', estado: 'A' } });
  const base = { membresiaId: 'MI1', precioBase: '35', valor: '35', porcentajeIva: '0', canal: 'L' };
  const vencida = await prisma.inscripcion.create({ data: { ...base, fechaInicio: dia(-40), fechaFin: dia(-10), estado: 'A', inscripcionClientes: { create: { clienteId: a, esTitular: 'S' } } } });
  const porVencer = await prisma.inscripcion.create({ data: { ...base, fechaInicio: dia(-20), fechaFin: dia(2), estado: 'A', inscripcionClientes: { create: { clienteId: a, esTitular: 'S' } } } });
  const lote = await prisma.loteProducto.create({ data: { productoId: 'PF0004', fechaIngreso: dia(-30), fechaCaducidad: dia(-1), cantidadInicial: 1, cantidadDisponible: 0, costoUnit: '1', estado: 'D' } });
  try {
    await t.test('sin token o con token incorrecto: 401', async () => {
      assert.equal((await request(app).post('/api/v1/tareas/diarias')).status, 401);
      assert.equal((await correr('otro-token')).status, 401);
    });
    let primera;
    await t.test('la primera corrida vence inscripciones, caduca lotes y crea avisos', async () => {
      const r = await correr();
      assert.equal(r.status, 200, JSON.stringify(r.body)); primera = r.body;
      assert.ok(r.body.detalle.inscripciones.includes(vencida.id));
      assert.ok(r.body.detalle.lotes.includes(lote.id));
      assert.equal((await prisma.inscripcion.findUnique({ where: { id: vencida.id } })).estado, 'V');
      assert.equal((await prisma.loteProducto.findUnique({ where: { id: lote.id } })).estado, 'C');
      assert.equal(await prisma.notificacion.count({ where: { tipo: 'V', inscripcionId: porVencer.id, clienteId: a } }), 1);
      assert.ok(await prisma.notificacion.count({ where: { tipo: 'S', productoId: 'PF0011' } }) >= 1);
    });
    await t.test('correrla otra vez el mismo día no duplica nada', async () => {
      const antes = await prisma.notificacion.count();
      const r = await correr();
      assert.equal(r.status, 200);
      assert.equal(r.body.inscripcionesVencidas, 0); assert.equal(r.body.lotesCaducados, 0);
      assert.equal(r.body.avisosClientes, 0); assert.equal(r.body.alertasPersonal, 0);
      assert.equal(await prisma.notificacion.count(), antes);
      assert.ok(primera.fecha);
    });
    await t.test('el ADM ve sus alertas y las marca como leídas; otro usuario no puede', async () => {
      const r = await adm.get('/notificaciones?noLeidas=S&limit=50');
      assert.equal(r.status, 200); assert.ok(r.body.data.length >= 1); assert.ok(r.body.noLeidas >= 1);
      const alerta = r.body.data.find((n) => n.tipo === 'S');
      assert.ok(alerta);
      assert.equal((await rec.patch(`/notificaciones/${alerta.id}/leida`)).status, 404);
      assert.equal((await cli.patch(`/notificaciones/${alerta.id}/leida`)).status, 404);
      const m = await adm.patch(`/notificaciones/${alerta.id}/leida`);
      assert.equal(m.status, 200); assert.equal(m.body.leida, true);
    });
    await t.test('una alerta de stock mínimo ya leída no se repite el mismo día', async () => {
      const r = await correr();
      assert.equal(r.body.alertasPersonal, 0);
    });
    await t.test('el cliente web lista sus notificaciones', async () => {
      const r = await cli.get('/notificaciones');
      assert.equal(r.status, 200); assert.ok(Array.isArray(r.body.data)); assert.ok('pagination' in r.body);
      assert.equal((await request(app).get('/api/v1/notificaciones')).status, 401);
    });
  } finally {
    await prisma.notificacion.deleteMany({ where: { OR: [{ inscripcionId: { in: [vencida.id, porVencer.id] } }, { loteProductoId: lote.id }] } });
    await prisma.inscripcionCliente.deleteMany({ where: { inscripcionId: { in: [vencida.id, porVencer.id] } } });
    await prisma.inscripcion.deleteMany({ where: { id: { in: [vencida.id, porVencer.id] } } });
    await prisma.loteProducto.delete({ where: { id: lote.id } });
    await prisma.cliente.delete({ where: { id: a } });
    await prisma.$disconnect();
  }
});
