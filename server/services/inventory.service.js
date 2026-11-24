import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2, r4 } from '../utils/money.js';
import { localToday, asDate, dateStr, addDays, daysBetween } from '../utils/dates.js';

const localDate=(value)=>value?asDate(value):null;
function validateProduct(body,creating){
  const allowed=new Set(['id','nombre','categoriaId','unidadMedidaId','contenido','talla','precio','descripcion','stock','stockMin','costoUnit','pagaIva','esContable','controlaCaducidad','diasAlertaCad','publicarWeb','estado','fechaCaducidad','motivoAjuste']);for(const key of Object.keys(body))if(!allowed.has(key))throw new ApiError(400,`El campo ${key} no está permitido.`);
  if(creating&&(!body.nombre||!body.categoriaId||!Number.isFinite(Number(body.precio))))throw new ApiError(400,'Nombre, categoría y precio son obligatorios.');
  const out={};
  const simple={nombre:'nombre',descripcion:'descripcion',categoriaId:'categoriaId',unidadMedidaId:'unidadMedidaId',contenido:'contenido',talla:'talla',stockMin:'stockMin',pagaIva:'pagaIva',esContable:'esContable',controlaCaducidad:'controlaCaducidad',diasAlertaCad:'diasAlertaCad',publicarWeb:'publicarWeb',estado:'estado'};
  for(const [input,field]of Object.entries(simple))if(body[input]!==undefined)out[field]=body[input];
  if(body.precio!==undefined){if(!Number.isFinite(Number(body.precio))||Number(body.precio)<0)throw new ApiError(400,'El precio debe ser un número igual o mayor que cero.');out.precioVenta=String(body.precio);}
  for(const key of ['stock','stockMin','diasAlertaCad'])if(body[key]!==undefined){const n=Number(body[key]);if(!Number.isInteger(n)||n<0)throw new ApiError(400,`${key} debe ser un entero no negativo.`);out[key]=n;}
  if(body.contenido!==undefined)out.contenido=body.contenido===null?null:String(body.contenido);
  if(body.pagaIva!==undefined&&!['S','N'].includes(body.pagaIva))throw new ApiError(400,'pagaIva debe ser S o N.');
  if(body.esContable!==undefined&&!['S','N'].includes(body.esContable))throw new ApiError(400,'esContable debe ser S o N.');
  if(body.controlaCaducidad!==undefined&&!['S','N'].includes(body.controlaCaducidad))throw new ApiError(400,'controlaCaducidad debe ser S o N.');
  const expiry=body.controlaCaducidad??'N';out.metodoSalida=expiry==='S'?'E':'F';if(expiry==='N')out.diasAlertaCad=null;else if(out.diasAlertaCad===undefined)out.diasAlertaCad=30;
  out.unidadMedidaId??='UND';out.pagaIva??='N';out.esContable??='S';out.controlaCaducidad??='N';out.publicarWeb??='S';out.estado??='A';
  return out;
}
const lockProduct=(tx,productId)=>tx.$queryRaw`SELECT prd_codigo FROM producto WHERE prd_codigo = ${productId} FOR UPDATE`;
// Movimiento de kárdex. Devuelve las salidas por lote para que la venta guarde su costo.
async function recordMove(tx,{productId,employeeId,quantity,cost,type,observation,expiry,ventaId=null,ordenCompraId=null,numFabricante=null}){
  if(quantity===0)return {moves:[]};
  await lockProduct(tx,productId);
  const product=await tx.producto.findUnique({where:{id:productId}});
  if(!product)throw new ApiError(404,'Producto no encontrado.');
  if(product.esContable!=='S'){if(product.stock+quantity<0)throw new ApiError(409,'No existe suficiente inventario.',[{productoId:product.id,nombre:product.nombre,disponible:product.stock}]);await tx.producto.update({where:{id:productId},data:{stock:product.stock+quantity}});return {moves:[],costoPromedio:dec(product.costoPromedio)};}
  if(!employeeId)throw new ApiError(403,'Tu cuenta administrativa debe estar vinculada a un empleado para registrar movimientos de inventario.');
  if(quantity>0){
    if(product.controlaCaducidad==='S'&&!expiry)throw new ApiError(400,'Indica la fecha de caducidad del lote que ingresa.');
    const newStock=product.stock+quantity,unit=dec(cost??product.costoPromedio??0);
    const average=newStock?r4(dec(product.stock).times(product.costoPromedio).plus(unit.times(quantity)).div(newStock)):r4(unit);
    const lot=await tx.loteProducto.create({data:{productoId:product.id,ordenCompraId,numFabricante,fechaIngreso:localDate(localToday()),fechaCaducidad:localDate(expiry),cantidadInicial:quantity,cantidadDisponible:quantity,costoUnit:r2(unit),estado:'D'}});
    await tx.kardex.create({data:{loteProductoId:lot.id,tipoMovimientoId:type,empleadoId:employeeId,fecha:new Date(),cantidad:quantity,costoUnit:r4(unit),saldoCantidad:newStock,costoPromedio:average,saldoValor:r2(average.times(newStock)),observacion:observation||'Inventario inicial'}});
    await tx.producto.update({where:{id:product.id},data:{stock:newStock,costoPromedio:average}});
    return {moves:[{loteProductoId:lot.id,cantidad:quantity,costoUnit:r4(unit)}],lote:lot,costoPromedio:average};
  }
  if(!observation)throw new ApiError(400,'Escribe el motivo del ajuste de inventario.');const amount=-quantity;if(amount>product.stock)throw new ApiError(409,'No existe suficiente inventario para aplicar el ajuste.',[{productoId:product.id,nombre:product.nombre,disponible:product.stock}]);
  let remaining=amount;const order=product.metodoSalida==='E'?[{fechaCaducidad:'asc'},{fechaIngreso:'asc'},{id:'asc'}]:[{fechaIngreso:'asc'},{id:'asc'}];const lots=await tx.loteProducto.findMany({where:{productoId:product.id,estado:'D',cantidadDisponible:{gt:0},OR:[{fechaCaducidad:null},{fechaCaducidad:{gte:localDate(localToday())}}]},orderBy:order});
  const avg=dec(product.costoPromedio),moves=[];
  let balance=product.stock;for(const lot of lots){if(!remaining)break;const used=Math.min(remaining,lot.cantidadDisponible),left=lot.cantidadDisponible-used;await tx.loteProducto.update({where:{id:lot.id},data:{cantidadDisponible:left,estado:left===0?'A':'D'}});remaining-=used;balance-=used;await tx.kardex.create({data:{loteProductoId:lot.id,tipoMovimientoId:type,empleadoId:employeeId,ventaId,fecha:new Date(),cantidad:used,costoUnit:r4(avg),saldoCantidad:balance,costoPromedio:r4(avg),saldoValor:r2(avg.times(balance)),observacion:observation}});moves.push({loteProductoId:lot.id,cantidad:used,costoUnit:r4(avg)});}
  if(remaining)throw new ApiError(409,'No hay lotes disponibles suficientes para esta salida.',[{productoId:product.id,nombre:product.nombre,disponible:product.stock}]);await tx.producto.update({where:{id:product.id},data:{stock:balance}});
  return {moves,costoPromedio:avg};
}
// Salida por venta (VEN). Con ventaId queda ligada a la venta.
export async function registerSaleMovement(tx,{productId,quantity,employeeId,observation,ventaId=null}){return recordMove(tx,{productId,quantity:-quantity,type:'VEN',employeeId,ventaId,observation:observation||'Venta'});}
// Verifica que alcance el stock sin moverlo. quantities: Map productoId → cantidad.
export async function checkStock(tx,quantities){
  const products=await tx.producto.findMany({where:{id:{in:[...quantities.keys()]}},select:{id:true,nombre:true,stock:true}});
  const faltantes=products.filter(p=>p.stock<quantities.get(p.id)).map(p=>({productoId:p.id,nombre:p.nombre,disponible:p.stock}));
  if(faltantes.length)throw new ApiError(409,'No hay stock suficiente para uno o más productos.',faltantes);
}
// Devuelve salidas a los mismos lotes y al mismo costo con movimientos ANV.
// rows: [{loteProductoId, cantidad, costoUnit}] tomados de las salidas VEN originales.
export async function returnToLots(tx,{rows,ventaId=null,employeeId,observation}){
  const lots=await tx.loteProducto.findMany({where:{id:{in:[...new Set(rows.map(r=>r.loteProductoId))]}}});
  const lotById=new Map(lots.map(l=>[l.id,l]));
  const byProduct=new Map();for(const r of rows){const p=lotById.get(r.loteProductoId).productoId;if(!byProduct.has(p))byProduct.set(p,[]);byProduct.get(p).push(r);}
  const result=[];
  for(const [productId,list] of byProduct){
    await lockProduct(tx,productId);
    const product=await tx.producto.findUnique({where:{id:productId}});
    let stock=product.stock,avg=dec(product.costoPromedio);
    for(const r of list){
      const lot=await tx.loteProducto.findUnique({where:{id:r.loteProductoId}});
      const available=lot.cantidadDisponible+r.cantidad;
      await tx.loteProducto.update({where:{id:lot.id},data:{cantidadDisponible:available,estado:lot.estado==='A'?'D':lot.estado}});
      const newStock=stock+r.cantidad;avg=r4(dec(stock).times(avg).plus(dec(r.costoUnit).times(r.cantidad)).div(newStock));stock=newStock;
      await tx.kardex.create({data:{loteProductoId:lot.id,tipoMovimientoId:'ANV',empleadoId:employeeId,ventaId,fecha:new Date(),cantidad:r.cantidad,costoUnit:r4(r.costoUnit),saldoCantidad:stock,costoPromedio:avg,saldoValor:r2(avg.times(stock)),observacion:observation}});
      result.push({productoId:productId,loteProductoId:lot.id,cantidad:r.cantidad});
    }
    await tx.producto.update({where:{id:productId},data:{stock,costoPromedio:avg}});
  }
  return result;
}
// Suma unidades a productos no contables (no tienen kárdex).
export async function returnNonCountable(tx,productId,quantity){await lockProduct(tx,productId);const p=await tx.producto.findUnique({where:{id:productId}});if(p.esContable!=='S')await tx.producto.update({where:{id:productId},data:{stock:p.stock+quantity}});}
export async function createProduct(body,employeeId){const data=validateProduct(body,true),stock=data.stock??0,cost=Number(body.costoUnit??0);if(!Number.isFinite(cost)||stock<0||cost<0)throw new ApiError(400,'Stock y costo deben ser números positivos.');if(stock>0&&data.esContable==='S'&&!employeeId)throw new ApiError(403,'Tu cuenta administrativa debe estar vinculada a un empleado para registrar el inventario inicial.');if(stock>0&&data.controlaCaducidad==='S'&&!body.fechaCaducidad)throw new ApiError(400,'Indica la fecha de caducidad del lote que ingresa.');return prisma.$transaction(async tx=>{let id=body.id;if(!id){const found=await tx.producto.findMany({where:{id:{startsWith:'PF'}},select:{id:true}});const next=Math.max(0,...found.map(x=>Number(x.id.slice(2))||0))+1;id=`PF${String(next).padStart(4,'0')}`;}const p=await tx.producto.create({data:{...data,id,stock:0,costoPromedio:'0'}});if(stock)await recordMove(tx,{productId:p.id,employeeId,quantity:stock,cost,type:'AJP',observation:'Inventario inicial',expiry:body.fechaCaducidad});return tx.producto.findUnique({where:{id},include:{categoria:true}});});}
export async function updateProduct(id,body,employeeId){return prisma.$transaction(async tx=>{await lockProduct(tx,id);const current=await tx.producto.findUnique({where:{id}});if(!current)throw new ApiError(404,'Producto no encontrado.');const data=validateProduct(body,false),requested=body.stock===undefined?current.stock:Number(body.stock),delta=requested-current.stock;delete data.stock;if(delta&&!body.motivoAjuste)throw new ApiError(400,'Escribe el motivo del ajuste de inventario.');if(delta&&current.esContable==='S'&&!employeeId)throw new ApiError(403,'Tu cuenta administrativa debe estar vinculada a un empleado para ajustar el inventario.');if(delta>0&&current.controlaCaducidad==='S'&&!body.fechaCaducidad)throw new ApiError(400,'Indica la fecha de caducidad del lote que ingresa.');const updated=await tx.producto.update({where:{id},data});if(delta)await recordMove(tx,{productId:updated.id,employeeId,quantity:delta,cost:body.costoUnit??current.costoPromedio,type:delta>0?'AJP':'AJN',observation:body.motivoAjuste,expiry:body.fechaCaducidad});return tx.producto.findUnique({where:{id},include:{categoria:true}});});}
export async function deactivateProduct(id){const found=await prisma.producto.findUnique({where:{id}});if(!found)throw new ApiError(404,'Producto no encontrado.');await prisma.producto.update({where:{id},data:{estado:'I',publicarWeb:'N'}});}

// ---- Operaciones de inventario (4.13) ----
const needEmployee=(employeeId)=>{if(!employeeId)throw new ApiError(403,'Tu cuenta debe estar vinculada a un empleado para registrar esta operación.');};
// Entrada de mercadería sin orden de compra (COM) o desde una orden (ordenCompraId).
export async function receiveStock(tx,{productoId,cantidad,costoUnit,fechaCaducidad,numFabricante,employeeId,observacion,ordenCompraId=null}){
  needEmployee(employeeId);
  const product=await tx.producto.findUnique({where:{id:productoId}});
  if(!product)throw new ApiError(404,'Producto no encontrado.');
  if(product.esContable!=='S')throw new ApiError(409,'El producto no es contable y no lleva kárdex.');
  if(fechaCaducidad&&fechaCaducidad<localToday())throw new ApiError(409,'La fecha de caducidad no puede ser anterior a hoy.');
  return recordMove(tx,{productId:productoId,employeeId,quantity:cantidad,cost:costoUnit,type:'COM',observation:observacion||(ordenCompraId?`Recepción de la orden ${ordenCompraId}`:'Compra sin orden'),expiry:product.controlaCaducidad==='S'?fechaCaducidad:null,ordenCompraId,numFabricante:numFabricante||null});
}
export const receiveWithoutOrder=(body,employeeId)=>prisma.$transaction(tx=>receiveStock(tx,{...body,employeeId}));
// Ajuste positivo (AJP) o negativo (AJN) con observación obligatoria.
export async function adjustStock({productoId,cantidad,observacion,costoUnit,fechaCaducidad},employeeId){
  needEmployee(employeeId);
  if(!observacion||!String(observacion).trim())throw new ApiError(400,'Escribe el motivo del ajuste de inventario.');
  return prisma.$transaction(async tx=>{const p=await tx.producto.findUnique({where:{id:productoId}});if(!p)throw new ApiError(404,'Producto no encontrado.');return recordMove(tx,{productId:productoId,employeeId,quantity:cantidad,cost:costoUnit??p.costoPromedio,type:cantidad>0?'AJP':'AJN',observation:observacion,expiry:p.controlaCaducidad==='S'?fechaCaducidad:null});});
}
// Baja de un lote caducado (CAD): saca todo lo disponible del lote.
export async function writeOffLot(lotId,observacion,employeeId){
  needEmployee(employeeId);
  if(!observacion||!String(observacion).trim())throw new ApiError(400,'Escribe el motivo de la baja.');
  return prisma.$transaction(async tx=>{
    const lot=await tx.loteProducto.findUnique({where:{id:lotId}});if(!lot)throw new ApiError(404,'Lote no encontrado.');
    if(!lot.fechaCaducidad||lot.fechaCaducidad.toISOString().slice(0,10)>localToday())throw new ApiError(409,'Solo se dan de baja lotes con la fecha de caducidad cumplida.');
    if(lot.cantidadDisponible===0)throw new ApiError(409,'El lote ya no tiene unidades.');
    await lockProduct(tx,lot.productoId);const product=await tx.producto.findUnique({where:{id:lot.productoId}});
    const qty=lot.cantidadDisponible,stock=product.stock-qty,avg=dec(product.costoPromedio);
    await tx.loteProducto.update({where:{id:lot.id},data:{cantidadDisponible:0,estado:'C'}});
    await tx.kardex.create({data:{loteProductoId:lot.id,tipoMovimientoId:'CAD',empleadoId:employeeId,fecha:new Date(),cantidad:qty,costoUnit:r4(avg),saldoCantidad:stock,costoPromedio:r4(avg),saldoValor:r2(avg.times(stock)),observacion:observacion}});
    await tx.producto.update({where:{id:product.id},data:{stock}});
    return {loteProductoId:lot.id,productoId:product.id,cantidad:qty,stock};
  });
}
// Bloquea (B) o desbloquea (D) un lote. Un lote agotado o caducado no cambia.
export async function setLotBlock(lotId,bloquear){
  return prisma.$transaction(async tx=>{
    const lot=await tx.loteProducto.findUnique({where:{id:lotId}});if(!lot)throw new ApiError(404,'Lote no encontrado.');
    if(bloquear&&lot.estado!=='D')throw new ApiError(409,'Solo se bloquea un lote disponible.');
    if(!bloquear&&lot.estado!=='B')throw new ApiError(409,'El lote no está bloqueado.');
    return tx.loteProducto.update({where:{id:lotId},data:{estado:bloquear?'B':'D'}});
  });
}
// El campo que decide la salida es controlaCaducidad: S → FEFO (E), N → FIFO (F).
export const salidaInfo=(p)=>({metodoSalida:(p.controlaCaducidad==='S'||p.metodoSalida==='E')?'FEFO':'FIFO',controlaCaducidad:p.controlaCaducidad==='S'});
// Tres listas para el panel de alertas. Los días se cuentan sobre la fecha local de Ecuador.
export async function inventoryAlerts(){
  const hoy=localToday();
  const [lots,products]=await Promise.all([
    prisma.loteProducto.findMany({where:{cantidadDisponible:{gt:0},fechaCaducidad:{not:null}},include:{producto:{select:{nombre:true,categoriaId:true,controlaCaducidad:true,metodoSalida:true,diasAlertaCad:true}}},orderBy:[{fechaCaducidad:'asc'},{id:'asc'}]}),
    prisma.producto.findMany({where:{estado:'A'},select:{id:true,nombre:true,categoriaId:true,stock:true,stockMin:true,controlaCaducidad:true,metodoSalida:true},orderBy:{nombre:'asc'}})
  ]);
  const porCaducar=[],caducadosConUnidades=[];
  for(const l of lots){
    const fecha=dateStr(l.fechaCaducidad),diasRestantes=daysBetween(hoy,fecha),info=salidaInfo(l.producto);
    const fila={...l,...info,diasRestantes};
    if(diasRestantes<0)caducadosConUnidades.push(fila);
    else if(diasRestantes<=(l.producto.diasAlertaCad??30))porCaducar.push(fila);
  }
  const sinStockYMinimo=products.filter(p=>p.stock<=p.stockMin).map(p=>({...p,...salidaInfo(p),stock:p.stock,stockMin:p.stockMin}));
  return {porCaducar,caducadosConUnidades,sinStockYMinimo,conteos:{lotesPorCaducar:porCaducar.length,lotesCaducados:caducadosConUnidades.length,productosSinStock:sinStockYMinimo.length}};
}
export const inventoryAlertCounts=async()=>(await inventoryAlerts()).conteos;
