import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./lib/prisma";
import { ApiError } from "./lib/errors";
import { publicUserSelect, serializeUser, type PublicUser } from "./lib/user";

const loginSchema = z.strictObject({
  correo: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1)
});

const claimsSchema = z.object({
  id: z.uuid(), correo: z.email(), rol: z.string(), departamento: z.string().nullable(),
  nivelSeguridad: z.string(), pais: z.string(), tipoContrato: z.string(), estado: z.string(),
  jti: z.uuid(), exp: z.number().int()
});

export function authConfig() {
  return z.object({
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/)
  }).parse(process.env);
}

export function issueToken(user: PublicUser): string {
  const config = authConfig();
  return jwt.sign({
    id: user.id,
    correo: user.correo,
    rol: user.rol.nombre,
    departamento: user.departamento?.nombre ?? null,
    nivelSeguridad: user.nivelSeguridad,
    pais: user.pais,
    tipoContrato: user.tipoContrato,
    estado: user.estado
  }, config.JWT_SECRET, {
    algorithm: "HS256", issuer: "securedocs-api", audience: "securedocs-api",
    jwtid: randomUUID(), expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });
}

type AuthenticatedRequest = Request & { auth?: { user: PublicUser; token: JwtPayload & z.infer<typeof claimsSchema> } };

export async function authenticate(request: AuthenticatedRequest, _response: Response, next: NextFunction): Promise<void> {
  try {
    const match = /^Bearer ([^\s]+)$/i.exec(request.header("authorization") ?? "");
    if (!match?.[1]) throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
    let decoded: JwtPayload | string;
    try {
      decoded = jwt.verify(match[1], authConfig().JWT_SECRET, {
        algorithms: ["HS256"], issuer: "securedocs-api", audience: "securedocs-api"
      });
    } catch {
      throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
    }
    const parsed = claimsSchema.safeParse(decoded);
    if (!parsed.success) throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
    const [revoked, user] = await Promise.all([
      prisma.tokenRevocado.findUnique({ where: { jti: parsed.data.jti }, select: { jti: true } }),
      prisma.usuario.findUnique({ where: { id: parsed.data.id }, select: publicUserSelect })
    ]);
    if (revoked || !user || user.estado !== "ACTIVO") throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
    request.auth = { user, token: parsed.data };
    next();
  } catch (error) {
    next(error);
  }
}

export async function login(request: Request, response: Response): Promise<void> {
  const input = loginSchema.parse(request.body);
  const user = await prisma.usuario.findUnique({
    where: { correo: input.correo },
    select: { passwordHash: true, ...publicUserSelect }
  });
  if (!user || !(await compare(input.password, user.passwordHash)) || user.estado !== "ACTIVO") {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Credenciales inválidas");
  }
  response.json({ accessToken: issueToken(user), tokenType: "Bearer", user: serializeUser(user) });
}

export function me(request: AuthenticatedRequest, response: Response): void {
  response.json({ user: serializeUser(request.auth!.user) });
}

export async function logout(request: AuthenticatedRequest, response: Response): Promise<void> {
  const token = request.auth!.token;
  await prisma.tokenRevocado.upsert({
    where: { jti: token.jti },
    update: {},
    create: { jti: token.jti, usuarioId: request.auth!.user.id, expiresAt: new Date(token.exp * 1000) }
  });
  response.status(204).send();
}
