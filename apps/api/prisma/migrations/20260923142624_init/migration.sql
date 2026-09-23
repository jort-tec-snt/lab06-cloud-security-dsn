-- CreateEnum
CREATE TYPE "NivelSeguridad" AS ENUM ('NIVEL_1', 'NIVEL_2', 'NIVEL_3', 'NIVEL_4', 'NIVEL_5');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('INDEFINIDO', 'TEMPORAL', 'CONSULTOR', 'EXTERNO');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('PUBLICADO', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "ResultadoAuditoria" AS ENUM ('PERMITIDO', 'DENEGADO', 'ERROR');

-- CreateTable
CREATE TABLE "departamentos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol_id" UUID NOT NULL,
    "departamento_id" UUID,
    "nivel_seguridad" "NivelSeguridad" NOT NULL,
    "pais" TEXT NOT NULL,
    "tipo_contrato" "TipoContrato" NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "propietario_id" UUID NOT NULL,
    "departamento_id" UUID NOT NULL,
    "nivel_confidencialidad" "NivelSeguridad" NOT NULL,
    "estado" "EstadoDocumento" NOT NULL,
    "pais" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "configuracion" JSONB NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "politicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "recurso" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" "ResultadoAuditoria" NOT NULL,
    "motivo" TEXT NOT NULL,
    "direccion_ip" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "dispositivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_nombre_key" ON "departamentos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "usuarios_rol_id_idx" ON "usuarios"("rol_id");

-- CreateIndex
CREATE INDEX "usuarios_departamento_id_idx" ON "usuarios"("departamento_id");

-- CreateIndex
CREATE INDEX "documentos_propietario_id_idx" ON "documentos"("propietario_id");

-- CreateIndex
CREATE INDEX "documentos_departamento_id_idx" ON "documentos"("departamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_codigo_key" ON "politicas"("codigo");

-- CreateIndex
CREATE INDEX "auditorias_usuario_id_idx" ON "auditorias"("usuario_id");

-- CreateIndex
CREATE INDEX "auditorias_fecha_idx" ON "auditorias"("fecha");

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
