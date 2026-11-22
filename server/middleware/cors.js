import cors from 'cors';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// CORS: solo los orígenes de CORS_ORIGINS (config/env.js impide arrancar si está vacía o tiene *).
// - Sin cabecera Origin (Postman, curl, GitHub Actions): se permite.
// - Si Express sirve el frontend (FRONTEND_DIR), el propio origen del servidor también se permite.
// - Un origen no permitido, también en el preflight OPTIONS, termina en 403 con el formato del manejador de errores.
const options = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  exposedHeaders: ['Location', 'RateLimit', 'RateLimit-Policy', 'Retry-After']
};
const sameOrigin = (origin, req) => { try { return new URL(origin).host === req.get('host'); } catch { return false; } };

export const corsMiddleware = cors((req, cb) => {
  const origin = req.get('Origin');
  if (!origin || env.corsOrigins.includes(origin) || (env.frontendDir && sameOrigin(origin, req))) return cb(null, { ...options, origin: true });
  cb(new ApiError(403, 'Origen no permitido por CORS'));
});
