import { randomUUID } from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
export function correlation(req, res, next) {
  const incoming = req.get('X-Correlation-Id');
  req.correlationId = incoming && /^[\w-]{8,80}$/.test(incoming) ? incoming : randomUUID();
  res.set('X-Correlation-Id', req.correlationId);
  const start = Date.now();
  res.on('finish', () => console.log(JSON.stringify({ metodo: req.method, ruta: req.path, estado: res.statusCode, ms: Date.now() - start, correlationId: req.correlationId, usuarioId: req.user?.id })));
  next();
}
export function notFound(req, res, next) { next(new ApiError(404, 'La ruta solicitada no existe.')); }
export function errorHandler(err, req, res, _next) {
  void _next;
  let status = err.status || 500, mensaje = err.message || 'Error inesperado.';
  if (err.type === 'entity.parse.failed') { status = 400; mensaje = 'El JSON enviado no es válido.'; }
  else if (err.type === 'entity.too.large') { status = 413; mensaje = 'El cuerpo de la solicitud es demasiado grande.'; }
  else if (err.code === 'P2002' || err.code === 'P2003') { status = 409; mensaje = 'El registro entra en conflicto con datos existentes.'; }
  else if (err.code === 'P2025') { status = 404; mensaje = 'No se encontró el registro solicitado.'; }
  else if (err.name === 'PrismaClientValidationError' || ['P2000','P2009','P2011','P2012','P2013','P2014'].includes(err.code)) { status = 400; mensaje = 'Los datos enviados no cumplen con el modelo de la base de datos.'; }
  else if (/^P1\d{3}$/.test(err.code||'')) { status = 503; mensaje = 'La base de datos no está disponible.'; }
  if (status >= 500) { console.error(JSON.stringify({ error: err.message, correlationId: req.correlationId })); mensaje = status === 503 ? mensaje : 'Ocurrió un error en el servidor.'; }
  const primero = Array.isArray(err.detalles) && err.detalles[0] && 'productoId' in err.detalles[0] ? err.detalles[0] : {};
  res.status(status).json({ status: 'error', mensaje, correlationId: req.correlationId, ...(err.detalles ? { detalles: err.detalles } : {}), ...primero });
}
