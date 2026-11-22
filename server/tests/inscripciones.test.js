import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift, cedula } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('clientes (4.4) e inscripciones en el local (4.6)', async (t) => {
  const tk = await tokens(), rec = api(tk.REC), ent = api(tk.ENT), cli = api(tk.CLI);
  await ensureShift(tk.REC);
  const suf = String(Date.now()).slice(-6), titular = cedula(`171${suf}`), extra = cedula(`172${suf}`);
  let ins;
  await t.test('recepción crea y edita clientes con cédula validada', async () => {
    const r = await rec.post('/admin/clientes', { cedula: titular, nombre: 'Titular', apellido: 'Prueba', nivelId: 'PRI', telefono: '0991234567', correo: `titular${suf}@correo.ec` });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal((await rec.post('/admin/clientes', { cedula: titular, nombre: 'Otro', apellido: 'Igual' })).status, 409);
    assert.equal((await rec.post('/admin/clientes', { cedula: '1234567890', nombre: 'Mala', apellido: 'Cedula' })).status, 400);
    assert.equal((await ent.post('/admin/clientes', { cedula: extra, nombre: 'Sin', apellido: 'Permiso' })).status, 403);
    assert.equal((await rec.post('/admin/clientes', { cedula: extra, nombre: 'Tercer', apellido: 'Socio' })).status, 201);
    const upd = await rec.put(`/admin/clientes/${titular}`, { sector: 'Norte', ruc: '1712345675001' });
    assert.equal(upd.status, 200); assert.equal(upd.body.sector, 'Norte');
    assert.equal((await rec.put('/admin/clientes/9999999999', { nombre: 'Cambio' })).status, 409);
    const found = await ent.get(`/admin/clientes?buscar=${titular.slice(0, 6)}`);
    assert.equal(found.status, 200); assert.ok(found.body.data.some((c) => c.id === titular));
  });
  await t.test('cobro con monto distinto al total se rechaza', async () => {
    const r = await rec.post('/admin/inscripciones', { clienteId: titular, membresiaId: 'MI2', pagos: [{ metodoPago: 'EF', monto: 10 }] });
    assert.equal(r.status, 400); assert.match(r.body.mensaje, /60\.00/);
    assert.equal(await prisma.inscripcion.count({ where: { inscripcionClientes: { some: { clienteId: titular } } } }), 0);
  });
  await t.test('inscribir y cobrar con dos métodos en una transacción', async () => {
    const r = await rec.post('/admin/inscripciones', { clienteId: titular, membresiaId: 'MI2', pagos: [{ metodoPago: 'EF', monto: 40 }, { metodoPago: 'TR', monto: 20, referencia: 'TRX-5555' }] });
    assert.equal(r.status, 201, JSON.stringify(r.body)); ins = r.body;
    assert.equal(ins.estado, 'A'); assert.equal(ins.canal, 'L'); assert.equal(ins.total, 60); assert.equal(ins.pagos.length, 2);
    const movs = await prisma.movimientoCaja.findMany({ where: { pagoId: { in: ins.pagos.map((p) => p.id) } } });
    assert.equal(movs.length, 2); assert.ok(movs.every((m) => m.tipoMovimientoId === 'ING'));
  });
  await t.test('acompañantes sin superar las personas del plan', async () => {
    const r = await rec.post(`/admin/inscripciones/${ins.id}/integrantes`, { clienteId: '1700000084' });
    assert.equal(r.status, 201); assert.equal(r.body.integrantes.length, 2);
    assert.equal((await rec.post(`/admin/inscripciones/${ins.id}/integrantes`, { clienteId: extra })).status, 409);
    assert.equal((await rec.post(`/admin/inscripciones/${ins.id}/integrantes`, { clienteId: '9999999999' })).status, 409);
    assert.equal((await ent.post(`/admin/inscripciones/${ins.id}/integrantes`, { clienteId: extra })).status, 403);
  });
  await t.test('promoción que pide autorización exige un administrador activo', async () => {
    const promo = await prisma.promocion.findFirst({ where: { requiereAutoriz: 'S', membresiaPromocions: { some: { membresiaId: 'MI2' } } } });
    const sin = await rec.post('/admin/inscripciones', { clienteId: extra, membresiaId: 'MI2', promocionId: promo.id, pagos: [{ metodoPago: 'EF', monto: 54 }] });
    assert.equal(sin.status, 409);
    const noAdm = await rec.post('/admin/inscripciones', { clienteId: extra, membresiaId: 'MI2', promocionId: promo.id, empAutorizaId: '1700000050', pagos: [{ metodoPago: 'EF', monto: 54 }] });
    assert.equal(noAdm.status, 409);
    const ok = await rec.post('/admin/inscripciones', { clienteId: extra, membresiaId: 'MI2', promocionId: promo.id, empAutorizaId: '1711111110', pagos: [{ metodoPago: 'EF', monto: 54 }] });
    assert.equal(ok.status, 201, JSON.stringify(ok.body)); assert.equal(ok.body.descuento, 6); assert.equal(ok.body.empAutorizaId, '1711111110'); assert.ok(ok.body.fechaAutoriza);
  });
  await t.test('CONSUMIDOR FINAL solo compra el pase diario', async () => {
    assert.equal((await rec.post('/admin/inscripciones', { clienteId: '9999999999', membresiaId: 'MI1', pagos: [{ metodoPago: 'EF', monto: 35 }] })).status, 409);
    const r = await rec.post('/admin/inscripciones', { clienteId: '9999999999', membresiaId: 'PDI', pagos: [{ metodoPago: 'EF', monto: 3 }] });
    assert.equal(r.status, 201); assert.equal(r.body.fechaInicio, r.body.fechaFin);
  });
  await t.test('cobrar una inscripción web pendiente', async () => {
    let pending = (await rec.get('/admin/inscripciones?estado=P&clienteId=1712345675')).body.data[0];
    if (!pending) { const w = await cli.post('/inscripciones', { membresiaId: 'MI1' }); assert.equal(w.status, 201); pending = (await rec.get(`/admin/inscripciones/${w.body.id}`)).body; }
    const r = await rec.post(`/admin/inscripciones/${pending.id}/cobrar`, { pagos: [{ metodoPago: 'EF', monto: pending.total }] });
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.estado, 'A');
    assert.equal((await rec.post(`/admin/inscripciones/${pending.id}/cobrar`, { pagos: [{ metodoPago: 'EF', monto: pending.total }] })).status, 409);
  });
  await t.test('renovar empieza el día siguiente al fin y conserva a los integrantes', async () => {
    const r = await rec.post(`/admin/inscripciones/${ins.id}/renovar`, { pagos: [{ metodoPago: 'EF', monto: 60 }] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const next = new Date(`${ins.fechaFin}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    assert.equal(r.body.fechaInicio, next.toISOString().slice(0, 10));
    assert.deepEqual(r.body.integrantes.map((m) => m.clienteId).sort(), [titular, '1700000084'].sort());
  });
  await t.test('detalle e historial del cliente', async () => {
    const d = await ent.get(`/admin/inscripciones/${ins.id}`);
    assert.equal(d.status, 200); assert.equal(d.body.integrantes.length, 2);
    const h = await rec.get(`/admin/clientes/${titular}/historial`);
    assert.equal(h.status, 200); assert.equal(h.body.inscripciones.length, 2); assert.ok(h.body.pagos.length >= 3);
    assert.equal((await rec.delete(`/admin/inscripciones/${ins.id}/integrantes/${titular}`)).status, 409);
    assert.equal((await rec.delete(`/admin/inscripciones/${ins.id}/integrantes/1700000084`)).status, 200);
  });
});
