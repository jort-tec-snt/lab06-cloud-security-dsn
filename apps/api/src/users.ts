import { EstadoUsuario, NivelSeguridad, TipoContrato } from "@prisma/client";
import { hash } from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "./lib/errors";
import { prisma } from "./lib/prisma";
import { publicUserSelect, serializeUser } from "./lib/user";

const fields = {
  nombre: z.string().trim().min(1).max(120),
  correo: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128),
  rol: z.enum(["ADMINISTRADOR", "GERENTE", "SUPERVISOR", "EMPLEADO", "AUDITOR", "INVITADO"]),
  departamento: z.string().trim().min(1).max(100).nullable(),
  nivelSeguridad: z.enum(NivelSeguridad),
  pais: z.string().trim().toUpperCase().min(2).max(80).regex(/^[A-ZÁÉÍÓÚÜÑ]+(?: [A-ZÁÉÍÓÚÜÑ]+)*$/),
  tipoContrato: z.enum(TipoContrato),
  estado: z.enum(EstadoUsuario)
};
const createSchema = z.strictObject(fields);
const updateSchema = createSchema.partial().refine(data => Object.keys(data).length > 0, "Se requiere al menos un campo");
const idSchema = z.uuid();

async function resolveRelations(rol?: string, departamento?: string | null) {
  const [role, department] = await Promise.all([
    rol === undefined ? undefined : prisma.rol.findUnique({ where: { nombre: rol }, select: { id: true } }),
    departamento == null ? undefined : prisma.departamento.findUnique({ where: { nombre: departamento }, select: { id: true } })
  ]);
  if (rol !== undefined && !role) throw new ApiError(400, "INVALID_ROLE", "Rol inválido");
  if (departamento !== undefined && departamento !== null && !department) {
    throw new ApiError(400, "INVALID_DEPARTMENT", "Departamento inválido");
  }
  return { rolId: role?.id, departamentoId: department?.id };
}

export async function listUsers(_request: Request, response: Response): Promise<void> {
  const users = await prisma.usuario.findMany({ select: publicUserSelect, orderBy: { correo: "asc" } });
  response.json({ users: users.map(serializeUser) });
}

export async function createUser(request: Request, response: Response): Promise<void> {
  const input = createSchema.parse(request.body);
  const { rolId, departamentoId } = await resolveRelations(input.rol, input.departamento);
  const user = await prisma.usuario.create({
    data: {
      nombre: input.nombre, correo: input.correo, passwordHash: await hash(input.password, 12),
      rolId: rolId!, departamentoId: departamentoId ?? null,
      nivelSeguridad: input.nivelSeguridad, pais: input.pais,
      tipoContrato: input.tipoContrato, estado: input.estado
    },
    select: publicUserSelect
  });
  response.status(201).json({ user: serializeUser(user) });
}

export async function updateUser(request: Request, response: Response): Promise<void> {
  const id = idSchema.parse(request.params.id);
  const input = updateSchema.parse(request.body);
  const exists = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
  const { rolId, departamentoId } = await resolveRelations(input.rol, input.departamento);
  const user = await prisma.usuario.update({
    where: { id },
    data: {
      nombre: input.nombre, correo: input.correo,
      passwordHash: input.password === undefined ? undefined : await hash(input.password, 12),
      rolId, departamentoId: input.departamento === undefined ? undefined : departamentoId ?? null,
      nivelSeguridad: input.nivelSeguridad, pais: input.pais,
      tipoContrato: input.tipoContrato, estado: input.estado
    },
    select: publicUserSelect
  });
  response.json({ user: serializeUser(user) });
}
