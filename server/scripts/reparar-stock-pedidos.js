// Script de una sola vez (BACKEND_FASE2, paso 1).
// Antes, crear un pedido web descontaba stock y escribía un movimiento VEN sin venta.
// Este script devuelve esas unidades a sus mismos lotes con un movimiento ANV.
//
// Uso:
//   node scripts/reparar-stock-pedidos.js            → modo de prueba: solo muestra lo que haría
//   node scripts/reparar-stock-pedidos.js --aplicar  → aplica la reparación en una transacción
import { prisma } from '../config/prisma.js';
import { returnToLots } from '../services/inventory.service.js';

const aplicar = process.argv.includes('--aplicar');
const VENTANA_MS = 120000;

async function analizar() {
  const moves = await prisma.kardex.findMany({ where: { tipoMovimientoId: 'VEN', ventaId: null }, include: { loteProductoIdRef1: true }, orderBy: { id: 'asc' } });
  const pedidos = await prisma.pedido.findMany({ where: { ventas: { is: null } }, include: { detalles: true }, orderBy: { id: 'asc' } });
  const asignado = new Map();
  for (const p of pedidos) {
    for (const d of p.detalles) {
      let falta = d.cantidad;
      for (const m of moves) {
        if (!falta) break;
        if (asignado.has(m.id) || m.loteProductoIdRef1.productoId !== d.productoId) continue;
        if (Math.abs(m.fecha - p.fechaCreacion) > VENTANA_MS || m.cantidad > falta) continue;
        asignado.set(m.id, p.id); falta -= m.cantidad;
      }
    }
  }
  const porPedido = new Map();
  for (const m of moves) {
    const key = asignado.get(m.id) ?? 'sin pedido identificado';
    if (!porPedido.has(key)) porPedido.set(key, []);
    porPedido.get(key).push({ kardexId: m.id, productoId: m.loteProductoIdRef1.productoId, loteProductoId: m.loteProductoId, cantidad: m.cantidad, costoUnit: m.costoUnit, empleadoId: m.empleadoId });
  }
  return { moves, pedidos, porPedido };
}

async function verificar(extra = new Map()) {
  const productos = await prisma.producto.findMany({ where: { esContable: 'S' }, include: { loteProductos: { select: { cantidadDisponible: true } } }, orderBy: { id: 'asc' } });
  return productos.map((p) => { const lotes = p.loteProductos.reduce((n, l) => n + l.cantidadDisponible, 0), suma = extra.get(p.id) || 0, devueltos = devolver.get(p.id) || 0; return { productoId: p.id, stock: p.stock + suma, sumaLotes: lotes + (extra === fixed ? devueltos : 0) }; });
}

const { moves, pedidos, porPedido } = await analizar();
console.log(`Modo: ${aplicar ? 'APLICAR' : 'PRUEBA (no cambia nada)'}`);
console.log(`Movimientos VEN sin venta: ${moves.length}. Pedidos sin venta revisados: ${pedidos.length}.`);
const devolver = new Map();
for (const [pedido, rows] of porPedido) {
  const estado = pedidos.find((p) => p.id === pedido)?.estado;
  console.log(`\nPedido ${pedido}${estado ? ` (estado ${estado})` : ''}:`);
  for (const r of rows) { console.log(`  kárdex ${r.kardexId}: devolver ${r.cantidad} u. de ${r.productoId} al lote ${r.loteProductoId} (costo ${r.costoUnit})`); devolver.set(r.productoId, (devolver.get(r.productoId) || 0) + r.cantidad); }
}
const pagados = pedidos.filter((p) => ['C', 'E'].includes(p.estado)).map((p) => p.id);
if (pagados.length) console.log(`\nAviso: pedidos en C o E sin venta registrada (revisar a mano): ${pagados.join(', ')}`);

// Pedidos anteriores al kárdex bajaron prd_stock sin movimiento. Si el último saldo del kárdex
// coincide con la suma de los lotes, el dato equivocado es prd_stock y se corrige a ese saldo.
async function stockSinKardex() {
  const productos = await prisma.producto.findMany({ where: { esContable: 'S' }, include: { loteProductos: { select: { id: true, cantidadDisponible: true } } }, orderBy: { id: 'asc' } });
  const out = [];
  for (const p of productos) {
    const lotes = p.loteProductos.reduce((n, l) => n + l.cantidadDisponible, 0), pendiente = devolver.get(p.id) || 0;
    if (p.stock === lotes) continue;
    const last = await prisma.kardex.findFirst({ where: { loteProductoId: { in: p.loteProductos.map((l) => l.id) } }, orderBy: { id: 'desc' } });
    out.push({ productoId: p.id, stock: p.stock, sumaLotes: lotes, saldoKardex: last?.saldoCantidad ?? null, corregible: !pendiente && last?.saldoCantidad === lotes });
  }
  return out;
}
const sinKardex = await stockSinKardex();
if (sinKardex.length) {
  console.log('\nProductos con prd_stock descuadrado sin movimiento VEN (pedidos anteriores al kárdex):');
  for (const x of sinKardex) console.log(`  ${x.productoId}: stock ${x.stock}, suma de lotes ${x.sumaLotes}, último saldo del kárdex ${x.saldoKardex} → ${x.corregible ? `corregir prd_stock a ${x.sumaLotes}` : 'revisar a mano'}`);
}

if (aplicar && (moves.length || sinKardex.some((x) => x.corregible))) {
  await prisma.$transaction(async (tx) => {
    for (const [pedido, rows] of porPedido) {
      const porEmpleado = new Map();
      for (const r of rows) { if (!porEmpleado.has(r.empleadoId)) porEmpleado.set(r.empleadoId, []); porEmpleado.get(r.empleadoId).push(r); }
      for (const [employeeId, list] of porEmpleado) await returnToLots(tx, { rows: list, employeeId, observation: `Reparación: devolución del pedido web ${pedido} sin venta` });
    }
    for (const x of sinKardex.filter((y) => y.corregible)) await tx.producto.update({ where: { id: x.productoId }, data: { stock: x.sumaLotes } });
  }, { timeout: 60000 });
  console.log('\nReparación aplicada.');
}
const fixed = new Map(devolver);
if (!aplicar) for (const x of sinKardex.filter((y) => y.corregible)) fixed.set(x.productoId, x.sumaLotes - x.stock);
const check = await verificar(aplicar ? new Map() : fixed);
const descuadrados = check.filter((c) => c.stock !== c.sumaLotes);
console.log(`
Verificación (${aplicar ? 'después de aplicar' : 'proyectada si se aplica'}): ${check.length - descuadrados.length} de ${check.length} productos con stock igual a la suma de sus lotes disponibles.`);
for (const d of descuadrados) console.log(`  ${d.productoId}: stock ${d.stock}, suma de lotes ${d.sumaLotes}`);
await prisma.$disconnect();
