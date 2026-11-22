import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('pedidos web: convertir en venta y entregar (4.10)', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC), cli = api(tk.CLI);
  const id = `PW${Date.now()}`.slice(0, 13);
  const created = await adm.post('/productos', { id, nombre: 'Producto pedido web', categoriaId: 'ACC', precio: 10, stock: 3, stockMin: 0, costoUnit: 4, pagaIva: 'S', esContable: 'S', controlaCaducidad: 'N', publicarWeb: 'S', estado: 'A' });
  assert.equal(created.status, 201);
  await ensureShift(tk.REC);
  let tr;
  await t.test('pedido TR con comprobante nace en R y no mueve stock', async () => {
    const r = await cli.post('/pedidos', { metodoPago: 'TR', refTransferencia: 'BANCO-1234', items: [{ productoId: id, cantidad: 2 }] });
    assert.equal(r.status, 201); assert.equal(r.body.estado, 'R'); tr = r.body;
    assert.equal((await prisma.producto.findUnique({ where: { id } })).stock, 3);
  });
  await t.test('pedido en efectivo no se reporta como transferencia', async () => {
    const ef = await cli.post('/pedidos', { metodoPago: 'EF', items: [{ productoId: id, cantidad: 1 }] });
    assert.equal((await rec.patch(`/pedidos/${ef.body.id}/estado`, { estado: 'R', refTransferencia: 'ABCD-12' })).status, 409);
    assert.equal((await cli.patch(`/pedidos/${ef.body.id}/cancelar`)).status, 200);
  });
  await t.test('R→C convierte en venta con kárdex, pago y caja', async () => {
    const r = await rec.patch(`/pedidos/${tr.id}/estado`, { estado: 'C' });
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.estado, 'C'); assert.ok(r.body.ventaId);
    const venta = await prisma.venta.findUnique({ where: { id: r.body.ventaId }, include: { detalleVentas: true, pagos: { include: { movimientoCajas: true } }, kardexs: true } });
    assert.equal(venta.canal, 'W'); assert.equal(venta.pedidoId, tr.id); assert.equal(venta.clienteId, '1712345675');
    assert.equal(Number(venta.total), tr.total); assert.equal(venta.detalleVentas[0].cantidad, 2);
    assert.equal(venta.kardexs.filter((k) => k.tipoMovimientoId === 'VEN').reduce((n, k) => n + k.cantidad, 0), 2);
    assert.equal(venta.pagos.length, 1); assert.equal(venta.pagos[0].metodoPagoId, 'TR'); assert.equal(venta.pagos[0].referencia, 'BANCO-1234');
    assert.equal(venta.pagos[0].movimientoCajas[0].tipoMovimientoId, 'ING');
    assert.equal((await prisma.producto.findUnique({ where: { id } })).stock, 1);
  });
  await t.test('C→E guarda la fecha de retiro y avisa al cliente', async () => {
    const r = await rec.patch(`/pedidos/${tr.id}/estado`, { estado: 'E' });
    assert.equal(r.status, 200); assert.ok(r.body.fechaRetiro);
    assert.ok(await prisma.notificacion.findFirst({ where: { pedidoId: tr.id, tipo: 'L' } }));
  });
  let ef;
  await t.test('cobro con monto distinto al total se rechaza y el pedido queda en P', async () => {
    ef = await cli.post('/pedidos', { metodoPago: 'EF', items: [{ productoId: id, cantidad: 1 }] });
    const r = await rec.patch(`/pedidos/${ef.body.id}/estado`, { estado: 'C', pagos: [{ metodoPago: 'EF', monto: 1 }] });
    assert.equal(r.status, 400); assert.match(r.body.mensaje, /11\.50/);
    assert.equal((await prisma.pedido.findUnique({ where: { id: ef.body.id } })).estado, 'P');
  });
  await t.test('si ya no alcanza el stock al convertir, 409 y el pedido sigue en P', async () => {
      assert.equal((await adm.put(`/productos/${id}`, { stock: 0, motivoAjuste: 'Prueba sin stock' })).status, 200);
      const c = await rec.patch(`/pedidos/${ef.body.id}/estado`, { estado: 'C' });
      assert.equal(c.status, 409);
      assert.equal((await prisma.pedido.findUnique({ where: { id: ef.body.id } })).estado, 'P');
      assert.equal(await prisma.venta.count({ where: { pedidoId: ef.body.id } }), 0);
  });
});
