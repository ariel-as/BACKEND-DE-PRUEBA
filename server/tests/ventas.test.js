import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { digitoVerificador } from '../services/invoice.service.js';

test('ventas en mostrador (4.11) y facturación (4.12)', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC), con = api(tk.CON), ent = api(tk.ENT);
  await ensureShift(tk.REC);
  const id = `PV${Date.now()}`.slice(0, 13), suf = String(Date.now()).slice(-9);
  assert.equal((await adm.post('/productos', { id, nombre: 'Producto mostrador', categoriaId: 'ACC', precio: 10, stock: 5, stockMin: 0, costoUnit: 4, pagaIva: 'S', esContable: 'S', controlaCaducidad: 'N', publicarWeb: 'N', estado: 'A' })).status, 201);
  const gym = (await rec.get('/admin/gimnasio')).body, pref = `${gym.establecimiento}-${gym.puntoEmision}-`;
  let venta, factura;
  await t.test('permisos: ENT no vende, CON lee, REC no anula', async () => {
    assert.equal((await ent.post('/admin/ventas', { items: [{ productoId: id, cantidad: 1 }], pagos: [{ metodoPago: 'EF', monto: 11.5 }] })).status, 403);
    assert.equal((await con.get('/admin/ventas')).status, 200);
    assert.equal((await rec.patch('/admin/ventas/1/anular', { motivo: 'Prueba de permiso' })).status, 403);
  });
  await t.test('el descuento no supera el valor de la línea y el pago debe ser exacto', async () => {
    assert.equal((await rec.post('/admin/ventas', { items: [{ productoId: id, cantidad: 1, descuento: 11 }], pagos: [{ metodoPago: 'EF', monto: 0.01 }] })).status, 400);
    const r = await rec.post('/admin/ventas', { items: [{ productoId: id, cantidad: 2 }], pagos: [{ metodoPago: 'EF', monto: 5 }] });
    assert.equal(r.status, 400); assert.match(r.body.mensaje, /23\.00/);
  });
  await t.test('vender: precio e IVA de la base, kárdex por lote, pagos y caja', async () => {
    const r = await rec.post('/admin/ventas', { items: [{ productoId: id, cantidad: 2, descuento: 2 }], pagos: [{ metodoPago: 'EF', monto: 10 }, { metodoPago: 'TR', monto: 10.7, referencia: 'TRX-7788' }] });
    assert.equal(r.status, 201, JSON.stringify(r.body)); venta = r.body;
    assert.equal(venta.canal, 'L'); assert.equal(venta.clienteId, '9999999999'); assert.equal(venta.subtotal, 20); assert.equal(venta.descuento, 2); assert.equal(venta.total, 20.7);
    assert.equal(venta.kardex.filter((k) => k.tipo === 'VEN').reduce((n, k) => n + k.cantidad, 0), 2);
    assert.equal((await prisma.producto.findUnique({ where: { id } })).stock, 3);
  });
  await t.test('facturar la venta y corregir el SRI a mano', async () => {
    const r = await rec.post('/admin/facturas', { ventaId: venta.id });
    assert.equal(r.status, 201, JSON.stringify(r.body)); factura = r.body;
    assert.equal(factura.subtotalIva, 18); assert.equal(factura.valorIva, 2.7); assert.equal(factura.total, 20.7); assert.equal(factura.estado, 'E'); assert.equal(factura.descuento, 2);
    assert.equal(factura.estadoNombre, 'Emitida'); assert.equal(factura.simulado, true); assert.equal(factura.ambiente, 'Pruebas');
    assert.ok(factura.numComprobante.startsWith(pref)); assert.equal(factura.claveAcceso.length, 49);
    assert.equal(Number(factura.claveAcceso.slice(-1)), digitoVerificador(factura.claveAcceso.slice(0, -1)));
    assert.equal(factura.fechaAutorizacion, factura.fecha);
    assert.equal((await rec.post('/admin/facturas', { ventaId: venta.id })).status, 409);
    assert.equal((await con.patch(`/admin/facturas/${factura.id}/sri`, { numComprobante: '1-1-1', claveAcceso: '1'.repeat(49) })).status, 400);
    assert.equal((await con.patch(`/admin/facturas/${factura.id}/sri`, { numComprobante: '999-999-000000001', claveAcceso: suf.padStart(49, '7') })).status, 409);
    assert.equal((await rec.patch(`/admin/facturas/${factura.id}/sri`, { numComprobante: `${pref}${suf}`, claveAcceso: suf.padStart(49, '7') })).status, 403);
    const ok = await con.patch(`/admin/facturas/${factura.id}/sri`, { numComprobante: `${pref}${suf}`, claveAcceso: suf.padStart(49, '7') });
    assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.estado, 'E');
  });
  await t.test('anular venta: unidades al mismo lote, pagos con DEV y factura por anular', async () => {
    const r = await adm.patch(`/admin/ventas/${venta.id}/anular`, { motivo: 'Cliente devolvió el producto' });
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.estado, 'X');
    const salida = r.body.kardex.filter((k) => k.tipo === 'VEN'), vuelta = r.body.kardex.filter((k) => k.tipo === 'ANV');
    assert.deepEqual(vuelta.map((k) => [k.loteProductoId, k.cantidad]), salida.map((k) => [k.loteProductoId, k.cantidad]));
    assert.equal((await prisma.producto.findUnique({ where: { id } })).stock, 5);
    assert.ok(r.body.pagos.every((p) => p.estado === 'A'));
    assert.equal(await prisma.movimientoCaja.count({ where: { pagoId: { in: r.body.pagos.map((p) => p.id) }, tipoMovimientoId: 'DEV' } }), 2);
    assert.equal((await adm.patch(`/admin/ventas/${venta.id}/anular`, { motivo: 'Otra vez' })).status, 409);
    const lista = await con.get('/admin/facturas/por-anular?limit=100');
    assert.ok(lista.body.data.some((f) => f.id === factura.id));
    const m = await con.patch(`/admin/facturas/${factura.id}/anular`);
    assert.equal(m.status, 200); assert.equal(m.body.estado, 'A'); assert.equal(m.body.estadoNombre, 'Anulada');
    assert.ok(!(await con.get('/admin/facturas/por-anular?limit=100')).body.data.some((f) => f.id === factura.id));
  });
  await t.test('A1: la devolución por transferencia no deja negativo el total de transferencias del turno', async () => {
    const actual = (await rec.get('/admin/caja/turnos/actual')).body;
    assert.ok(actual.totalTransf >= 0); assert.ok(actual.devolucionesTransf >= 10.7);
  });
  await t.test('factura de una inscripción a un tercero con RUC', async () => {
    const ins = await rec.post('/admin/inscripciones', { clienteId: '1712345675', membresiaId: 'PDI', pagos: [{ metodoPago: 'EF', monto: 3 }] });
    assert.equal(ins.status, 201);
    await prisma.cliente.update({ where: { id: '1700000084' }, data: { ruc: null } });
    assert.equal((await rec.post('/admin/facturas', { inscripcionId: ins.body.id, clienteId: '1700000084' })).status, 409);
    await prisma.cliente.update({ where: { id: '1700000084' }, data: { ruc: '1700000084001' } });
    const f = await rec.post('/admin/facturas', { inscripcionId: ins.body.id, clienteId: '1700000084' });
    assert.equal(f.status, 201); assert.equal(f.body.subtotal0, 3); assert.equal(f.body.valorIva, 0); assert.equal(f.body.total, 3); assert.equal(f.body.ruc, '1700000084001'); assert.equal(f.body.estado, 'E');
  });
});
