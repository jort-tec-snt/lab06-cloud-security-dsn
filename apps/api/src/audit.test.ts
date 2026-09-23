import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

const password = "SecureDocs-Demo-Only-2026!";
const documentId = "00000000-0000-4000-8000-000000000005";
let server: Server;
let base: string;

before(async () => {
  server = createApp(async () => undefined).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

async function login(correo: string, submittedPassword = password) {
  return fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ correo, password: submittedPassword }) });
}

async function token(correo: string): Promise<string> {
  const response = await login(correo);
  assert.equal(response.status, 200);
  return (await response.json() as { accessToken: string }).accessToken;
}

function headers(accessToken: string) { return { authorization: `Bearer ${accessToken}` }; }

async function recent(since: Date, accion: string, recurso: string) {
  return prisma.auditoria.findMany({ where: { createdAt: { gte: since }, accion, recurso }, orderBy: { createdAt: "asc" } });
}

test("login permitido e inválido registran identidad verificable y nunca secretos", async () => {
  const since = new Date();
  const allowed = await login("admin@securedocs.test");
  assert.equal(allowed.status, 200);
  const { accessToken } = await allowed.json() as { accessToken: string };
  const denied = await login("admin@securedocs.test", "contraseña incorrecta");
  assert.equal(denied.status, 401);
  const rows = await recent(since, "INICIAR_SESION", "auth/login");
  assert.equal(rows.length, 2);
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { correo: "admin@securedocs.test" } });
  assert.equal(rows[0]!.usuarioId, admin.id);
  assert.equal(rows[0]!.resultado, "PERMITIDO");
  assert.equal(rows[1]!.usuarioId, null);
  assert.equal(rows[1]!.resultado, "DENEGADO");
  assert.equal(rows[1]!.motivo, "AUTH: CREDENCIALES_INVALIDAS");
  for (const row of rows) {
    assert.ok(row.fecha && row.direccionIp && row.ubicacion && row.dispositivo);
    const saved = JSON.stringify(row);
    for (const secret of [password, "contraseña incorrecta", accessToken, "Bearer", admin.passwordHash]) {
      assert.equal(saved.includes(secret), false);
    }
  }
});

test("token ausente y revocado dejan AUTH; me, permisos y logout se auditan", async () => {
  const accessToken = await token("auditor@securedocs.test");
  const auditor = await prisma.usuario.findUniqueOrThrow({ where: { correo: "auditor@securedocs.test" } });
  const since = new Date();
  assert.equal((await fetch(`${base}/auth/me`)).status, 401);
  assert.equal((await fetch(`${base}/auth/me`, { headers: headers(accessToken) })).status, 200);
  assert.equal((await fetch(`${base}/auth/permissions`, { headers: headers(accessToken) })).status, 200);
  assert.equal((await fetch(`${base}/auth/logout`, { method: "POST", headers: headers(accessToken) })).status, 204);
  assert.equal((await fetch(`${base}/auth/me`, { headers: headers(accessToken) })).status, 401);
  const me = await recent(since, "CONSULTAR_SESION", "auth/me");
  assert.equal(me.length, 3);
  assert.deepEqual(me.map(row => row.motivo), ["AUTH: TOKEN_AUSENTE", "AUTH: válida", "AUTH: TOKEN_REVOCADO"]);
  assert.deepEqual(me.map(row => row.usuarioId), [null, auditor.id, auditor.id]);
  assert.equal((await recent(since, "CONSULTAR_PERMISOS", "auth/permissions")).length, 1);
  assert.equal((await recent(since, "CERRAR_SESION", "auth/logout")).length, 1);
});

test("empleado rechazado en usuarios queda DENEGADO por RBAC", async () => {
  const accessToken = await token("empleado@securedocs.test");
  const employee = await prisma.usuario.findUniqueOrThrow({ where: { correo: "empleado@securedocs.test" } });
  const since = new Date();
  for (const [method, path, accion] of [["GET", "/usuarios", "CONSULTAR_USUARIOS"], ["POST", "/usuarios", "CREAR_USUARIO"], ["PUT", `/usuarios/${employee.id}`, "MODIFICAR_USUARIO"]] as const) {
    const response = await fetch(`${base}${path}`, { method, headers: { ...headers(accessToken), "content-type": "application/json" }, ...(method === "GET" ? {} : { body: "{}" }) });
    assert.equal(response.status, 403);
    const rows = await recent(since, accion, path.slice(1));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.usuarioId, employee.id);
    assert.equal(rows[0]!.resultado, "DENEGADO");
    assert.match(rows[0]!.motivo, /^RBAC: permiso faltante GESTIONAR_USUARIOS$/);
  }
});

test("documentos conservan una auditoría principal y el listado evalúa cada documento", async () => {
  const accessToken = await token("admin@securedocs.test");
  const since = new Date();
  assert.equal((await fetch(`${base}/documentos/${documentId}`, { headers: headers(accessToken) })).status, 200);
  assert.equal((await recent(since, "CONSULTAR_DOCUMENTO", `documentos/${documentId}`)).length, 1);
  const listed = await fetch(`${base}/documentos`, { headers: headers(accessToken) });
  assert.equal(listed.status, 200);
  assert.equal((await recent(since, "CONSULTAR_DOCUMENTO", "documentos")).length, 1);
  const documents = await prisma.documento.count();
  const rows = await prisma.auditoria.findMany({ where: { createdAt: { gte: since }, accion: "CONSULTAR_DOCUMENTO", recurso: { startsWith: "documentos/" } } });
  assert.equal(rows.length, documents + 1);
});

test("GET auditoría se registra una vez y no admite mutaciones", async () => {
  const accessToken = await token("auditor@securedocs.test");
  const since = new Date();
  const response = await fetch(`${base}/auditoria`, { headers: headers(accessToken) });
  assert.equal(response.status, 200);
  assert.equal((await recent(since, "VER_AUDITORIA", "auditoria")).length, 1);
  for (const method of ["POST", "PUT", "DELETE"]) {
    assert.equal((await fetch(`${base}/auditoria`, { method, headers: headers(accessToken) })).status, 404);
  }
  assert.equal((await recent(since, "VER_AUDITORIA", "auditoria")).length, 1);
});

test("un fallo al escribir auditoría produce un error seguro", async () => {
  const accessToken = await token("admin@securedocs.test");
  const original = prisma.auditoria.create;
  try {
    prisma.auditoria.create = (() => { throw new Error("detalle privado de base"); }) as typeof original;
    const response = await fetch(`${base}/auth/me`, { headers: headers(accessToken) });
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.equal(body.includes("detalle privado de base"), false);
    assert.match(body, /INTERNAL_ERROR/);
  } finally {
    prisma.auditoria.create = original;
  }
});
