import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('detalle de facturas de venta e inscripción', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC);
  await ensureShift(tk.REC);
  const id = `FD${Date.now()}`.slice(0, 13);
  assert.equal((await adm.post('/productos', { id, nombre: 'Producto detalle factura', categoriaId: 'ACC', precio: 10, stock: 20, stockMin: 0, costoUnit: 4, pagaIva: 'S', esContable: 'S', controlaCaducidad: 'N', publicarWeb: 'N', estado: 'A' })).status, 201);
  await t.test('factura de venta trae las líneas vendidas', async () => {
    const v = await rec.post('/admin/ventas', { items: [{ productoId: id, cantidad: 2 }], pagos: [{ metodoPago: 'EF', monto: 23 }] });
    assert.equal(v.status, 201, JSON.stringify(v.body));
    const f = await rec.post('/admin/facturas', { ventaId: v.body.id });
    assert.equal(f.status, 201, JSON.stringify(f.body));
    assert.equal(f.body.detalle.length, 1);
    const g = await rec.get(`/admin/facturas/${f.body.id}`);
    assert.equal(g.status, 200);
    const [l] = g.body.detalle;
    assert.deepEqual(l, { productoId: id, descripcion: 'Producto detalle factura', cantidad: 2, precioUnitario: 10, descuento: 0, subtotal: 20, pagaIva: true });
    const list = await rec.get('/admin/facturas?limit=5');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.every((x) => x.detalle === undefined));
  });
  await t.test('factura de inscripción trae una línea con el plan', async () => {
    const ins = await rec.post('/admin/inscripciones', { clienteId: '1712345675', membresiaId: 'PDI', pagos: [{ metodoPago: 'EF', monto: 3 }] });
    assert.equal(ins.status, 201, JSON.stringify(ins.body));
    const f = await rec.post('/admin/facturas', { inscripcionId: ins.body.id });
    assert.equal(f.status, 201, JSON.stringify(f.body));
    const g = await rec.get(`/admin/facturas/${f.body.id}`);
    assert.equal(g.status, 200);
    const i = await prisma.inscripcion.findUnique({ where: { id: ins.body.id }, include: { membresiaIdRef1: true } });
    const d = (x) => x.toISOString().slice(0, 10);
    assert.equal(g.body.detalle.length, 1);
    const [l] = g.body.detalle;
    assert.equal(l.descripcion, `Plan ${i.membresiaIdRef1.nombre} (${d(i.fechaInicio)} a ${d(i.fechaFin ?? i.fechaInicio)})`);
    assert.equal(l.cantidad, 1);
    assert.equal(l.subtotal, Number(i.valor));
    assert.equal(l.descuento, Number(i.descuento));
    assert.equal(l.precioUnitario, Number(i.valor) + Number(i.descuento));
    assert.equal(l.pagaIva, Number(i.porcentajeIva) > 0);
  });
});
