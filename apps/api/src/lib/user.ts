import { Prisma } from "@prisma/client";

export const publicUserSelect = {
  id: true,
  nombre: true,
  correo: true,
  rol: { select: { nombre: true } },
  departamento: { select: { nombre: true } },
  nivelSeguridad: true,
  pais: true,
  tipoContrato: true,
  estado: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UsuarioSelect;

export type PublicUser = Prisma.UsuarioGetPayload<{ select: typeof publicUserSelect }>;

export function serializeUser(user: PublicUser) {
  return {
    id: user.id,
    nombre: user.nombre,
    correo: user.correo,
    rol: user.rol.nombre,
    departamento: user.departamento?.nombre ?? null,
    nivelSeguridad: user.nivelSeguridad,
    pais: user.pais,
    tipoContrato: user.tipoContrato,
    estado: user.estado,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
