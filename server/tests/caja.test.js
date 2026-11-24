import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift } from './helpers.js';
import { prisma } from '../config/prisma.js';
import { computeTotals } from '../services/cash.service.js';
import { dec } from '../utils/money.js';

test('caja: turno, gasto, cuadre y cierre semanal (4.9)', async (t) => {
  const tk = await tokens(), rec = api(tk.REC), con = api(tk.CON), ent = api(tk.ENT);
  let shift;
  await t.test('permisos de caja por rol', async () => {
    assert.equal((await con.post('/admin/caja/turnos', { turnoId: 'MAN', saldoInicial: 0 })).status, 403);
    assert.equal((await ent.get('/admin/caja/turnos/actual')).status, 403);
    assert.equal((await rec.post('/admin/caja/cierres', { fechaDesde: '2020-01-01', fechaHasta: '2020-01-02' })).status, 403);
  });
  await t.test('abrir turno y no abrir dos veces el mismo turno del día', async () => {
    shift = await ensureShift(tk.REC);
    assert.equal(shift.estado, 'abierto');
    const again = await rec.post('/admin/caja/turnos', { turnoId: shift.turnoId, saldoInicial: 0 });
    assert.equal(again.status, 409);
  });
  await t.test('registrar un gasto; una devolución exige un pago anulado', async () => {
    const r = await rec.post('/admin/caja/movimientos', { tipo: 'EGR', concepto: 'Compra de útiles de limpieza', monto: 5 });
    assert.equal(r.status, 201); assert.equal(r.body.monto, 5);
    assert.equal((await rec.post('/admin/caja/movimientos', { tipo: 'DEV', concepto: 'Devolución', pagoId: 999999 })).status, 404);
    const actual = await rec.get('/admin/caja/turnos/actual');
    assert.equal(actual.status, 200); assert.ok(actual.body.movimientos.some((m) => m.id === r.body.id));
  });
  await t.test('A2: no se cierra un turno sin efectivo contado', async () => {
    assert.equal((await rec.patch(`/admin/caja/turnos/${shift.id}/cuadre`, {})).status, 400);
    assert.equal((await rec.patch(`/admin/caja/turnos/${shift.id}/cuadre`, { efectivoContado: null })).status, 400);
  });
  await t.test('el cuadre calcula bien la diferencia y un cuadre cerrado ya no se modifica', async () => {
    const actual = (await rec.get('/admin/caja/turnos/actual')).body;
    const own = actual.id === shift.id ? actual : (await rec.get(`/admin/caja/turnos/${shift.id}`)).body;
    const contado = Number((own.saldoFinal - 1.25).toFixed(2));
    const r = await rec.patch(`/admin/caja/turnos/${shift.id}/cuadre`, { efectivoContado: contado });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.estado, 'cuadrado'); assert.equal(r.body.diferencia, -1.25);
    assert.equal(r.body.saldoFinal, Number((r.body.saldoInicial + r.body.totalIngresos - r.body.totalEgresos).toFixed(2)));
    assert.equal((await rec.patch(`/admin/caja/turnos/${shift.id}/cuadre`, { efectivoContado: 1 })).status, 409);
  });
  await t.test('A1: una devolución por transferencia no deja totalTransf negativo', () => {
    const totals = computeTotals(dec(10), [{ tipoMovimientoId: 'DEV', monto: dec(12), pagoIdRef1: { metodoPagoId: 'TR' } }, { tipoMovimientoId: 'ING', monto: dec(3), pagoIdRef1: { metodoPagoId: 'EF' } }]);
    assert.equal(totals.totalTransf.toFixed(2), '0.00'); assert.equal(totals.devolucionesTransf.toFixed(2), '12.00');
    assert.equal(totals.totalEgresos.toFixed(2), '0.00'); assert.equal(totals.saldoFinal.toFixed(2), '13.00');
  });
  await t.test('cierre semanal: suma cuadres contados, rechaza solapes y bloquea los cuadres', async () => {
    // Cuadre contado en una fecha pasada al azar (fixture), para no chocar con el día de hoy.
    const d = new Date(Date.UTC(2001, 0, 1) + Math.floor(Math.random() * 7000) * 86400000).toISOString().slice(0, 10);
    const emp = await prisma.empleado.findFirst({ where: { usuario: { login: 'recepcion@planetafitness.ec' } } });
    const fixture = await prisma.cuadreTurno.create({ data: { turnoId: 'MAN', empleadoId: emp.id, fecha: new Date(`${d}T12:00:00-05:00`), saldoInicial: '10', totalIngresos: '30', totalTransf: '15', totalEgresos: '5', saldoFinal: '35', efectivoContado: '34', diferencia: '-1' } });
    const r = await con.post('/admin/caja/cierres', { fechaDesde: d, fechaHasta: d, observacion: 'Cierre de prueba' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.totalEfectivo, 30); assert.equal(r.body.totalTransf, 15); assert.equal(r.body.diferencia, -1);
    assert.equal((await con.post('/admin/caja/cierres', { fechaDesde: d, fechaHasta: d })).status, 409);
    assert.equal((await rec.patch(`/admin/caja/turnos/${fixture.id}/cuadre`, { efectivoContado: 1 })).status, 409);
    const first = await con.get('/admin/caja/cierres?limit=100');
    assert.equal(first.status, 200);
    let found = first.body.data.some((c) => c.id === r.body.id);
    for (let page = 2; !found && page <= first.body.pagination.totalPages; page++) {
      const list = await con.get(`/admin/caja/cierres?limit=100&page=${page}`);
      assert.equal(list.status, 200);
      found = list.body.data.some((c) => c.id === r.body.id);
    }
    assert.ok(found);
  });
});
