import { prisma } from '../config/prisma.js';
import { backfillInvoices } from '../services/invoice.service.js';

const aplicar = process.argv.includes('--aplicar');
const gym = await prisma.gimnasio.findFirst();
const ruc = /^\d{13}$/.test(gym?.id || '') ? gym.id : '0999999999001';
if (ruc !== gym?.id) console.log(`Aviso: el gimnasio no tiene RUC de 13 dígitos; se usa el RUC ficticio ${ruc}.`);
const pendientes = await prisma.factura.count({ where: { OR: [{ numComprobante: null }, { claveAcceso: null }] } });
console.log(`Modo: ${aplicar ? 'APLICAR' : 'PRUEBA (no cambia nada)'}`);
console.log(`Facturas sin número o clave: ${pendientes}.`);
if (aplicar && pendientes) {
  const actualizados = await backfillInvoices();
  console.log(`Facturas numeradas: ${actualizados.length}.`);
  for (const f of actualizados) console.log(`  factura ${f.id}: ${f.numComprobante} ${f.claveAcceso}`);
}
await prisma.$disconnect();
