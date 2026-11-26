import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { dateStr, daysBetween, localToday } from '../utils/dates.js';

const iso = (days) => new Date(`${new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)}T12:00:00-05:00`);

test('fase 3 §1: tipo de inventario, filtros, alertas y reporte', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC), con = api(tk.CON), ent = api(tk.ENT);
  const sufijo = String(Date.now()).slice(-8);
  const fefoId = `F3F${sufijo}`, fifoId = `F3N${sufijo}`;
  const common = { unidadMedidaId: 'UND', precioVenta: '10.00', costoPromedio: '4.0000', pagaIva: 'S', esContable: 'S', publicarWeb: 'S', estado: 'A' };
  await prisma.producto.create({ data: { ...common, id: fefoId, categoriaId: 'SUP', nombre: `F3 FEFO ${sufijo}`, stock: 5, stockMin: 10, controlaCaducidad: 'S', diasAlertaCad: 10, metodoSalida: 'E' } });
  await prisma.producto.create({ data: { ...common, id: fifoId, categoriaId: 'BEB', nombre: `F3 FIFO ${sufijo}`, stock: 2, stockMin: 3, controlaCaducidad: 'N', diasAlertaCad: null, metodoSalida: 'F' } });
  const lote = (productoId, fechaCaducidad, cantidadDisponible, estado = 'D', cantidadInicial = cantidadDisponible) => prisma.loteProducto.create({ data: { productoId, fechaIngreso: iso(-20), fechaCaducidad, cantidadInicial, cantidadDisponible, costoUnit: '4.00', estado } });
  const soon = await lote(fefoId, iso(5), 4);
  const far = await lote(fefoId, iso(100), 1);
  const vencido = await lote(fefoId, iso(-2), 1);
  const agotado = await lote(fefoId, iso(200), 0, 'A', 1);
  await lote(fifoId, null, 2);

  await t.test('productos y lotes exponen FEFO/FIFO y controlaCaducidad booleano', async () => {
    const admin = await adm.get('/admin/productos?limit=100');
    assert.equal(admin.status, 200);
    const a = admin.body.data.find((p) => p.id === fefoId), b = admin.body.data.find((p) => p.id === fifoId);
    assert.deepEqual([a.metodoSalida, a.controlaCaducidad, a.stock, a.disponible], ['FEFO', true, 5, true]);
    assert.deepEqual([b.metodoSalida, b.controlaCaducidad], ['FIFO', false]);
    const publico = await api(tk.CLI).get('/productos?limit=100');
    const c = publico.body.data.find((p) => p.id === fefoId);
    assert.equal(c.metodoSalida, 'FEFO'); assert.equal(c.controlaCaducidad, true); assert.equal(c.stock, 5); assert.equal(c.disponible, true);
    const lotes = await con.get(`/admin/inventario/lotes?productoId=${fefoId}&limit=100`);
    assert.equal(lotes.status, 200);
    assert.ok(lotes.body.data.every((l) => l.metodoSalida === 'FEFO' && l.controlaCaducidad === true));
  });

  await t.test('filtros de lotes: método, categoría, rango, conStock y estado', async () => {
    const get = async (qs) => (await con.get(`/admin/inventario/lotes?${qs}&limit=100`)).body.data.map((l) => l.id);
    assert.ok((await get(`productoId=${fefoId}&metodoSalida=FEFO`)).includes(soon.id));
    assert.ok(!(await get(`productoId=${fefoId}&metodoSalida=FIFO`)).includes(soon.id));
    assert.ok((await get(`productoId=${fefoId}&categoriaId=SUP`)).includes(far.id));
    assert.ok(!(await get(`productoId=${fefoId}&categoriaId=BEB`)).includes(far.id));
    const desde = iso(4).toISOString().slice(0, 10), hasta = iso(6).toISOString().slice(0, 10);
    assert.deepEqual(await get(`productoId=${fefoId}&caducaDesde=${desde}&caducaHasta=${hasta}`), [soon.id]);
    const conStock = await get(`productoId=${fefoId}&conStock=S`);
    assert.equal(conStock.length, 3); assert.ok(!conStock.includes(agotado.id));
    assert.ok(!(await get(`productoId=${fefoId}&estado=A`)).includes(soon.id));
    assert.ok((await get(`productoId=${fefoId}&estado=A`)).length >= 1);
    assert.ok((await get(`productoId=${fefoId}&porCaducar=S`)).includes(soon.id));
    assert.ok(!(await get(`productoId=${fefoId}&porCaducar=S`)).includes(far.id));
  });

  await t.test('alertas: tres listas, conteos, días restantes y permisos', async () => {
    const r = await rec.get('/admin/inventario/alertas');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.porCaducar.some((l) => l.id === soon.id && l.diasRestantes === daysBetween(localToday(), dateStr(iso(5)))));
    assert.ok(r.body.caducadosConUnidades.some((l) => l.id === vencido.id && l.diasRestantes < 0));
    assert.ok(r.body.sinStockYMinimo.some((p) => p.productoId === fefoId && p.stock === 5 && p.stockMin === 10));
    assert.equal(r.body.conteos.lotesPorCaducar, r.body.porCaducar.length);
    assert.equal(r.body.conteos.lotesCaducados, r.body.caducadosConUnidades.length);
    assert.equal(r.body.conteos.productosSinStock, r.body.sinStockYMinimo.length);
    assert.equal((await ent.get('/admin/inventario/alertas')).status, 403);
    assert.equal((await con.get('/admin/inventario/alertas')).status, 200);
  });

  await t.test('resumen y reporte incluyen los conteos y los filtros nuevos', async () => {
    for (const who of [adm, rec, con]) {
      const r = await who.get('/admin/resumen');
      assert.equal(r.status, 200);
      for (const k of ['lotesPorCaducar', 'lotesCaducados', 'productosSinStock']) assert.equal(typeof r.body[k], 'number', k);
      assert.ok(r.body.productosSinStock >= 1);
    }
    const r = await con.get(`/admin/reportes/inventario?metodoSalida=FIFO&categoriaId=BEB`);
    assert.equal(r.status, 200);
    assert.ok(r.body.valorizado.some((p) => p.productoId === fifoId && p.metodoSalida === 'FIFO'));
    assert.ok(!r.body.valorizado.some((p) => p.productoId === fefoId));
    const caduca = await con.get(`/admin/reportes/inventario?caducaDesde=${iso(4).toISOString().slice(0, 10)}&caducaHasta=${iso(6).toISOString().slice(0, 10)}`);
    assert.ok(caduca.body.porCaducar.some((l) => l.loteId === soon.id));
    assert.ok(!caduca.body.porCaducar.some((l) => l.loteId === far.id));
    assert.equal((await con.get('/admin/reportes/inventario?metodoSalida=XX')).status, 400);
  });
});
