import { pagination, pageResult } from '../utils/pagination.js';
import * as service from '../services/class.service.js';

export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const { data, total } = await service.list(req.user, req.query, page, limit, skip);
  res.json(pageResult(data, page, limit, total));
}

export async function detail(req, res) { res.json(await service.detail(req.params.id)); }

export async function create(req, res) {
  const clase = await service.create(req.body);
  res.location(`/api/v1/admin/clases/${clase.id}`).status(201).json(clase);
}

export async function update(req, res) { res.json(await service.update(req.params.id, req.body)); }

export async function deactivate(req, res) { res.json(await service.deactivate(req.params.id)); }

export async function reserve(req, res) { res.status(201).json(await service.reserve(req.params.id, req.body)); }

export async function attendance(req, res) { res.json(await service.attendance(req.query)); }
