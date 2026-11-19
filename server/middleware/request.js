import { ApiError } from '../utils/ApiError.js';
export function requireJson(req, _res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.get('content-length') !== '0' && !req.is('application/json')) return next(new ApiError(415, 'El cuerpo debe enviarse como application/json.'));
  next();
}
export function sanitize(req, _res, next) {
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') { const out = {}; for (const [k, x] of Object.entries(v)) if (!['__proto__', 'constructor', 'prototype'].includes(k)) out[k] = clean(x); return out; }
    return typeof v === 'string' ? v.replace(/[<>]/g, '') : v;
  };
  if (req.body !== undefined) { if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return next(new ApiError(400, 'El cuerpo debe ser un objeto JSON.')); req.body = clean(req.body); }
  next();
}
