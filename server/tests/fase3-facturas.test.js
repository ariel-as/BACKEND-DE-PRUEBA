import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { digitoVerificador } from '../services/invoice.service.js';

test('fase 3 §4: facturas emitidas al generarlas y pendientes', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC);
  await ensureShift(tk.REC);
  const id = `PF${Date.now()}`.slice(0, 13);
  const gym = (await rec.get('/admin/gimnasio')).body;
  const secuencial = (f) => Number(f.numComprobante.slice(-9));
  assert.equal((await adm.post('/productos', { id, nombre: 'Producto facturación automática', categoriaId: 'ACC', precio: 10, stock: 20, stockMin: 0, costoUnit: 4, pagaIva: 'S', esContable: 'S', controlaCaducidad: 'N', publicarWeb: 'N', estado: 'A' })).status, 201);
  const vender = async () => {
    const r = await rec.post('/admin/ventas', { items: [{ productoId: id, cantidad: 1 }], pagos: [{ metodoPago: 'EF', monto: 11.5 }] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body;
  };
  const facturar = async (ventaId) => {
    const r = await rec.post('/admin/facturas', { ventaId });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body;
  };
  let primera, segunda;
  await t.test('la factura nace emitida con número, clave y datos simulados', async () => {
    const venta = await vender();
    primera = await facturar(venta.id);
    assert.equal(primera.estado, 'E'); assert.equal(primera.estadoNombre, 'Emitida');
    assert.equal(primera.simulado, true); assert.equal(primera.ambiente, 'Pruebas');
    assert.ok(primera.numComprobante.startsWith(`${gym.establecimiento}-${gym.puntoEmision}-`));
    assert.match(primera.numComprobante, /^\d{3}-\d{3}-\d{9}$/);
    assert.match(primera.claveAcceso, /^\d{49}$/);
    assert.equal(primera.claveAcceso.slice(8, 10), '01');
    assert.equal(primera.claveAcceso.slice(10, 23), gym.id);
    assert.equal(primera.claveAcceso.slice(23, 24), '1');
    assert.equal(primera.claveAcceso.slice(24, 30), `${gym.establecimiento}${gym.puntoEmision}`);
    assert.equal(primera.claveAcceso.slice(30, 39), primera.numComprobante.slice(-9));
    assert.equal(primera.claveAcceso.slice(47, 48), '1');
    assert.equal(Number(primera.claveAcceso.slice(-1)), digitoVerificador(primera.claveAcceso.slice(0, -1)));
    assert.equal(primera.fechaAutorizacion, primera.fecha);
  });
  await t.test('dos facturas seguidas tienen secuenciales consecutivos', async () => {
    const venta = await vender();
    segunda = await facturar(venta.id);
    assert.equal(secuencial(segunda), secuencial(primera) + 1);
    assert.notEqual(segunda.claveAcceso, primera.claveAcceso);
  });
  await t.test('dos facturas al mismo tiempo no repiten número', async () => {
    const v3 = await vender(), v4 = await vender();
    const [a, b] = await Promise.all([facturar(v3.id), facturar(v4.id)]);
    const numeros = [secuencial(a), secuencial(b)].sort((x, y) => x - y);
    assert.deepEqual(numeros, [secuencial(segunda) + 1, secuencial(segunda) + 2]);
    assert.notEqual(a.claveAcceso, b.claveAcceso);
  });
  await t.test('la ruta de pendientes lista ventas e inscripciones activas sin factura', async () => {
    const venta = await vender();
    const ins = await rec.post('/admin/inscripciones', { clienteId: '1712345675', membresiaId: 'PDI', pagos: [{ metodoPago: 'EF', monto: 3 }] });
    assert.equal(ins.status, 201, JSON.stringify(ins.body));
    const first = await rec.get('/admin/facturas/pendientes?limit=100');
    assert.equal(first.status, 200);
    let finding = first.body.data.find((x) => x.tipo === 'venta' && x.numero === venta.id);
    let findingIns = first.body.data.find((x) => x.tipo === 'inscripcion' && x.numero === ins.body.id);
    for (let page = 2; !(finding && findingIns) && page <= first.body.pagination.totalPages; page++) {
      const list = await rec.get(`/admin/facturas/pendientes?limit=100&page=${page}`);
      assert.equal(list.status, 200);
      finding ??= list.body.data.find((x) => x.tipo === 'venta' && x.numero === venta.id);
      findingIns ??= list.body.data.find((x) => x.tipo === 'inscripcion' && x.numero === ins.body.id);
    }
    assert.ok(finding); assert.ok(findingIns);
    assert.ok(finding.fecha); assert.ok(finding.cliente); assert.ok(finding.total >= 0);
    assert.ok(findingIns.fecha); assert.ok(findingIns.cliente); assert.equal(findingIns.total, 3);
  });
});
