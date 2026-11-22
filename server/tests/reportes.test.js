import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('reportes de prioridad 2 (4.16)', async (t) => {
  const tk = await tokens(), rec = api(tk.REC), con = api(tk.CON), ent = api(tk.ENT);
  await ensureShift(tk.REC);
  // Una venta en mostrador para que los reportes de ventas y ganancia tengan datos de hoy.
  const venta = await rec.post('/admin/ventas', { items: [{ productoId: 'PF0001', cantidad: 1 }], pagos: [{ metodoPago: 'EF', monto: 0.01 }] });
  const total = venta.status === 400 ? Number(venta.body.mensaje.match(/total: (\d+\.\d{2})/)?.[1]) : null;
  if (total) assert.equal((await rec.post('/admin/ventas', { items: [{ productoId: 'PF0001', cantidad: 1 }], pagos: [{ metodoPago: 'EF', monto: total }] })).status, 201);

  await t.test('permisos: REC ve clientes y entradas, no ventas; ENT no entra; CON ve todo', async () => {
    assert.equal((await rec.get('/admin/reportes/clientes')).status, 200);
    assert.equal((await rec.get('/admin/reportes/entradas')).status, 200);
    assert.equal((await rec.get('/admin/reportes/ventas')).status, 403);
    assert.equal((await ent.get('/admin/reportes/clientes')).status, 403);
    for (const r of ['clientes', 'entradas', 'ventas', 'ganancia', 'inventario', 'inscripciones', 'caja']) assert.equal((await con.get(`/admin/reportes/${r}`)).status, 200, r);
  });
  await t.test('clientes: activos, por vencer y vencidos', async () => {
    const r = await con.get('/admin/reportes/clientes?dias=30');
    assert.ok(r.body.resumen.activos >= 1); assert.ok(Array.isArray(r.body.porVencer)); assert.ok(Array.isArray(r.body.vencidos));
    assert.ok(r.body.porVencer.every((x) => x.diasRestantes <= 30));
  });
  await t.test('entradas: por día, por hora y pico frente al aforo', async () => {
    const r = await con.get('/admin/reportes/entradas');
    assert.ok(r.body.aforoMax > 0);
    assert.equal(r.body.porDia.reduce((n, d) => n + d.entradas, 0), r.body.totalEntradas);
    assert.equal(r.body.porHora.reduce((n, h) => n + h.entradas, 0), r.body.totalEntradas);
  });
  await t.test('ventas y ganancia de hoy cuadran con la base', async () => {
    const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const v = await con.get(`/admin/reportes/ventas?desde=${hoy}&hasta=${hoy}`);
    assert.ok(v.body.porProducto.some((p) => p.productoId === 'PF0001' && p.canal === 'L'));
    const g = await con.get(`/admin/reportes/ganancia?desde=${hoy}&hasta=${hoy}`);
    const p = g.body.productos.find((x) => x.productoId === 'PF0001');
    assert.ok(p.cantidad >= 1); assert.equal(Number((p.ingresoNeto - p.costo).toFixed(2)), p.ganancia);
  });
  await t.test('inventario: valorizado igual a stock × costo promedio, y bajo mínimo', async () => {
    const r = await con.get('/admin/reportes/inventario?productoId=PF0011');
    const prod = await prisma.producto.findUnique({ where: { id: 'PF0004' } });
    const fila = r.body.valorizado.find((x) => x.productoId === 'PF0004');
    assert.equal(fila.valor, Number((Number(prod.costoPromedio) * prod.stock).toFixed(2)));
    assert.ok(r.body.bajoMinimo.some((x) => x.productoId === 'PF0011'));
    assert.ok(Array.isArray(r.body.kardex) && r.body.kardex.length >= 1);
  });
  await t.test('inscripciones y caja', async () => {
    const i = await con.get('/admin/reportes/inscripciones');
    assert.equal(i.body.total, Number(i.body.porPlan.reduce((n, p) => n + p.monto, 0).toFixed(2)));
    const c = await con.get('/admin/reportes/caja');
    assert.ok(c.body.resumen.cuadres >= 1); assert.ok('faltantes' in c.body.resumen);
  });
  await t.test('CSV y validaciones', async () => {
    const r = await con.get('/admin/reportes/inventario?formato=csv&seccion=bajoMinimo');
    assert.equal(r.status, 200); assert.match(r.headers['content-type'], /text\/csv/); assert.match(r.text, /productoId,nombre,stock/);
    assert.equal((await con.get('/admin/reportes/ventas?formato=pdf')).status, 400);
    assert.equal((await con.get('/admin/reportes/ventas?desde=2026-12-01&hasta=2026-11-01')).status, 400);
    assert.equal((await con.get('/admin/reportes/caja?formato=csv&seccion=otra')).status, 400);
  });
  await prisma.$disconnect();
});
