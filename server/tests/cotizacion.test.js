import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift } from './helpers.js';

test('cotización de venta en mostrador', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC);
  await ensureShift(tk.REC);
  const stamp = String(Date.now()).slice(-9), a = `QA${stamp}`, b = `QB${stamp}`;
  const prod = (id, nombre, precio, pagaIva) => adm.post('/productos', { id, nombre, categoriaId: 'ACC', precio, stock: 10, stockMin: 0, costoUnit: 1, pagaIva, esContable: 'S', controlaCaducidad: 'N', publicarWeb: 'N', estado: 'A' });
  assert.equal((await prod(a, `Cotiza IVA ${stamp}`, 4.49, 'S')).status, 201);
  assert.equal((await prod(b, `Cotiza sin IVA ${stamp}`, 2.35, 'N')).status, 201);
  const items = [{ productoId: a, cantidad: 3, descuento: 0.37 }, { productoId: a, cantidad: 1 }, { productoId: b, cantidad: 2 }];
  await t.test('la cotización da el mismo total que la venta', async () => {
    const q = await rec.post('/admin/ventas/cotizacion', { items });
    assert.equal(q.status, 200, JSON.stringify(q.body));
    const la = q.body.lineas.find((l) => l.productoId === a);
    assert.equal(la.cantidad, 4); assert.equal(la.precioUnitario, 4.49); assert.equal(la.descuento, 0.37);
    assert.equal(la.subtotal, 17.59); assert.ok(la.iva > 0); assert.equal(la.total, +(la.subtotal + la.iva).toFixed(2));
    assert.equal(q.body.subtotal0, 4.7); assert.equal(q.body.subtotalIva, 17.59);
    assert.equal(q.body.total, +(q.body.subtotal0 + q.body.subtotalIva + q.body.valorIva).toFixed(2));
    const stock = (await adm.get(`/productos/${a}`)).body.stock;
    const v = await rec.post('/admin/ventas', { items, pagos: [{ metodoPago: 'EF', monto: q.body.total }] });
    assert.equal(v.status, 201, JSON.stringify(v.body));
    assert.equal(v.body.total, q.body.total);
    if (stock !== undefined) assert.equal((await adm.get(`/productos/${a}`)).body.stock, stock - 4);
  });
  await t.test('sin stock suficiente responde 409 con el disponible', async () => {
    const r = await rec.post('/admin/ventas/cotizacion', { items: [{ productoId: b, cantidad: 999 }] });
    assert.equal(r.status, 409);
    assert.ok(JSON.stringify(r.body).includes(b));
    assert.ok(JSON.stringify(r.body).includes('disponible'));
  });
  await t.test('no acepta pagos', async () => {
    assert.equal((await rec.post('/admin/ventas/cotizacion', { items, pagos: [] })).status, 400);
  });
});
