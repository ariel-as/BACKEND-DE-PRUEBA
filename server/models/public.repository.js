import { prisma } from '../config/prisma.js';

export const publicRepository = {
  categories: () => prisma.categoria.findMany({ orderBy: { descripcion: 'asc' } }),
  paymentMethods: () => prisma.metodoPago.findMany({ orderBy: { descripcion: 'asc' } }),
  levels: () => prisma.nivel.findMany({ orderBy: { descripcion: 'asc' } }),
  gym: () => prisma.gimnasio.findFirst(),
  memberships: () => prisma.membresia.findMany({ where: { estado: 'A', publicarWeb: 'S' }, include: { membresiaServicios: { include: { servicioIdRef1: true } } }, orderBy: { precio: 'asc' } }),
  classes: () => prisma.clase.findMany({ where: { estado: 'A' }, include: { empleadoIdRef1: true, claseHorarios: { where: { estado: 'A' }, include: { horarioIdRef1: true } } }, orderBy: { id: 'asc' } }),
  trainers: () => prisma.empleado.findMany({ where: { estado: 'A', cargoId: 'ENT' }, include: { clases: true } }),
  gymInfo: () => Promise.all([prisma.gimnasio.findFirst(), prisma.horarioAtencion.findMany({ orderBy: { id: 'asc' } }), prisma.servicio.findMany({ where: { estado: 'A' }, orderBy: { nombre: 'asc' } }), prisma.nivel.findMany({ orderBy: { descripcion: 'asc' } })]),
  allies: () => prisma.profesionalAliado.findMany({ where: { estado: 'A' }, include: { servicioIdRef1: true } }),
  createContact: (data) => prisma.mensajeContacto.create({ data }),
  myEnrollments: (clienteId) => prisma.inscripcionCliente.findMany({ where: { clienteId }, include: { inscripcionIdRef1: { include: { membresiaIdRef1: true } } }, orderBy: { inscripcionId: 'desc' } })
};
