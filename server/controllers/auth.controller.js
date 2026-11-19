import { validationResult, matchedData } from 'express-validator';
import { login, register } from '../services/auth.service.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
export async function signIn(req, res) { const result = validationResult(req); if (!result.isEmpty()) throw new ApiError(400, 'Revisa los datos enviados.', result.array().map(({ path, msg }) => ({ campo: path, mensaje: msg }))); const { correo, contrasena } = matchedData(req, { locations: ['body'] }); res.json(await login(correo, contrasena)); }
export async function signUp(req, res) { const result = validationResult(req); if (!result.isEmpty()) throw new ApiError(400, 'Revisa los datos enviados.', result.array().map(({ path, msg }) => ({ campo: path, mensaje: msg }))); res.status(201).json(await register(matchedData(req, { locations: ['body'] }))); }
export async function me(req, res) { res.json({ usuario: req.user }); }
export async function health(_req, res) { try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok', servicio: 'Planeta Fitness API' }); } catch { throw new ApiError(503, 'La base de datos no está disponible.'); } }
