import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

const seed = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const password = "SecureDocs-Demo-Only-2026!";
const tokens = new Map<string, string>();
let server: Server;
let base: string;
let highTech: string;
let guestDenied: string;
let financeDelete: string;
let createdByAdmin: string | undefined;
let originalDemo: string | undefined;

before(async () => {
  originalDemo = process.env.DEMO_MODE;
  process.env.DEMO_MODE = "true";
  const tech = await prisma.departamento.findUniqueOrThrow({ where: { nombre: "TECNOLOGIA" } });
  const finance = await prisma.departamento.findUniqueOrThrow({ where: { nombre: "FINANZAS" } });
  const employee = await prisma.usuario.findUniqueOrThrow({ where: { correo: "empleado@securedocs.test" } });
  const manager = await prisma.usuario.findUniqueOrThrow({ where: { correo: "gerente@securedocs.test" } });
  highTech = randomUUID();
  guestDenied = randomUUID();
  financeDelete = randomUUID();
  for (const document of [
    { id: highTech, titulo: "Alto nivel técnico", propietarioId: employee.id, departamentoId: tech.id, nivelConfidencialidad: "NIVEL_4" as const, estado: "PUBLICADO" as const },
    { id: guestDenied, titulo: "Restringido a invitados", propietarioId: employee.id, departamentoId: tech.id, nivelConfidencialidad: "NIVEL_2" as const, estado: "PUBLICADO" as const },
    { id: financeDelete, titulo: "Eliminar en prueba", propietarioId: manager.id, departamentoId: finance.id, nivelConfidencialidad: "NIVEL_2" as const, estado: "PUBLICADO" as const }
  ]) {
    await prisma.documento.create({ data: { ...document, descripcion: "Documento de prueba HTTP", pais: "PERU" } });
  }
  server = createApp(async () => undefined).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const correo of ["admin", "gerente", "supervisor", "empleado", "auditor", "invitado", "externo"]) {
    const address = correo === "externo" ? "externo@partner.test" : `${correo}@securedocs.test`;
    const response = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ correo: address, password }) });
    assert.equal(response.status, 200, address);
    tokens.set(correo, (await response.json() as { accessToken: string }).accessToken);
  }
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (createdByAdmin) await prisma.documento.deleteMany({ where: { id: createdByAdmin } });
  await prisma.documento.deleteMany({ where: { id: { in: [highTech, guestDenied, financeDelete] } } });
  await prisma.documento.update({ where: { id: seed(4) }, data: { estado: "PENDIENTE" } });
  await prisma.documento.update({ where: { id: seed(3) }, data: { descripcion: "Proceso de incorporación para personal nuevo." } });
  await prisma.documento.update({ where: { id: seed(5) }, data: { descripcion: "Herramientas aprobadas para el trabajo diario." } });
  if (originalDemo === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = originalDemo;
  await prisma.$disconnect();
});

function call(path: string, role?: string, method = "GET", body?: unknown, demo: Record<string, string> = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(role ? { authorization: `Bearer ${tokens.get(role)}` } : {}), "content-type": "application/json", ...demo },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

async function denied(response: Response, code: string, policy?: string) {
  assert.equal(response.status, code === "UNAUTHORIZED" ? 401 : 403);
  const payload = await response.json() as { error: { code: string; politica?: string } };
  assert.equal(payload.error.code, code);
  if (policy) assert.equal(payload.error.politica, policy);
}

test("01 empleado consulta documento de su área", async () => {
  assert.equal((await call(`/documentos/${seed(5)}`, "empleado")).status, 200);
});
test("02 empleado consulta otra área: ABAC", async () => {
  await denied(await call(`/documentos/${seed(3)}`, "empleado"), "ABAC_DENIED", "MISMO_DEPARTAMENTO");
});
test("03 supervisor aprueba documento de su área", async () => {
  const response = await call(`/documentos/${seed(4)}/aprobar`, "supervisor", "POST", {});
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { documento: { estado: string } }).documento.estado, "PUBLICADO");
  await prisma.documento.update({ where: { id: seed(4) }, data: { estado: "PENDIENTE" } });
});
test("04 empleado no puede aprobar: RBAC", async () => {
  await denied(await call(`/documentos/${seed(4)}/aprobar`, "empleado", "POST", {}), "RBAC_DENIED");
});
test("05 nivel 2 consulta nivel 4: ABAC", async () => {
  await denied(await call(`/documentos/${highTech}`, "empleado", "GET", undefined, { "x-demo-hour": "11", "x-demo-device": "CORPORATIVO" }), "ABAC_DENIED", "NIVEL_SEGURIDAD");
});
test("06 gerente elimina documento", async () => {
  assert.equal((await call(`/documentos/${financeDelete}`, "gerente", "DELETE")).status, 204);
  assert.equal(await prisma.documento.count({ where: { id: financeDelete } }), 0);
});
test("07 auditor no puede modificar: RBAC", async () => {
  await denied(await call(`/documentos/${seed(5)}`, "auditor", "PUT", { titulo: "No autorizado" }), "RBAC_DENIED");
});
test("08 usuario inactivo con token vigente no accede", async () => {
  const correo = "empleado@securedocs.test";
  try {
    await prisma.usuario.update({ where: { correo }, data: { estado: "INACTIVO" } });
    await denied(await call(`/documentos/${seed(5)}`, "empleado"), "UNAUTHORIZED");
  } finally {
    await prisma.usuario.update({ where: { correo }, data: { estado: "ACTIVO" } });
  }
});
test("09 confidencial fuera del horario: ABAC", async () => {
  await denied(await call(`/documentos/${seed(2)}`, "admin", "GET", undefined, { "x-demo-hour": "19", "x-demo-device": "CORPORATIVO" }), "ABAC_DENIED", "HORARIO_LABORAL");
});
test("10 nivel 5 desde dispositivo personal: ABAC", async () => {
  await denied(await call(`/documentos/${seed(1)}`, "admin", "GET", undefined, { "x-demo-hour": "11", "x-demo-device": "PERSONAL" }), "ABAC_DENIED", "DISPOSITIVO_CONFIABLE");
});
test("11 invitado consulta público nivel 1", async () => {
  assert.equal((await call(`/documentos/${seed(5)}`, "invitado")).status, 200);
});
test("12 invitado no consulta confidencial", async () => {
  await denied(await call(`/documentos/${guestDenied}`, "invitado"), "ABAC_DENIED", "NIVEL_SEGURIDAD");
});
test("13 empleado modifica documento propio", async () => {
  const response = await call(`/documentos/${seed(5)}`, "empleado", "PUT", { descripcion: "Descripción editada" });
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { documento: { descripcion: string } }).documento.descripcion, "Descripción editada");
});
test("14 gerente modifica documento ajeno", async () => {
  const response = await call(`/documentos/${seed(3)}`, "gerente", "PUT", { descripcion: "Edición de gerencia" });
  assert.equal(response.status, 200);
});
test("15 usuario de otro país: ABAC", async () => {
  await denied(await call(`/documentos/${seed(5)}`, "externo"), "ABAC_DENIED", "PAIS_PERMITIDO");
});
test("16 administrador crea documento pendiente y queda como propietario", async () => {
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { correo: "admin@securedocs.test" } });
  const response = await call("/documentos", "admin", "POST", {
    titulo: "Documento nuevo", descripcion: "Creado por API", departamentoId: admin.departamentoId,
    nivelConfidencialidad: "NIVEL_1", pais: "PERU"
  });
  assert.equal(response.status, 201);
  const { documento } = await response.json() as { documento: { id: string; propietarioId: string; estado: string } };
  createdByAdmin = documento.id;
  assert.equal(documento.propietarioId, admin.id);
  assert.equal(documento.estado, "PENDIENTE");
});
test("17 auditor consulta auditoría", async () => {
  const response = await call("/auditoria?limite=10&pagina=1", "auditor");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray((await response.json() as { auditorias: unknown[] }).auditorias));
});
test("auditoría registra permitidos, RBAC, ABAC y AUTH, y deniega VER_AUDITORIA faltante", async () => {
  await denied(await call("/auditoria", "empleado"), "RBAC_DENIED");
  await denied(await call(`/documentos/${seed(5)}`), "UNAUTHORIZED");
  const response = await call("/auditoria?limite=100", "auditor");
  assert.equal(response.status, 200);
  const rows = (await response.json() as { auditorias: { resultado: string; motivo: string; accion: string; direccionIp: string; ubicacion: string; dispositivo: string }[] }).auditorias;
  for (const prefix of ["RBAC:", "ABAC:", "AUTH:"]) assert.ok(rows.some(row => row.resultado === "DENEGADO" && row.motivo.startsWith(prefix)), prefix);
  assert.ok(rows.some(row => row.resultado === "PERMITIDO"));
  assert.ok(rows.every(row => row.direccionIp && row.ubicacion && row.dispositivo));
});
test("listado omite metadatos denegados y PUT evalúa recurso candidato", async () => {
  const list = await call("/documentos", "empleado");
  assert.equal(list.status, 200);
  const body = await list.json() as { documentos: { id: string; titulo: string }[] };
  assert.equal(body.documentos.some(document => document.id === seed(3) || document.id === highTech), false);
  const response = await call(`/documentos/${seed(5)}`, "empleado", "PUT", { nivelConfidencialidad: "NIVEL_4" });
  await denied(response, "ABAC_DENIED", "NIVEL_SEGURIDAD");
  assert.equal((await prisma.documento.findUniqueOrThrow({ where: { id: seed(5) } })).nivelConfidencialidad, "NIVEL_1");
});
test("campos protegidos, documento inexistente y paginación segura", async () => {
  assert.equal((await call(`/documentos/${seed(5)}`, "empleado", "PUT", { propietarioId: randomUUID() })).status, 400);
  assert.equal((await call(`/documentos/${randomUUID()}`, "empleado")).status, 404);
  assert.equal((await call("/auditoria?limite=101", "auditor")).status, 400);
  assert.equal((await call("/auditoria", "auditor", "POST", {})).status, 404);
});
test("token revocado queda auditado con motivo AUTH", async () => {
  const token = tokens.get("invitado")!;
  const logout = await fetch(`${base}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  assert.equal(logout.status, 204);
  await denied(await call(`/documentos/${seed(5)}`, "invitado"), "UNAUTHORIZED");
  const rows = await prisma.auditoria.findMany({ where: { accion: "CONSULTAR_DOCUMENTO", motivo: "AUTH: TOKEN_REVOCADO" } });
  assert.ok(rows.some(row => row.recurso === `documentos/${seed(5)}`));
});
test("cabeceras demo inválidas se rechazan y producción las ignora", async () => {
  assert.equal((await call(`/documentos/${seed(5)}`, "empleado", "GET", undefined, { "x-demo-hour": "24" })).status, 400);
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const response = await call(`/documentos/${seed(1)}`, "admin", "GET", undefined, { "x-demo-hour": "11", "x-demo-device": "CORPORATIVO" });
    await denied(response, "ABAC_DENIED");
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
