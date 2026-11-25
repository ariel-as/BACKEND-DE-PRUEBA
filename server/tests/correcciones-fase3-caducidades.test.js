import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { tokens, api } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { addDays, asDate, localToday } from '../utils/dates.js';

test('correcciones fase 3 §3.1 y §3.2: caducidades en productos y alertas', async () => {
  const tk = await tokens(), adm = api(tk.ADM), cli = api(tk.CLI);
  const idCad = `PC${Date.now()}`.slice(0, 13), idSin = `PS${Date.now()}`.slice(0, 13);
  const pronto = addDays(localToday(), 5), lejano = addDays(localToday(), 20);
  try {
    for (const [id, nombre, controla, stockMin] of [[idCad, 'Caducidad de prueba', 'S', 30], [idSin, 'Sin control de prueba', 'N', 1]]) {
      const r = await adm.post('/productos', { id, nombre, categoriaId: 'SUP', precio: 10, stock: 0, stockMin, pagaIva: 'N', esContable: 'S', controlaCaducidad: controla, publicarWeb: 'N', estado: 'A' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    await prisma.loteProducto.create({ data: { productoId: idCad, cantidadInicial: 10, cantidadDisponible: 10, costoUnit: 2, fechaCaducidad: asDate(lejano) } });
    await prisma.loteProducto.create({ data: { productoId: idCad, cantidadInicial: 5, cantidadDisponible: 5, costoUnit: 2, fechaCaducidad: asDate(pronto) } });
    await prisma.loteProducto.create({ data: { productoId: idSin, cantidadInicial: 1, cantidadDisponible: 1, costoUnit: 1, fechaCaducidad: asDate(addDays(localToday(), 1)) } });
    await prisma.producto.update({ where: { id: idCad }, data: { stock: 15 } });
    await prisma.producto.update({ where: { id: idSin }, data: { stock: 1 } });
    assert.equal((await request(app).get('/api/v1/admin/productos')).status, 401);
    assert.equal((await cli.get('/admin/productos')).status, 403);
    assert.equal((await adm.get('/admin/productos?orden=fecha')).status, 400);
    assert.equal((await adm.get('/admin/productos?foo=1')).status, 400);
    const lista = await adm.get('/admin/productos?orden=caducidad&limit=100');
    assert.equal(lista.status, 200, JSON.stringify(lista.body));
    const filas = lista.body.data;
    assert.ok(filas.length > 0);
    const nulos = filas.map((p) => !p.proximaCaducidad);
    assert.ok(nulos.every((v, i) => i === 0 || nulos[i - 1] <= v));
    const fechas = filas.filter((p) => p.proximaCaducidad).map((p) => p.proximaCaducidad);
    assert.deepEqual(fechas, [...fechas].sort());
    for (const p of filas.filter((x) => x.proximaCaducidad)) assert.equal(p.diasParaCaducar, Math.round((new Date(`${p.proximaCaducidad}T12:00:00-05:00`) - new Date(`${addDays(localToday(), 0)}T12:00:00-05:00`)) / 86400000));
    const detalle = await adm.get(`/admin/productos/${idCad}`);
    assert.equal(detalle.status, 200, JSON.stringify(detalle.body));
    assert.equal(detalle.body.proximaCaducidad, pronto);
    assert.equal(detalle.body.diasParaCaducar, 5);
    const detalleSin = await adm.get(`/admin/productos/${idSin}`);
    assert.equal(detalleSin.body.proximaCaducidad, null);
    assert.equal(detalleSin.body.diasParaCaducar, null);
    assert.equal((await adm.get('/admin/productos/NOEXISTE')).status, 404);
    const alertas = await adm.get('/admin/inventario/alertas');
    assert.equal(alertas.status, 200, JSON.stringify(alertas.body));
    const fila = alertas.body.sinStockYMinimo.find((p) => p.productoId === idCad);
    assert.equal(fila.proximaCaducidad, pronto);
    assert.equal(fila.diasParaCaducar, 5);
    const filaSin = alertas.body.sinStockYMinimo.find((p) => p.productoId === idSin);
    assert.equal(filaSin.proximaCaducidad, null);
    assert.equal(filaSin.diasParaCaducar, null);
  } finally {
    await prisma.loteProducto.deleteMany({ where: { productoId: { in: [idCad, idSin] } } });
    await prisma.producto.updateMany({ where: { id: { in: [idCad, idSin] } }, data: { estado: 'I', publicarWeb: 'N' } });
  }
});
