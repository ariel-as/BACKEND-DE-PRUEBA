import { prisma } from '../config/prisma.js';
import { localToday, todayDate, asDate, addDays, dateStr, longDate } from '../utils/dates.js';

// ---- Tarea diaria (BACKEND_FASE2 4.15) ----
// Se puede correr varias veces el mismo día: cada aviso se busca antes de crearlo y un candado
// de PostgreSQL (pg_advisory_xact_lock) evita que dos corridas simultáneas dupliquen nada.
const CANDADO = 4150415;
const AVISO = { canal: 'S', estado: 'E' };

// Empleados activos con cuenta activa y rol ADM activo: reciben las alertas de inventario.
export const activeAdmins = (tx) => tx.empleado.findMany({ where: { estado: 'A', usuario: { estado: 'A', rolesAsignados: { some: { rolId: 'ADM', estado: 'A' } } } }, select: { id: true } });

async function createOnce(tx, where, data) {
  if (await tx.notificacion.findFirst({ where, select: { id: true } })) return false;
  await tx.notificacion.create({ data: { ...data, ...AVISO } });
  return true;
}

export async function runDaily() {
  const hoy = localToday(), hoyDate = todayDate(), en3 = asDate(addDays(hoy, 3));
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CANDADO})`;
    const resumen = { fecha: hoy, inscripcionesVencidas: 0, inscripcionesSuspendidas: 0, inscripcionesReanudadas: 0, lotesCaducados: 0, avisosClientes: 0, alertasPersonal: 0, detalle: { inscripciones: [], lotes: [] } };

    // 0. Suspensiones: A → S si hoy hay una suspensión aplicada; S → A cuando ya terminó.
    const suspendidasHoy = await tx.inscripcion.findMany({ where: { estado: 'A', suspensions: { some: { estado: 'A', fechaInicio: { lte: hoyDate }, fechaFin: { gte: hoyDate } } } }, select: { id: true } });
    if (suspendidasHoy.length) await tx.inscripcion.updateMany({ where: { id: { in: suspendidasHoy.map((i) => i.id) } }, data: { estado: 'S' } });
    const reanudadas = await tx.inscripcion.findMany({ where: { estado: 'S', suspensions: { none: { estado: 'A', fechaInicio: { lte: hoyDate }, fechaFin: { gte: hoyDate } } } }, select: { id: true } });
    if (reanudadas.length) await tx.inscripcion.updateMany({ where: { id: { in: reanudadas.map((i) => i.id) } }, data: { estado: 'A' } });
    resumen.inscripcionesSuspendidas = suspendidasHoy.length; resumen.inscripcionesReanudadas = reanudadas.length;

    // 1. Inscripciones por tiempo con la fecha de fin ya pasada → V.
    const vencidas = await tx.inscripcion.findMany({ where: { estado: 'A', fechaFin: { lt: hoyDate } }, select: { id: true } });
    if (vencidas.length) {
      await tx.inscripcion.updateMany({ where: { id: { in: vencidas.map((i) => i.id) } }, data: { estado: 'V' } });
      resumen.inscripcionesVencidas = vencidas.length; resumen.detalle.inscripciones = vencidas.map((i) => i.id);
    }

    // 2. Lotes con la fecha de caducidad pasada → C, con su alerta al personal.
    const admins = await activeAdmins(tx);
    const caducados = await tx.loteProducto.findMany({ where: { estado: { in: ['D', 'B'] }, fechaCaducidad: { lt: hoyDate } }, include: { producto: { select: { nombre: true } } } });
    for (const lot of caducados) {
      await tx.loteProducto.update({ where: { id: lot.id }, data: { estado: 'C' } });
      resumen.lotesCaducados += 1; resumen.detalle.lotes.push(lot.id);
      if (!lot.cantidadDisponible) continue;
      const mensaje = `El lote ${lot.id} de ${lot.producto.nombre} caducó el ${longDate(lot.fechaCaducidad)} con ${lot.cantidadDisponible} unidades. Regístralo como baja por caducidad.`;
      for (const a of admins) if (await createOnce(tx, { tipo: 'K', empleadoId: a.id, loteProductoId: lot.id, mensaje }, { destino: 'E', tipo: 'K', empleadoId: a.id, loteProductoId: lot.id, mensaje })) resumen.alertasPersonal += 1;
    }

    // 3. Avisos al cliente: membresía que vence en 3 días o menos, o tarjeta con 3 ingresos o menos.
    const activas = await tx.inscripcion.findMany({
      where: { estado: 'A', OR: [{ fechaFin: { gte: hoyDate, lte: en3 } }, { ingresosTotal: { not: null } }] },
      include: { membresiaIdRef1: { select: { nombre: true } }, inscripcionClientes: { select: { clienteId: true } } }
    });
    for (const ins of activas) {
      let mensaje = null;
      if (ins.fechaFin) mensaje = `Tu membresía ${ins.membresiaIdRef1.nombre} vence el ${longDate(ins.fechaFin)}. Renuévala en recepción o en la web.`;
      else {
        const usados = await tx.asistenciaCliente.count({ where: { inscripcionId: ins.id } });
        const quedan = ins.ingresosTotal - usados;
        if (quedan > 0 && quedan <= 3) mensaje = `A tu ${ins.membresiaIdRef1.nombre} le quedan ${quedan} ingresos. Renuévala en recepción o en la web.`;
      }
      if (!mensaje) continue;
      // Un solo aviso de este tipo por inscripción y persona.
      for (const { clienteId } of ins.inscripcionClientes) if (await createOnce(tx, { tipo: 'V', inscripcionId: ins.id, clienteId }, { destino: 'C', tipo: 'V', inscripcionId: ins.id, clienteId, mensaje })) resumen.avisosClientes += 1;
    }

    // 4. Alertas al personal: lotes que caducan dentro de los días de alerta del producto.
    const porCaducar = await tx.loteProducto.findMany({ where: { estado: 'D', cantidadDisponible: { gt: 0 }, fechaCaducidad: { gte: hoyDate }, producto: { controlaCaducidad: 'S', diasAlertaCad: { not: null }, estado: 'A' } }, include: { producto: { select: { nombre: true, diasAlertaCad: true } } } });
    for (const lot of porCaducar.filter((l) => dateStr(l.fechaCaducidad) <= addDays(hoy, l.producto.diasAlertaCad))) {
      const mensaje = `El lote ${lot.id} de ${lot.producto.nombre} caduca el ${longDate(lot.fechaCaducidad)} (${lot.cantidadDisponible} unidades disponibles).`;
      for (const a of admins) if (await createOnce(tx, { tipo: 'K', empleadoId: a.id, loteProductoId: lot.id, mensaje }, { destino: 'E', tipo: 'K', empleadoId: a.id, loteProductoId: lot.id, mensaje })) resumen.alertasPersonal += 1;
    }

    // 5. Productos en stock mínimo: una alerta mientras la anterior siga sin leer y como máximo una por día.
    const productos = await tx.producto.findMany({ where: { estado: 'A', esContable: 'S' }, select: { id: true, nombre: true, stock: true, stockMin: true } });
    for (const p of productos.filter((x) => x.stock <= x.stockMin)) {
      const mensaje = `${p.nombre} está en stock mínimo: quedan ${p.stock} unidades (mínimo ${p.stockMin}).`;
      for (const a of admins) if (await createOnce(tx, { tipo: 'S', empleadoId: a.id, productoId: p.id, OR: [{ estado: { not: 'L' } }, { fechaEnvio: { gte: new Date(`${hoy}T00:00:00-05:00`) } }] }, { destino: 'E', tipo: 'S', empleadoId: a.id, productoId: p.id, mensaje })) resumen.alertasPersonal += 1;
    }
    return resumen;
  }, { timeout: 60000, maxWait: 10000 });
}
