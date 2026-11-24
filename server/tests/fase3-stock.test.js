import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('fase 3 §2: stock en respuestas y 409 con productoId, nombre y disponible', async () => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC), cli = api(tk.CLI);
  const id = `S3${String(Date.now()).slice(-10)}`;
  assert.equal((await adm.post('/productos', { id, nombre: 'Producto sin stock fase 3', categoriaId: 'ACC', precio: 10, stock: 1, stockMin: 0, costoUnit: 4, pagaIva: 'S', esContable: 'S', controlaCaducidad: 'N', publicarWeb: 'S', estado: 'A' })).status, 201);
  const verificar = (r, disponible) => {
    assert.equal(r.status, 409, JSON.stringify(r.body));
    for (const d of [r.body.detalles?.[0], r.body]) {
      assert.equal(d?.productoId, id);
      assert.equal(d?.nombre, 'Producto sin stock fase 3');
      assert.equal(d?.disponible, disponible);
    }
  };
  verificar(await cli.post('/pedidos', { metodoPago: 'EF', items: [{ productoId: id, cantidad: 2 }] }), 1);
  verificar(await rec.post('/admin/ventas', { items: [{ productoId: id, cantidad: 2 }], pagos: [{ metodoPago: 'EF', monto: 1 }] }), 1);
  const pedido = await cli.post('/pedidos', { metodoPago: 'EF', items: [{ productoId: id, cantidad: 1 }] });
  assert.equal(pedido.status, 201);
  assert.equal((await adm.put(`/productos/${id}`, { stock: 0, motivoAjuste: 'Sin stock para convertir' })).status, 200);
  verificar(await rec.patch(`/pedidos/${pedido.body.id}/estado`, { estado: 'C' }), 0);
  assert.equal((await prisma.pedido.findUnique({ where: { id: pedido.body.id } })).estado, 'P');
  const catalogo = (await cli.get('/productos?limit=100')).body.data.find((p) => p.id === id);
  assert.equal(catalogo.stock, 0); assert.equal(catalogo.disponible, false);
  await prisma.$disconnect();
});
