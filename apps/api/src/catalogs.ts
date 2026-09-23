import type { Request } from "express";
import type { AuditResponse } from "./audit";
import { prisma } from "./lib/prisma";

export async function listDepartments(_request: Request): Promise<AuditResponse> {
  const departamentos = await prisma.departamento.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" }
  });

  return { status: 200, body: { departamentos } };
}
