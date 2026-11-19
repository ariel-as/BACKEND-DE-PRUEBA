CREATE TABLE "gimnasio" (
    "gim_ruc" VARCHAR(13) NOT NULL,
    "gim_nombre" VARCHAR(100) NOT NULL,
    "gim_direccion" VARCHAR(200) NOT NULL,
    "gim_telefono" VARCHAR(10),
    "gim_correo" VARCHAR(120),
    "gim_aforo_max" INTEGER NOT NULL,
    "gim_propietaria" VARCHAR(100) NOT NULL,
    "gim_porcentaje_iva" NUMERIC(5, 2) NOT NULL,
    "gim_establecimiento" VARCHAR(3) NOT NULL,
    "gim_punto_emision" VARCHAR(3) NOT NULL
);
ALTER TABLE "gimnasio" ADD CONSTRAINT "gimnasio_pkey" PRIMARY KEY ("gim_ruc");
CREATE TABLE "horario_atencion" (
    "hat_codigo" SERIAL NOT NULL,
    "gim_ruc" VARCHAR(13) NOT NULL,
    "hat_dia" VARCHAR(30) NOT NULL,
    "hat_hora_apertura" VARCHAR(5),
    "hat_hora_cierre" VARCHAR(5),
    "hat_abierto" CHAR(1) NOT NULL
);
ALTER TABLE "horario_atencion" ADD CONSTRAINT "horario_atencion_pkey" PRIMARY KEY ("hat_codigo");
CREATE TABLE "rol" (
    "rol_codigo" VARCHAR(4) NOT NULL,
    "rol_descripcion" VARCHAR(60) NOT NULL,
    "rol_tipo" CHAR(1) NOT NULL,
    "rol_permisos" VARCHAR(300)
);
ALTER TABLE "rol" ADD CONSTRAINT "rol_pkey" PRIMARY KEY ("rol_codigo");
CREATE UNIQUE INDEX "rol_rol_descripcion_key" ON "rol" ("rol_descripcion");
CREATE TABLE "usuario" (
    "usr_codigo" SERIAL NOT NULL,
    "usr_login" VARCHAR(120) NOT NULL,
    "usr_clave_hash" VARCHAR(255) NOT NULL,
    "usr_fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usr_ultimo_acceso" TIMESTAMP(6),
    "usr_estado" CHAR(1) DEFAULT 'A' NOT NULL
);
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_pkey" PRIMARY KEY ("usr_codigo");
CREATE UNIQUE INDEX "usuario_usr_login_key" ON "usuario" ("usr_login");
CREATE TABLE "usuario_rol" (
    "usr_codigo" INTEGER NOT NULL,
    "rol_codigo" VARCHAR(4) NOT NULL,
    "url_fecha_asigna" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "url_estado" CHAR(1) NOT NULL
);
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usr_codigo", "rol_codigo");
CREATE TABLE "cargo" (
    "crg_codigo" VARCHAR(3) NOT NULL,
    "crg_descripcion" VARCHAR(100) NOT NULL,
    "crg_sueldo_base" NUMERIC(10, 2)
);
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_pkey" PRIMARY KEY ("crg_codigo");
CREATE UNIQUE INDEX "cargo_crg_descripcion_key" ON "cargo" ("crg_descripcion");
CREATE TABLE "turno" (
    "tur_codigo" VARCHAR(3) NOT NULL,
    "tur_descripcion" VARCHAR(50) NOT NULL,
    "tur_hora_inicio" VARCHAR(5) NOT NULL,
    "tur_hora_fin" VARCHAR(5) NOT NULL
);
ALTER TABLE "turno" ADD CONSTRAINT "turno_pkey" PRIMARY KEY ("tur_codigo");
CREATE TABLE "empleado" (
    "emp_cedula" VARCHAR(10) NOT NULL,
    "crg_codigo" VARCHAR(3) NOT NULL,
    "tur_codigo" VARCHAR(3),
    "usr_codigo" INTEGER,
    "emp_nombre" VARCHAR(60) NOT NULL,
    "emp_apellido" VARCHAR(60) NOT NULL,
    "emp_telefono" VARCHAR(10),
    "emp_correo" VARCHAR(120),
    "emp_especialidad" VARCHAR(60),
    "emp_fecha_ingreso" DATE NOT NULL,
    "emp_sueldo" NUMERIC(10, 2),
    "emp_estado" CHAR(1) NOT NULL
);
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_pkey" PRIMARY KEY ("emp_cedula");
CREATE UNIQUE INDEX "empleado_usr_codigo_key" ON "empleado" ("usr_codigo");
CREATE TABLE "asistencia_empleado" (
    "ase_numero" SERIAL NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "ase_fecha" DATE NOT NULL,
    "ase_hora_entrada" VARCHAR(5) NOT NULL,
    "ase_hora_salida" VARCHAR(5),
    "ase_observacion" VARCHAR(200)
);
ALTER TABLE "asistencia_empleado" ADD CONSTRAINT "asistencia_empleado_pkey" PRIMARY KEY ("ase_numero");
CREATE UNIQUE INDEX "asistencia_empleado_emp_cedula_ase_fecha_key" ON "asistencia_empleado" ("emp_cedula", "ase_fecha");
CREATE TABLE "nivel" (
    "niv_codigo" VARCHAR(3) NOT NULL,
    "niv_descripcion" VARCHAR(50) NOT NULL
);
ALTER TABLE "nivel" ADD CONSTRAINT "nivel_pkey" PRIMARY KEY ("niv_codigo");
CREATE UNIQUE INDEX "nivel_niv_descripcion_key" ON "nivel" ("niv_descripcion");
CREATE TABLE "cliente" (
    "cli_cedula" VARCHAR(10) NOT NULL,
    "niv_codigo" VARCHAR(3),
    "usr_codigo" INTEGER,
    "cli_nombre" VARCHAR(60) NOT NULL,
    "cli_apellido" VARCHAR(60) NOT NULL,
    "cli_ruc" VARCHAR(13),
    "cli_direccion" VARCHAR(200),
    "cli_telefono" VARCHAR(10),
    "cli_correo" VARCHAR(120),
    "cli_sector" VARCHAR(100),
    "cli_fecha_nacimiento" DATE,
    "cli_es_estudiante" CHAR(1) DEFAULT 'N' NOT NULL,
    "cli_fecha_registro" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "cli_estado" CHAR(1) NOT NULL
);
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_pkey" PRIMARY KEY ("cli_cedula");
CREATE UNIQUE INDEX "cliente_usr_codigo_key" ON "cliente" ("usr_codigo");
CREATE TABLE "servicio" (
    "srv_codigo" VARCHAR(4) NOT NULL,
    "srv_nombre" VARCHAR(60) NOT NULL,
    "srv_descripcion" VARCHAR(200),
    "srv_tipo" CHAR(1) NOT NULL,
    "srv_estado" CHAR(1) NOT NULL
);
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_pkey" PRIMARY KEY ("srv_codigo");
CREATE UNIQUE INDEX "servicio_srv_nombre_key" ON "servicio" ("srv_nombre");
CREATE TABLE "membresia" (
    "mem_codigo" VARCHAR(4) NOT NULL,
    "mem_nombre" VARCHAR(60) NOT NULL,
    "mem_descripcion" VARCHAR(200),
    "mem_tipo" CHAR(1) NOT NULL,
    "mem_duracion" INTEGER,
    "mem_unidad_duracion" CHAR(1),
    "mem_num_ingresos" INTEGER,
    "mem_num_personas" INTEGER DEFAULT 1 NOT NULL,
    "mem_precio" NUMERIC(10, 2) NOT NULL,
    "mem_paga_iva" CHAR(1) NOT NULL,
    "mem_incluye_rutina" CHAR(1) NOT NULL,
    "mem_es_estudiantil" CHAR(1) NOT NULL,
    "mem_publicar_web" CHAR(1) NOT NULL,
    "mem_estado" CHAR(1) NOT NULL
);
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_pkey" PRIMARY KEY ("mem_codigo");
CREATE UNIQUE INDEX "membresia_mem_nombre_key" ON "membresia" ("mem_nombre");
CREATE TABLE "membresia_servicio" (
    "mem_codigo" VARCHAR(4) NOT NULL,
    "srv_codigo" VARCHAR(4) NOT NULL,
    "msv_observacion" VARCHAR(150)
);
ALTER TABLE "membresia_servicio" ADD CONSTRAINT "membresia_servicio_pkey" PRIMARY KEY ("mem_codigo", "srv_codigo");
CREATE TABLE "promocion" (
    "prm_numero" SERIAL NOT NULL,
    "prm_descripcion" VARCHAR(150) NOT NULL,
    "prm_fecha_ini" DATE NOT NULL,
    "prm_fecha_fin" DATE NOT NULL,
    "prm_porcentaje" NUMERIC(5, 2) NOT NULL,
    "prm_requiere_autoriz" CHAR(1) NOT NULL
);
ALTER TABLE "promocion" ADD CONSTRAINT "promocion_pkey" PRIMARY KEY ("prm_numero");
CREATE TABLE "membresia_promocion" (
    "mem_codigo" VARCHAR(4) NOT NULL,
    "prm_numero" INTEGER NOT NULL
);
ALTER TABLE "membresia_promocion" ADD CONSTRAINT "membresia_promocion_pkey" PRIMARY KEY ("mem_codigo", "prm_numero");
CREATE TABLE "inscripcion" (
    "ins_numero" SERIAL NOT NULL,
    "mem_codigo" VARCHAR(4) NOT NULL,
    "prm_numero" INTEGER,
    "emp_cedula" VARCHAR(10),
    "ins_emp_autoriza" VARCHAR(10),
    "ins_fecha_autoriza" TIMESTAMP(6),
    "ins_fecha_registro" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ins_fecha_inicio" DATE NOT NULL,
    "ins_fecha_fin" DATE,
    "ins_ingresos_total" INTEGER,
    "ins_precio_base" NUMERIC(10, 2) NOT NULL,
    "ins_descuento" NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    "ins_valor" NUMERIC(10, 2) NOT NULL,
    "ins_porcentaje_iva" NUMERIC(5, 2) NOT NULL,
    "ins_canal" CHAR(1) NOT NULL,
    "ins_estado" CHAR(1) NOT NULL,
    "ins_emp_anula" VARCHAR(10),
    "ins_fecha_anula" TIMESTAMP(6),
    "ins_motivo_anula" VARCHAR(200)
);
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_pkey" PRIMARY KEY ("ins_numero");
CREATE TABLE "inscripcion_cliente" (
    "ins_numero" INTEGER NOT NULL,
    "cli_cedula" VARCHAR(10) NOT NULL,
    "icl_es_titular" CHAR(1) NOT NULL
);
ALTER TABLE "inscripcion_cliente" ADD CONSTRAINT "inscripcion_cliente_pkey" PRIMARY KEY ("ins_numero", "cli_cedula");
CREATE TABLE "suspension" (
    "sus_numero" SERIAL NOT NULL,
    "ins_numero" INTEGER NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "sus_fecha_inicio" DATE NOT NULL,
    "sus_fecha_fin" DATE NOT NULL,
    "sus_dias_recuperados" INTEGER NOT NULL,
    "sus_motivo" VARCHAR(200) NOT NULL,
    "sus_certificado" VARCHAR(200) NOT NULL,
    "sus_estado" CHAR(1) DEFAULT 'A' NOT NULL,
    "sus_emp_anula" VARCHAR(10),
    "sus_fecha_anula" TIMESTAMP(6),
    "sus_motivo_anula" VARCHAR(200)
);
ALTER TABLE "suspension" ADD CONSTRAINT "suspension_pkey" PRIMARY KEY ("sus_numero");
CREATE TABLE "clase" (
    "cla_codigo" SERIAL NOT NULL,
    "srv_codigo" VARCHAR(4) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "cla_nombre" VARCHAR(60) NOT NULL,
    "cla_descripcion" VARCHAR(200),
    "cla_lugar" VARCHAR(60),
    "cla_cupo_max" INTEGER NOT NULL,
    "cla_estado" CHAR(1) NOT NULL
);
ALTER TABLE "clase" ADD CONSTRAINT "clase_pkey" PRIMARY KEY ("cla_codigo");
CREATE UNIQUE INDEX "clase_cla_nombre_key" ON "clase" ("cla_nombre");
CREATE TABLE "horario" (
    "hor_codigo" SERIAL NOT NULL,
    "hor_dia" VARCHAR(10) NOT NULL,
    "hor_hora_inicio" VARCHAR(5) NOT NULL,
    "hor_hora_fin" VARCHAR(5) NOT NULL
);
ALTER TABLE "horario" ADD CONSTRAINT "horario_pkey" PRIMARY KEY ("hor_codigo");
CREATE UNIQUE INDEX "horario_hor_dia_hor_hora_inicio_hor_hora_fin_key" ON "horario" ("hor_dia", "hor_hora_inicio", "hor_hora_fin");
CREATE TABLE "clase_horario" (
    "cla_codigo" INTEGER NOT NULL,
    "hor_codigo" INTEGER NOT NULL,
    "clh_estado" CHAR(1) NOT NULL
);
ALTER TABLE "clase_horario" ADD CONSTRAINT "clase_horario_pkey" PRIMARY KEY ("cla_codigo", "hor_codigo");
CREATE TABLE "asistencia_cliente" (
    "asc_numero" SERIAL NOT NULL,
    "cli_cedula" VARCHAR(10) NOT NULL,
    "ins_numero" INTEGER NOT NULL,
    "cla_codigo" INTEGER,
    "hor_codigo" INTEGER,
    "asc_fecha" DATE NOT NULL,
    "asc_hora_ingreso" VARCHAR(5) NOT NULL,
    "asc_hora_salida" VARCHAR(5)
);
ALTER TABLE "asistencia_cliente" ADD CONSTRAINT "asistencia_cliente_pkey" PRIMARY KEY ("asc_numero");
CREATE TABLE "rutina" (
    "rut_numero" SERIAL NOT NULL,
    "cli_cedula" VARCHAR(10) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "niv_codigo" VARCHAR(3) NOT NULL,
    "rut_objetivo" VARCHAR(100) NOT NULL,
    "rut_detalle" VARCHAR(1000) NOT NULL,
    "rut_fecha_inicio" DATE NOT NULL,
    "rut_fecha_fin" DATE
);
ALTER TABLE "rutina" ADD CONSTRAINT "rutina_pkey" PRIMARY KEY ("rut_numero");
CREATE TABLE "profesional_aliado" (
    "pal_cedula" VARCHAR(10) NOT NULL,
    "srv_codigo" VARCHAR(4) NOT NULL,
    "pal_nombre" VARCHAR(60) NOT NULL,
    "pal_apellido" VARCHAR(60) NOT NULL,
    "pal_telefono" VARCHAR(10) NOT NULL,
    "pal_correo" VARCHAR(120),
    "pal_registro_prof" VARCHAR(30),
    "pal_consultorio" VARCHAR(60),
    "pal_valor_comision" NUMERIC(10, 2) NOT NULL,
    "pal_estado" CHAR(1) NOT NULL
);
ALTER TABLE "profesional_aliado" ADD CONSTRAINT "profesional_aliado_pkey" PRIMARY KEY ("pal_cedula");
CREATE TABLE "comision_aliado" (
    "coa_numero" SERIAL NOT NULL,
    "pal_cedula" VARCHAR(10) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "mpg_codigo" VARCHAR(3) NOT NULL,
    "coa_fecha_cobro" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "coa_fecha_desde" DATE NOT NULL,
    "coa_fecha_hasta" DATE NOT NULL,
    "coa_monto" NUMERIC(10, 2) NOT NULL,
    "coa_referencia" VARCHAR(30)
);
ALTER TABLE "comision_aliado" ADD CONSTRAINT "comision_aliado_pkey" PRIMARY KEY ("coa_numero");
CREATE UNIQUE INDEX "comision_aliado_pal_cedula_coa_fecha_desde_key" ON "comision_aliado" ("pal_cedula", "coa_fecha_desde");
CREATE TABLE "categoria" (
    "cat_codigo" VARCHAR(4) NOT NULL,
    "cat_descripcion" VARCHAR(120) NOT NULL
);
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_pkey" PRIMARY KEY ("cat_codigo");
CREATE UNIQUE INDEX "categoria_cat_descripcion_key" ON "categoria" ("cat_descripcion");
CREATE TABLE "unidad_medida" (
    "unm_codigo" VARCHAR(6) NOT NULL,
    "unm_descripcion" VARCHAR(100) NOT NULL,
    "unm_abreviatura" VARCHAR(10) NOT NULL
);
ALTER TABLE "unidad_medida" ADD CONSTRAINT "unidad_medida_pkey" PRIMARY KEY ("unm_codigo");
CREATE UNIQUE INDEX "unidad_medida_unm_descripcion_key" ON "unidad_medida" ("unm_descripcion");
CREATE TABLE "producto" (
    "prd_codigo" VARCHAR(13) NOT NULL,
    "cat_codigo" VARCHAR(4) NOT NULL,
    "unm_codigo" VARCHAR(6) NOT NULL,
    "prd_nombre" VARCHAR(100) NOT NULL,
    "prd_descripcion" VARCHAR(300),
    "prd_contenido" NUMERIC(8, 2),
    "prd_talla" VARCHAR(4),
    "prd_precio_venta" NUMERIC(10, 2) NOT NULL,
    "prd_costo_promedio" NUMERIC(12, 4) DEFAULT 0 NOT NULL,
    "prd_paga_iva" CHAR(1) NOT NULL,
    "prd_stock" INTEGER DEFAULT 0 NOT NULL,
    "prd_stock_min" INTEGER NOT NULL,
    "prd_es_contable" CHAR(1) NOT NULL,
    "prd_controla_caducidad" CHAR(1) NOT NULL,
    "prd_dias_alerta_cad" INTEGER,
    "prd_metodo_salida" CHAR(1) NOT NULL,
    "prd_metodo_valora" CHAR(1) DEFAULT 'P' NOT NULL,
    "prd_publicar_web" CHAR(1) NOT NULL,
    "prd_fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "prd_estado" CHAR(1) NOT NULL
);
ALTER TABLE "producto" ADD CONSTRAINT "producto_pkey" PRIMARY KEY ("prd_codigo");
CREATE TABLE "proveedor" (
    "prv_ci_ruc" VARCHAR(13) NOT NULL,
    "prv_nombre" VARCHAR(100) NOT NULL,
    "prv_direccion" VARCHAR(200),
    "prv_telefono" VARCHAR(10) NOT NULL,
    "prv_correo" VARCHAR(120),
    "prv_contacto" VARCHAR(100)
);
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_pkey" PRIMARY KEY ("prv_ci_ruc");
CREATE TABLE "producto_proveedor" (
    "prd_codigo" VARCHAR(13) NOT NULL,
    "prv_ci_ruc" VARCHAR(13) NOT NULL
);
ALTER TABLE "producto_proveedor" ADD CONSTRAINT "producto_proveedor_pkey" PRIMARY KEY ("prd_codigo", "prv_ci_ruc");
CREATE TABLE "orden_compra" (
    "orc_numero" SERIAL NOT NULL,
    "prv_ci_ruc" VARCHAR(13) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "orc_emp_autoriza" VARCHAR(10),
    "orc_fecha_autoriza" TIMESTAMP(6),
    "orc_fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "orc_fecha_entrega" DATE,
    "orc_monto" NUMERIC(10, 2) NOT NULL,
    "orc_estado" CHAR(1) NOT NULL
);
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_pkey" PRIMARY KEY ("orc_numero");
CREATE TABLE "producto_ordencompra" (
    "prd_codigo" VARCHAR(13) NOT NULL,
    "orc_numero" INTEGER NOT NULL,
    "por_cantidad" INTEGER NOT NULL,
    "por_costo_unit" NUMERIC(10, 2) NOT NULL
);
ALTER TABLE "producto_ordencompra" ADD CONSTRAINT "producto_ordencompra_pkey" PRIMARY KEY ("prd_codigo", "orc_numero");
CREATE TABLE "lote_producto" (
    "lot_codigo" SERIAL NOT NULL,
    "prd_codigo" VARCHAR(13) NOT NULL,
    "orc_numero" INTEGER,
    "lot_num_fabricante" VARCHAR(30),
    "lot_fecha_ingreso" DATE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lot_fecha_caducidad" DATE,
    "lot_cantidad_inicial" INTEGER NOT NULL,
    "lot_cantidad_disponible" INTEGER NOT NULL,
    "lot_costo_unit" NUMERIC(10, 2) NOT NULL,
    "lot_estado" CHAR(1) DEFAULT 'D' NOT NULL
);
ALTER TABLE "lote_producto" ADD CONSTRAINT "lote_producto_pkey" PRIMARY KEY ("lot_codigo");
CREATE TABLE "tipo_movimiento" (
    "tmv_codigo" VARCHAR(4) NOT NULL,
    "tmv_descripcion" VARCHAR(120) NOT NULL,
    "tmv_tipo" CHAR(1) NOT NULL,
    "tmv_aplica_a" CHAR(1) NOT NULL
);
ALTER TABLE "tipo_movimiento" ADD CONSTRAINT "tipo_movimiento_pkey" PRIMARY KEY ("tmv_codigo");
CREATE UNIQUE INDEX "tipo_movimiento_tmv_descripcion_key" ON "tipo_movimiento" ("tmv_descripcion");
CREATE TABLE "kardex" (
    "krd_numero" SERIAL NOT NULL,
    "lot_codigo" INTEGER NOT NULL,
    "tmv_codigo" VARCHAR(4) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "ven_numero" INTEGER,
    "krd_fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "krd_cantidad" INTEGER NOT NULL,
    "krd_costo_unit" NUMERIC(12, 4) NOT NULL,
    "krd_saldo_cantidad" INTEGER NOT NULL,
    "krd_costo_promedio" NUMERIC(12, 4) NOT NULL,
    "krd_saldo_valor" NUMERIC(14, 2) NOT NULL,
    "krd_observacion" VARCHAR(200)
);
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_pkey" PRIMARY KEY ("krd_numero");
CREATE TABLE "pedido" (
    "ped_numero" SERIAL NOT NULL,
    "usr_codigo" INTEGER NOT NULL,
    "mpg_codigo" VARCHAR(3) NOT NULL,
    "ped_fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ped_total" NUMERIC(10, 2) NOT NULL,
    "ped_estado" CHAR(1) DEFAULT 'P' NOT NULL,
    "ped_ref_transferencia" VARCHAR(30),
    "ped_comprobante" VARCHAR(200),
    "ped_fecha_reporte_pago" TIMESTAMP(6),
    "ped_fecha_retiro" TIMESTAMP(6)
);
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_pkey" PRIMARY KEY ("ped_numero");
CREATE TABLE "pedido_detalle" (
    "pde_codigo" SERIAL NOT NULL,
    "ped_numero" INTEGER NOT NULL,
    "prd_codigo" VARCHAR(13) NOT NULL,
    "pde_cantidad" INTEGER NOT NULL,
    "pde_precio_unitario" NUMERIC(10, 2) NOT NULL,
    "pde_porcentaje_iva" NUMERIC(5, 2) NOT NULL
);
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_pkey" PRIMARY KEY ("pde_codigo");
CREATE UNIQUE INDEX "pedido_detalle_ped_numero_prd_codigo_key" ON "pedido_detalle" ("ped_numero", "prd_codigo");
CREATE TABLE "venta" (
    "ven_numero" SERIAL NOT NULL,
    "cli_cedula" VARCHAR(10) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "ped_numero" INTEGER,
    "ven_fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ven_subtotal" NUMERIC(10, 2) NOT NULL,
    "ven_descuento" NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    "ven_total" NUMERIC(10, 2) NOT NULL,
    "ven_canal" CHAR(1) NOT NULL,
    "ven_estado" CHAR(1) DEFAULT 'C' NOT NULL,
    "ven_emp_anula" VARCHAR(10),
    "ven_fecha_anula" TIMESTAMP(6),
    "ven_motivo_anula" VARCHAR(200)
);
ALTER TABLE "venta" ADD CONSTRAINT "venta_pkey" PRIMARY KEY ("ven_numero");
CREATE UNIQUE INDEX "venta_ped_numero_key" ON "venta" ("ped_numero");
CREATE TABLE "detalle_venta" (
    "ven_numero" INTEGER NOT NULL,
    "prd_codigo" VARCHAR(13) NOT NULL,
    "dve_cantidad" INTEGER NOT NULL,
    "dve_precio_unit" NUMERIC(10, 2) NOT NULL,
    "dve_costo_unit" NUMERIC(12, 4) NOT NULL,
    "dve_descuento" NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    "dve_porcentaje_iva" NUMERIC(5, 2) NOT NULL
);
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_pkey" PRIMARY KEY ("ven_numero", "prd_codigo");
CREATE TABLE "factura" (
    "fac_numero" SERIAL NOT NULL,
    "cli_cedula" VARCHAR(10) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "ven_numero" INTEGER,
    "ins_numero" INTEGER,
    "fac_num_comprobante" VARCHAR(17),
    "fac_fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "fac_subtotal_0" NUMERIC(10, 2) NOT NULL,
    "fac_subtotal_iva" NUMERIC(10, 2) NOT NULL,
    "fac_descuento" NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    "fac_porcentaje_iva" NUMERIC(5, 2) NOT NULL,
    "fac_valor_iva" NUMERIC(10, 2) NOT NULL,
    "fac_total" NUMERIC(10, 2) NOT NULL,
    "fac_clave_acceso" VARCHAR(49),
    "fac_estado" CHAR(1) DEFAULT 'P' NOT NULL
);
ALTER TABLE "factura" ADD CONSTRAINT "factura_pkey" PRIMARY KEY ("fac_numero");
CREATE UNIQUE INDEX "factura_ven_numero_key" ON "factura" ("ven_numero");
CREATE UNIQUE INDEX "factura_ins_numero_key" ON "factura" ("ins_numero");
CREATE UNIQUE INDEX "factura_fac_num_comprobante_key" ON "factura" ("fac_num_comprobante");
CREATE UNIQUE INDEX "factura_fac_clave_acceso_key" ON "factura" ("fac_clave_acceso");
CREATE TABLE "metodo_pago" (
    "mpg_codigo" VARCHAR(3) NOT NULL,
    "mpg_descripcion" VARCHAR(60) NOT NULL
);
ALTER TABLE "metodo_pago" ADD CONSTRAINT "metodo_pago_pkey" PRIMARY KEY ("mpg_codigo");
CREATE UNIQUE INDEX "metodo_pago_mpg_descripcion_key" ON "metodo_pago" ("mpg_descripcion");
CREATE TABLE "pago" (
    "pag_numero" SERIAL NOT NULL,
    "mpg_codigo" VARCHAR(3) NOT NULL,
    "ven_numero" INTEGER,
    "ins_numero" INTEGER,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "pag_fecha" DATE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pag_monto" NUMERIC(10, 2) NOT NULL,
    "pag_referencia" VARCHAR(30),
    "pag_estado" CHAR(1) DEFAULT 'V' NOT NULL
);
ALTER TABLE "pago" ADD CONSTRAINT "pago_pkey" PRIMARY KEY ("pag_numero");
CREATE TABLE "cierre_caja" (
    "ccj_numero" SERIAL NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "ccj_fecha_desde" DATE NOT NULL,
    "ccj_fecha_hasta" DATE NOT NULL,
    "ccj_total_efectivo" NUMERIC(12, 2) NOT NULL,
    "ccj_total_transf" NUMERIC(12, 2) NOT NULL,
    "ccj_total_egresos" NUMERIC(12, 2) NOT NULL,
    "ccj_diferencia" NUMERIC(12, 2) NOT NULL,
    "ccj_observacion" VARCHAR(300)
);
ALTER TABLE "cierre_caja" ADD CONSTRAINT "cierre_caja_pkey" PRIMARY KEY ("ccj_numero");
CREATE TABLE "cuadre_turno" (
    "ctu_numero" SERIAL NOT NULL,
    "tur_codigo" VARCHAR(3) NOT NULL,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "ccj_numero" INTEGER,
    "ctu_fecha" DATE NOT NULL,
    "ctu_saldo_inicial" NUMERIC(12, 2) NOT NULL,
    "ctu_total_ingresos" NUMERIC(12, 2) NOT NULL,
    "ctu_total_transf" NUMERIC(12, 2) NOT NULL,
    "ctu_total_egresos" NUMERIC(12, 2) NOT NULL,
    "ctu_saldo_final" NUMERIC(12, 2) NOT NULL,
    "ctu_efectivo_contado" NUMERIC(12, 2),
    "ctu_diferencia" NUMERIC(12, 2)
);
ALTER TABLE "cuadre_turno" ADD CONSTRAINT "cuadre_turno_pkey" PRIMARY KEY ("ctu_numero");
CREATE UNIQUE INDEX "cuadre_turno_tur_codigo_ctu_fecha_key" ON "cuadre_turno" ("tur_codigo", "ctu_fecha");
CREATE TABLE "movimiento_caja" (
    "mcj_numero" SERIAL NOT NULL,
    "ctu_numero" INTEGER NOT NULL,
    "tmv_codigo" VARCHAR(4) NOT NULL,
    "pag_numero" INTEGER,
    "coa_numero" INTEGER,
    "emp_cedula" VARCHAR(10) NOT NULL,
    "mcj_fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mcj_concepto" VARCHAR(200) NOT NULL,
    "mcj_monto" NUMERIC(10, 2) NOT NULL
);
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_pkey" PRIMARY KEY ("mcj_numero");
CREATE UNIQUE INDEX "movimiento_caja_coa_numero_key" ON "movimiento_caja" ("coa_numero");
CREATE UNIQUE INDEX "movimiento_caja_pag_numero_tmv_codigo_key" ON "movimiento_caja" ("pag_numero", "tmv_codigo");
CREATE TABLE "notificacion" (
    "not_numero" SERIAL NOT NULL,
    "not_destino" CHAR(1) NOT NULL,
    "cli_cedula" VARCHAR(10),
    "emp_cedula" VARCHAR(10),
    "ins_numero" INTEGER,
    "ped_numero" INTEGER,
    "prm_numero" INTEGER,
    "prd_codigo" VARCHAR(13),
    "lot_codigo" INTEGER,
    "not_tipo" CHAR(1) NOT NULL,
    "not_mensaje" VARCHAR(500) NOT NULL,
    "not_fecha_envio" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "not_canal" CHAR(1) NOT NULL,
    "not_estado" CHAR(1) NOT NULL
);
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_pkey" PRIMARY KEY ("not_numero");
CREATE TABLE "mensaje_contacto" (
    "mct_numero" SERIAL NOT NULL,
    "emp_cedula" VARCHAR(10),
    "mct_nombre" VARCHAR(60) NOT NULL,
    "mct_correo" VARCHAR(120) NOT NULL,
    "mct_telefono" VARCHAR(10),
    "mct_mensaje" VARCHAR(400) NOT NULL,
    "mct_fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mct_estado" CHAR(1) DEFAULT 'P' NOT NULL
);
ALTER TABLE "mensaje_contacto" ADD CONSTRAINT "mensaje_contacto_pkey" PRIMARY KEY ("mct_numero");
ALTER TABLE "horario_atencion" ADD CONSTRAINT "horario_atencion_gim_ruc_fkey" FOREIGN KEY ("gim_ruc") REFERENCES "gimnasio" ("gim_ruc") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usr_codigo_fkey" FOREIGN KEY ("usr_codigo") REFERENCES "usuario" ("usr_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_codigo_fkey" FOREIGN KEY ("rol_codigo") REFERENCES "rol" ("rol_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_usr_codigo_fkey" FOREIGN KEY ("usr_codigo") REFERENCES "usuario" ("usr_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_crg_codigo_fkey" FOREIGN KEY ("crg_codigo") REFERENCES "cargo" ("crg_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_tur_codigo_fkey" FOREIGN KEY ("tur_codigo") REFERENCES "turno" ("tur_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asistencia_empleado" ADD CONSTRAINT "asistencia_empleado_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_usr_codigo_fkey" FOREIGN KEY ("usr_codigo") REFERENCES "usuario" ("usr_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_niv_codigo_fkey" FOREIGN KEY ("niv_codigo") REFERENCES "nivel" ("niv_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "membresia_servicio" ADD CONSTRAINT "membresia_servicio_mem_codigo_fkey" FOREIGN KEY ("mem_codigo") REFERENCES "membresia" ("mem_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membresia_servicio" ADD CONSTRAINT "membresia_servicio_srv_codigo_fkey" FOREIGN KEY ("srv_codigo") REFERENCES "servicio" ("srv_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membresia_promocion" ADD CONSTRAINT "membresia_promocion_mem_codigo_fkey" FOREIGN KEY ("mem_codigo") REFERENCES "membresia" ("mem_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membresia_promocion" ADD CONSTRAINT "membresia_promocion_prm_numero_fkey" FOREIGN KEY ("prm_numero") REFERENCES "promocion" ("prm_numero") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_mem_codigo_fkey" FOREIGN KEY ("mem_codigo") REFERENCES "membresia" ("mem_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_prm_numero_fkey" FOREIGN KEY ("prm_numero") REFERENCES "promocion" ("prm_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_ins_emp_autoriza_fkey" FOREIGN KEY ("ins_emp_autoriza") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_ins_emp_anula_fkey" FOREIGN KEY ("ins_emp_anula") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inscripcion_cliente" ADD CONSTRAINT "inscripcion_cliente_ins_numero_fkey" FOREIGN KEY ("ins_numero") REFERENCES "inscripcion" ("ins_numero") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inscripcion_cliente" ADD CONSTRAINT "inscripcion_cliente_cli_cedula_fkey" FOREIGN KEY ("cli_cedula") REFERENCES "cliente" ("cli_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suspension" ADD CONSTRAINT "suspension_ins_numero_fkey" FOREIGN KEY ("ins_numero") REFERENCES "inscripcion" ("ins_numero") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suspension" ADD CONSTRAINT "suspension_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suspension" ADD CONSTRAINT "suspension_sus_emp_anula_fkey" FOREIGN KEY ("sus_emp_anula") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clase" ADD CONSTRAINT "clase_srv_codigo_fkey" FOREIGN KEY ("srv_codigo") REFERENCES "servicio" ("srv_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clase" ADD CONSTRAINT "clase_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clase_horario" ADD CONSTRAINT "clase_horario_cla_codigo_fkey" FOREIGN KEY ("cla_codigo") REFERENCES "clase" ("cla_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clase_horario" ADD CONSTRAINT "clase_horario_hor_codigo_fkey" FOREIGN KEY ("hor_codigo") REFERENCES "horario" ("hor_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencia_cliente" ADD CONSTRAINT "asistencia_cliente_ins_numero_cli_cedula_fkey" FOREIGN KEY ("ins_numero", "cli_cedula") REFERENCES "inscripcion_cliente" ("ins_numero", "cli_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencia_cliente" ADD CONSTRAINT "asistencia_cliente_cla_codigo_hor_codigo_fkey" FOREIGN KEY ("cla_codigo", "hor_codigo") REFERENCES "clase_horario" ("cla_codigo", "hor_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rutina" ADD CONSTRAINT "rutina_niv_codigo_fkey" FOREIGN KEY ("niv_codigo") REFERENCES "nivel" ("niv_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rutina" ADD CONSTRAINT "rutina_cli_cedula_fkey" FOREIGN KEY ("cli_cedula") REFERENCES "cliente" ("cli_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rutina" ADD CONSTRAINT "rutina_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profesional_aliado" ADD CONSTRAINT "profesional_aliado_srv_codigo_fkey" FOREIGN KEY ("srv_codigo") REFERENCES "servicio" ("srv_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comision_aliado" ADD CONSTRAINT "comision_aliado_pal_cedula_fkey" FOREIGN KEY ("pal_cedula") REFERENCES "profesional_aliado" ("pal_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comision_aliado" ADD CONSTRAINT "comision_aliado_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comision_aliado" ADD CONSTRAINT "comision_aliado_mpg_codigo_fkey" FOREIGN KEY ("mpg_codigo") REFERENCES "metodo_pago" ("mpg_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "producto" ADD CONSTRAINT "producto_cat_codigo_fkey" FOREIGN KEY ("cat_codigo") REFERENCES "categoria" ("cat_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "producto" ADD CONSTRAINT "producto_unm_codigo_fkey" FOREIGN KEY ("unm_codigo") REFERENCES "unidad_medida" ("unm_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "producto_proveedor" ADD CONSTRAINT "producto_proveedor_prd_codigo_fkey" FOREIGN KEY ("prd_codigo") REFERENCES "producto" ("prd_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "producto_proveedor" ADD CONSTRAINT "producto_proveedor_prv_ci_ruc_fkey" FOREIGN KEY ("prv_ci_ruc") REFERENCES "proveedor" ("prv_ci_ruc") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_prv_ci_ruc_fkey" FOREIGN KEY ("prv_ci_ruc") REFERENCES "proveedor" ("prv_ci_ruc") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_orc_emp_autoriza_fkey" FOREIGN KEY ("orc_emp_autoriza") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "producto_ordencompra" ADD CONSTRAINT "producto_ordencompra_orc_numero_fkey" FOREIGN KEY ("orc_numero") REFERENCES "orden_compra" ("orc_numero") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "producto_ordencompra" ADD CONSTRAINT "producto_ordencompra_prd_codigo_fkey" FOREIGN KEY ("prd_codigo") REFERENCES "producto" ("prd_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lote_producto" ADD CONSTRAINT "lote_producto_prd_codigo_fkey" FOREIGN KEY ("prd_codigo") REFERENCES "producto" ("prd_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lote_producto" ADD CONSTRAINT "lote_producto_prd_codigo_orc_numero_fkey" FOREIGN KEY ("prd_codigo", "orc_numero") REFERENCES "producto_ordencompra" ("prd_codigo", "orc_numero") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_lot_codigo_fkey" FOREIGN KEY ("lot_codigo") REFERENCES "lote_producto" ("lot_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_tmv_codigo_fkey" FOREIGN KEY ("tmv_codigo") REFERENCES "tipo_movimiento" ("tmv_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_ven_numero_fkey" FOREIGN KEY ("ven_numero") REFERENCES "venta" ("ven_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_usr_codigo_fkey" FOREIGN KEY ("usr_codigo") REFERENCES "usuario" ("usr_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_mpg_codigo_fkey" FOREIGN KEY ("mpg_codigo") REFERENCES "metodo_pago" ("mpg_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_ped_numero_fkey" FOREIGN KEY ("ped_numero") REFERENCES "pedido" ("ped_numero") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_prd_codigo_fkey" FOREIGN KEY ("prd_codigo") REFERENCES "producto" ("prd_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "venta" ADD CONSTRAINT "venta_ped_numero_fkey" FOREIGN KEY ("ped_numero") REFERENCES "pedido" ("ped_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "venta" ADD CONSTRAINT "venta_cli_cedula_fkey" FOREIGN KEY ("cli_cedula") REFERENCES "cliente" ("cli_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "venta" ADD CONSTRAINT "venta_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "venta" ADD CONSTRAINT "venta_ven_emp_anula_fkey" FOREIGN KEY ("ven_emp_anula") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_ven_numero_fkey" FOREIGN KEY ("ven_numero") REFERENCES "venta" ("ven_numero") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "detalle_venta" ADD CONSTRAINT "detalle_venta_prd_codigo_fkey" FOREIGN KEY ("prd_codigo") REFERENCES "producto" ("prd_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "factura" ADD CONSTRAINT "factura_ven_numero_fkey" FOREIGN KEY ("ven_numero") REFERENCES "venta" ("ven_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "factura" ADD CONSTRAINT "factura_ins_numero_fkey" FOREIGN KEY ("ins_numero") REFERENCES "inscripcion" ("ins_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "factura" ADD CONSTRAINT "factura_cli_cedula_fkey" FOREIGN KEY ("cli_cedula") REFERENCES "cliente" ("cli_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "factura" ADD CONSTRAINT "factura_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pago" ADD CONSTRAINT "pago_mpg_codigo_fkey" FOREIGN KEY ("mpg_codigo") REFERENCES "metodo_pago" ("mpg_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pago" ADD CONSTRAINT "pago_ven_numero_fkey" FOREIGN KEY ("ven_numero") REFERENCES "venta" ("ven_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pago" ADD CONSTRAINT "pago_ins_numero_fkey" FOREIGN KEY ("ins_numero") REFERENCES "inscripcion" ("ins_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pago" ADD CONSTRAINT "pago_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cierre_caja" ADD CONSTRAINT "cierre_caja_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cuadre_turno" ADD CONSTRAINT "cuadre_turno_tur_codigo_fkey" FOREIGN KEY ("tur_codigo") REFERENCES "turno" ("tur_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cuadre_turno" ADD CONSTRAINT "cuadre_turno_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cuadre_turno" ADD CONSTRAINT "cuadre_turno_ccj_numero_fkey" FOREIGN KEY ("ccj_numero") REFERENCES "cierre_caja" ("ccj_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_coa_numero_fkey" FOREIGN KEY ("coa_numero") REFERENCES "comision_aliado" ("coa_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_pag_numero_fkey" FOREIGN KEY ("pag_numero") REFERENCES "pago" ("pag_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_tmv_codigo_fkey" FOREIGN KEY ("tmv_codigo") REFERENCES "tipo_movimiento" ("tmv_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_ctu_numero_fkey" FOREIGN KEY ("ctu_numero") REFERENCES "cuadre_turno" ("ctu_numero") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_prm_numero_fkey" FOREIGN KEY ("prm_numero") REFERENCES "promocion" ("prm_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_cli_cedula_fkey" FOREIGN KEY ("cli_cedula") REFERENCES "cliente" ("cli_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_ins_numero_fkey" FOREIGN KEY ("ins_numero") REFERENCES "inscripcion" ("ins_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_ped_numero_fkey" FOREIGN KEY ("ped_numero") REFERENCES "pedido" ("ped_numero") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_prd_codigo_fkey" FOREIGN KEY ("prd_codigo") REFERENCES "producto" ("prd_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_lot_codigo_fkey" FOREIGN KEY ("lot_codigo") REFERENCES "lote_producto" ("lot_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mensaje_contacto" ADD CONSTRAINT "mensaje_contacto_emp_cedula_fkey" FOREIGN KEY ("emp_cedula") REFERENCES "empleado" ("emp_cedula") ON DELETE SET NULL ON UPDATE CASCADE;

