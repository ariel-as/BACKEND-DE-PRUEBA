import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { addDays, asDate, localToday } from '../utils/dates.js';

test('metodoSalida de lotes sigue a controlaCaducidad', async () => {
  const tk = await tokens(), adm = api(tk.ADM);
  const id = `PM${Date.now()}`.slice(0, 13);
  try {
    const r = await adm.post('/productos', { id, nombre: 'Barra con caducidad de prueba', categoriaId: 'SUP', precio: 3, stock: 0, stockMin: 1, pagaIva: 'N', esContable: 'S', controlaCaducidad: 'S', publicarWeb: 'N', estado: 'A' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal((await prisma.producto.findUnique({ where: { id } })).metodoSalida, 'E');
    await prisma.loteProducto.create({ data: { productoId: id, cantidadInicial: 4, cantidadDisponible: 4, costoUnit: 1, fechaCaducidad: asDate(addDays(localToday(), 40)) } });
    await prisma.producto.update({ where: { id }, data: { stock: 4 } });
    const fifo = await adm.get(`/admin/inventario/lotes?productoId=${id}&metodoSalida=FIFO`);
    assert.equal(fifo.status, 200, JSON.stringify(fifo.body));
    assert.equal(fifo.body.data.length, 0);
    const fefo = await adm.get(`/admin/inventario/lotes?productoId=${id}&metodoSalida=FEFO`);
    assert.equal(fefo.status, 200, JSON.stringify(fefo.body));
    assert.equal(fefo.body.data.length, 1);
    assert.equal(fefo.body.data[0].metodoSalida, 'FEFO');
    const alertas = await adm.get('/admin/inventario/alertas');
    assert.equal(alertas.status, 200, JSON.stringify(alertas.body));
    for (const p of alertas.body.sinStockYMinimo) assert.ok(['FEFO', 'FIFO'].includes(p.metodoSalida), JSON.stringify(p));
    // Editar solo otro campo corrige y conserva el método según controlaCaducidad.
    assert.equal((await adm.put(`/productos/${id}`, { nombre: 'Barra con caducidad editada' })).status, 200);
    let guardado = await prisma.producto.findUnique({ where: { id } });
    assert.equal(guardado.controlaCaducidad, 'S');
    assert.equal(guardado.metodoSalida, 'E');
    assert.equal((await adm.put(`/productos/${id}`, { controlaCaducidad: 'N' })).status, 200);
    guardado = await prisma.producto.findUnique({ where: { id } });
    assert.equal(guardado.metodoSalida, 'F');
    assert.equal((await adm.get(`/admin/inventario/lotes?productoId=${id}&metodoSalida=FIFO`)).body.data.length, 1);
  } finally {
    await prisma.loteProducto.deleteMany({ where: { productoId: id } });
    await prisma.producto.updateMany({ where: { id }, data: { estado: 'I', publicarWeb: 'N' } });
  }
});
