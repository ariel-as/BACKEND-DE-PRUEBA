CREATE TABLE "imagen" (
    "img_numero" SERIAL NOT NULL,
    "prd_codigo" VARCHAR(13) NOT NULL,
    "img_foto_url" VARCHAR(200) NOT NULL,

    CONSTRAINT "imagen_pkey" PRIMARY KEY ("img_numero")
);

ALTER TABLE "imagen" ADD CONSTRAINT "imagen_prd_codigo_fkey" FOREIGN KEY ("prd_codigo") REFERENCES "producto" ("prd_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
