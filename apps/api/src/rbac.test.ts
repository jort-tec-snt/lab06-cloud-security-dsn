import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp(async () => undefined).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

async function token(correo: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ correo, password: "SecureDocs-Demo-Only-2026!" })
  });
  assert.equal(response.status, 200);
  return (await response.json() as { accessToken: string }).accessToken;
}

function headers(accessToken: string) {
  return { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
}

async function assertDenied(response: Response, permission: string): Promise<void> {
  assert.equal(response.status, 403);
  const body = await response.json() as { error: { code: string; permisoFaltante: string; message: string; passwordHash?: string } };
  assert.equal(body.error.code, "RBAC_DENIED");
  assert.equal(body.error.permisoFaltante, permission);
  assert.equal(body.error.message, "Permiso insuficiente");
  assert.equal(body.error.passwordHash, undefined);
}

test("administrador consulta sus permisos efectivos y lista usuarios", async () => {
  const accessToken = await token("admin@securedocs.test");
  const permissions = await fetch(`${baseUrl}/auth/permissions`, { headers: headers(accessToken) });
  assert.equal(permissions.status, 200);
  const body = await permissions.json() as { rol: string; permisos: string[]; passwordHash?: string };
  assert.equal(body.rol, "ADMINISTRADOR");
  assert.equal(body.permisos.length, 8);
  assert.ok(body.permisos.includes("GESTIONAR_USUARIOS"));
  assert.ok(body.permisos.includes("ASIGNAR_ROLES"));
  assert.equal(body.passwordHash, undefined);
  const listed = await fetch(`${baseUrl}/usuarios`, { headers: headers(accessToken) });
  assert.equal(listed.status, 200);
});

test("todos los roles sin GESTIONAR_USUARIOS reciben RBAC_DENIED al listar usuarios", async () => {
  for (const correo of [
    "gerente@securedocs.test", "supervisor@securedocs.test", "empleado@securedocs.test",
    "auditor@securedocs.test", "invitado@securedocs.test"
  ]) {
    const accessToken = await token(correo);
    await assertDenied(await fetch(`${baseUrl}/usuarios`, { headers: headers(accessToken) }), "GESTIONAR_USUARIOS");
  }
});

test("usuario autenticado sin permisos de gestión no crea ni actualiza usuarios", async () => {
  const accessToken = await token("empleado@securedocs.test");
  await assertDenied(await fetch(`${baseUrl}/usuarios`, {
    method: "POST", headers: headers(accessToken), body: JSON.stringify({})
  }), "GESTIONAR_USUARIOS");
  const user = await prisma.usuario.findUniqueOrThrow({ where: { correo: "empleado@securedocs.test" }, select: { id: true } });
  await assertDenied(await fetch(`${baseUrl}/usuarios/${user.id}`, {
    method: "PUT", headers: headers(accessToken), body: JSON.stringify({ nombre: "Otro nombre" })
  }), "GESTIONAR_USUARIOS");
  await assertDenied(await fetch(`${baseUrl}/usuarios/${user.id}`, {
    method: "PUT", headers: headers(accessToken), body: JSON.stringify({ rol: "AUDITOR" })
  }), "GESTIONAR_USUARIOS");
});

test("administrador crea usuario y actualiza su rol", async () => {
  const accessToken = await token("admin@securedocs.test");
  const correo = `rbac-${randomUUID()}@securedocs.test`;
  let createdId: string | undefined;
  try {
    const created = await fetch(`${baseUrl}/usuarios`, {
      method: "POST", headers: headers(accessToken),
      body: JSON.stringify({
        nombre: "Prueba RBAC", correo, password: "Clave-local-prueba-2026!", rol: "EMPLEADO",
        departamento: "TECNOLOGIA", nivelSeguridad: "NIVEL_2", pais: "PERU",
        tipoContrato: "TEMPORAL", estado: "ACTIVO"
      })
    });
    assert.equal(created.status, 201);
    const body = await created.json() as { user: { id: string; rol: string } };
    createdId = body.user.id;
    assert.equal(body.user.rol, "EMPLEADO");
    const updated = await fetch(`${baseUrl}/usuarios/${createdId}`, {
      method: "PUT", headers: headers(accessToken), body: JSON.stringify({ rol: "AUDITOR" })
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json() as { user: { rol: string } }).user.rol, "AUDITOR");
  } finally {
    if (createdId) await prisma.usuario.delete({ where: { id: createdId } });
  }
});

test("un JWT vigente pierde acceso cuando se retira el permiso en PostgreSQL", async () => {
  const accessToken = await token("admin@securedocs.test");
  const role = await prisma.rol.findUniqueOrThrow({ where: { nombre: "ADMINISTRADOR" }, select: { id: true } });
  const permission = await prisma.permiso.findUniqueOrThrow({ where: { codigo: "GESTIONAR_USUARIOS" }, select: { id: true } });
  const assignment = await prisma.rolPermiso.findUniqueOrThrow({
    where: { rolId_permisoId: { rolId: role.id, permisoId: permission.id } }, select: { createdAt: true }
  });
  try {
    await prisma.rolPermiso.delete({ where: { rolId_permisoId: { rolId: role.id, permisoId: permission.id } } });
    await assertDenied(await fetch(`${baseUrl}/usuarios`, { headers: headers(accessToken) }), "GESTIONAR_USUARIOS");
    const effective = await fetch(`${baseUrl}/auth/permissions`, { headers: headers(accessToken) });
    assert.equal(effective.status, 200);
    const body = await effective.json() as { permisos: string[] };
    assert.equal(body.permisos.includes("GESTIONAR_USUARIOS"), false);
  } finally {
    await prisma.rolPermiso.upsert({
      where: { rolId_permisoId: { rolId: role.id, permisoId: permission.id } },
      update: {}, create: { rolId: role.id, permisoId: permission.id, createdAt: assignment.createdAt }
    });
  }
  assert.equal((await fetch(`${baseUrl}/usuarios`, { headers: headers(accessToken) })).status, 200);
});

test("ASIGNAR_ROLES se exige para crear y cambiar rol, pero no para listar o editar otros campos", async () => {
  const accessToken = await token("admin@securedocs.test");
  const role = await prisma.rol.findUniqueOrThrow({ where: { nombre: "ADMINISTRADOR" }, select: { id: true } });
  const permission = await prisma.permiso.findUniqueOrThrow({ where: { codigo: "ASIGNAR_ROLES" }, select: { id: true } });
  const assignment = await prisma.rolPermiso.findUniqueOrThrow({
    where: { rolId_permisoId: { rolId: role.id, permisoId: permission.id } }, select: { createdAt: true }
  });
  const created = await fetch(`${baseUrl}/usuarios`, {
    method: "POST", headers: headers(accessToken), body: JSON.stringify({
      nombre: "Prueba permisos", correo: `rbac-${randomUUID()}@securedocs.test`,
      password: "Clave-local-prueba-2026!", rol: "EMPLEADO", departamento: "TECNOLOGIA",
      nivelSeguridad: "NIVEL_2", pais: "PERU", tipoContrato: "TEMPORAL", estado: "ACTIVO"
    })
  });
  assert.equal(created.status, 201);
  const target = (await created.json() as { user: { id: string } }).user;
  try {
    await prisma.rolPermiso.delete({ where: { rolId_permisoId: { rolId: role.id, permisoId: permission.id } } });
    assert.equal((await fetch(`${baseUrl}/usuarios`, { headers: headers(accessToken) })).status, 200);
    await assertDenied(await fetch(`${baseUrl}/usuarios`, {
      method: "POST", headers: headers(accessToken), body: JSON.stringify({})
    }), "ASIGNAR_ROLES");
    await assertDenied(await fetch(`${baseUrl}/usuarios/${target.id}`, {
      method: "PUT", headers: headers(accessToken), body: JSON.stringify({ rol: "AUDITOR" })
    }), "ASIGNAR_ROLES");
    const updated = await fetch(`${baseUrl}/usuarios/${target.id}`, {
      method: "PUT", headers: headers(accessToken), body: JSON.stringify({ nombre: "Prueba actualizada" })
    });
    assert.equal(updated.status, 200);
  } finally {
    await prisma.rolPermiso.upsert({
      where: { rolId_permisoId: { rolId: role.id, permisoId: permission.id } },
      update: {}, create: { rolId: role.id, permisoId: permission.id, createdAt: assignment.createdAt }
    });
    await prisma.usuario.delete({ where: { id: target.id } });
  }
});

test("auth/permissions exige JWT y auth/me sigue funcionando", async () => {
  assert.equal((await fetch(`${baseUrl}/auth/permissions`)).status, 401);
  const accessToken = await token("empleado@securedocs.test");
  assert.equal((await fetch(`${baseUrl}/auth/me`, { headers: headers(accessToken) })).status, 200);
  const effective = await fetch(`${baseUrl}/auth/permissions`, { headers: headers(accessToken) });
  assert.equal(effective.status, 200);
  const body = await effective.json() as { rol: string; permisos: string[] };
  assert.equal(body.rol, "EMPLEADO");
  assert.equal(body.permisos.includes("GESTIONAR_USUARIOS"), false);
});
