import { adminRepository } from '../models/admin.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { pagination,pageResult } from '../utils/pagination.js';
import * as repo from '../factories/repository.factory.js';
import { hasPermission, tablePermissions } from '../config/permisos.js';
import { cedulaValida } from '../validators/auth.js';

// Solo las tablas que el rol puede leer, con el modo que le corresponde.
export const tableList=(req,res)=>res.json(repo.listTables().filter(t=>hasPermission(req.user,...tablePermissions(t.tabla).leer)).map(t=>({...t,modo:t.modo==='crud'&&hasPermission(req.user,...tablePermissions(t.tabla).escribir)?'crud':'lectura'})));
// El entrenador solo ve sus propias clases.
const ownFilter=(req,table,where)=>{if(table==='clase'&&!hasPermission(req.user,'clases:leer','tablas:leer'))where.empleadoId=req.user.empleadoId??'-';return where;};
const tableFor=(req)=>req.entityTable??req.params.tabla;
export const entityTable=(table)=>(req,_res,next)=>{req.entityTable=table;next();};
export const tableMeta=(req,res)=>res.json(repo.getMeta(tableFor(req)));
export async function tableOptions(req,res){const table=tableFor(req),meta=repo.getMeta(table),id=meta.idCampos;const data=await repo.listRows(table,{where:ownFilter(req,table,{}),skip:0,take:100});res.json(data.map(row=>({valor:id.map(x=>row[x]).join('~'),texto:String(row.nombre??row.descripcion??row.login??row.apellido??row[id[0]])})));}
export async function tableRows(req,res){const table=tableFor(req),{page,limit,skip}=pagination(req.query),meta=repo.getMeta(table),allowed=new Set(meta.columnas.map(c=>c.nombre)),where={};for(const[k,v]of Object.entries(req.query)){if(['page','limit'].includes(k))continue;if(!allowed.has(k))throw new ApiError(400,`El filtro ${k} no existe en esta tabla.`);where[k]=repo.filterValue(table,k,v);}ownFilter(req,table,where);const [data,total]=await Promise.all([repo.listRows(table,{where,skip,take:limit}),repo.countRows(table,where)]);res.json(pageResult(data,page,limit,total));}
export async function tableRow(req,res){const table=tableFor(req),row=await repo.findRow(table,req.params.id);if(!row||(ownFilter(req,table,{}).empleadoId&&row.empleadoId!==req.user.empleadoId))throw new ApiError(404,'No se encontró el registro.');res.json(row);}
// Empleados y clientes del panel validan la cédula ecuatoriana igual que el registro web.
function checkCedula(table,body){if(['empleado','cliente'].includes(table)&&body.id!==undefined&&!cedulaValida(String(body.id)))throw new ApiError(400,'La cédula ecuatoriana no es válida.');}
export async function tableCreate(req,res){const table=tableFor(req);checkCedula(table,req.body);res.status(201).json(await repo.createRow(table,req.body));}
export async function tableUpdate(req,res){const table=tableFor(req);if(table==='cliente'&&decodeURIComponent(req.params.id)==='9999999999')throw new ApiError(409,'CONSUMIDOR FINAL no se edita.');res.json(await repo.updateRow(table,req.params.id,req.body));}
export async function tableDelete(req,res){await repo.deleteRow(tableFor(req),req.params.id);res.status(204).end();}
// Cada rol recibe solo los indicadores de su trabajo.
const INDICADORES={REC:['clientesActivos','pedidosPendientes','inscripcionesPendientes','mensajesPendientes','personasAdentro'],ENT:['clientesActivos','personasAdentro','misRutinas'],CON:['productosActivos','bajoStock','pedidosPendientes','facturasPendientes']};
export async function summary(req,res){const all=await adminRepository.summary(req.user.empleadoId);if(req.user.roles.includes('ADM'))return res.json(all);const keys=new Set(req.user.roles.flatMap(r=>INDICADORES[r]||[]));res.json(Object.fromEntries([...keys].map(k=>[k,all[k]])));}
