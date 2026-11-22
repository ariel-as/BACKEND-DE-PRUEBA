import { pagination, pageResult } from '../utils/pagination.js';
import { securityRepository } from '../models/security.repository.js';
import { createStaff, setStaffState, updateAccount, replaceRoles, userDto } from '../services/security.service.js';

export async function list(req, res) { const { page, limit, skip } = pagination(req.query); const buscar = req.query.buscar ? String(req.query.buscar) : ''; const [rows, total] = await Promise.all([securityRepository.listUsers(buscar, skip, limit), securityRepository.countUsers(buscar)]); res.json(pageResult(rows.map(userDto), page, limit, total)); }
export async function create(req, res) { res.status(201).json(await createStaff(req.body)); }
export async function state(req, res) { res.json(await setStaffState(req.user, Number(req.params.id), req.body.estado)); }
export async function update(req, res) { res.json(await updateAccount(Number(req.params.id), req.body)); }
export async function roles(req, res) { res.json(await replaceRoles(req.user, Number(req.params.id), req.body.roles)); }
