import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

let server: Server;
let baseUrl: string;
const password = "SecureDocs-Demo-Only-2026!";

before(async () => {
  server = createApp(async () => undefined).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

async function postLogin(correo: string, submittedPassword = password) {
  return fetch(`${baseUrl}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ correo, password: submittedPassword })
  });
}

test("login válido devuelve JWT y usuario sin hash", async () => {
  const response = await postLogin("admin@securedocs.test");
  assert.equal(response.status, 200);
  const body = await response.json() as { accessToken: string; user: Record<string, unknown> };
  assert.equal(body.user.correo, "admin@securedocs.test");
  assert.equal(body.user.rol, "ADMINISTRADOR");
  assert.equal(body.user.pais, "PERU");
  assert.ok(body.accessToken.length > 30);
  assert.equal(body.user.passwordHash, undefined);
});

test("los documentos de prueba usan PERU igual que sus propietarios", async () => {
  const documents = await prisma.documento.findMany({
    where: { id: { in: [1, 2, 3, 4, 5].map(number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`) } },
    select: { pais: true, propietario: { select: { pais: true } } }
  });
  assert.equal(documents.length, 5);
  assert.equal(documents.every(document => document.pais === "PERU" && document.propietario.pais === "PERU"), true);
});

test("credenciales inválidas no revelan el usuario", async () => {
  const response = await postLogin("admin@securedocs.test", "incorrecta");
  assert.equal(response.status, 401);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "INVALID_CREDENTIALS");
});

test("usuarios INACTIVO y SUSPENDIDO no pueden iniciar sesión", async () => {
  for (const correo of ["inactivo@securedocs.test", "suspendido@securedocs.test"]) {
    const response = await postLogin(correo);
    assert.equal(response.status, 401);
  }
});

test("GET /auth/me exige token", async () => {
  const response = await fetch(`${baseUrl}/auth/me`);
  assert.equal(response.status, 401);
});

test("GET /auth/me acepta JWT válido y rechaza uno inválido", async () => {
  const login = await postLogin("empleado@securedocs.test");
  const { accessToken } = await login.json() as { accessToken: string };
  const response = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  assert.equal(response.status, 200);
  const body = await response.json() as { user: Record<string, unknown> };
  assert.equal(body.user.correo, "empleado@securedocs.test");
  assert.equal(body.user.passwordHash, undefined);
  const invalid = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: "Bearer invalid.token.value" } });
  assert.equal(invalid.status, 401);
});

test("JWT existente deja de funcionar si el usuario pasa a INACTIVO", async () => {
  const login = await postLogin("empleado@securedocs.test");
  const { accessToken } = await login.json() as { accessToken: string };
  const correo = "empleado@securedocs.test";
  try {
    await prisma.usuario.update({ where: { correo }, data: { estado: "INACTIVO" } });
    const response = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${accessToken}` } });
    assert.equal(response.status, 401);
  } finally {
    await prisma.usuario.update({ where: { correo }, data: { estado: "ACTIVO" } });
  }
});

test("logout persiste la revocación y el JWT deja de funcionar", async () => {
  const login = await postLogin("auditor@securedocs.test");
  const { accessToken } = await login.json() as { accessToken: string };
  const headers = { authorization: `Bearer ${accessToken}` };
  const logout = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers });
  assert.equal(logout.status, 204);
  assert.equal((await prisma.tokenRevocado.count({ where: { usuario: { correo: "auditor@securedocs.test" } } })) > 0, true);
  const revoked = await fetch(`${baseUrl}/auth/me`, { headers });
  assert.equal(revoked.status, 401);
});

test("usuarios exige autenticación y permite crear, listar y actualizar sin exponer hash", async () => {
  assert.equal((await fetch(`${baseUrl}/usuarios`)).status, 401);
  const login = await postLogin("admin@securedocs.test");
  const { accessToken } = await login.json() as { accessToken: string };
  const headers = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
  const correo = `test-${Date.now()}@securedocs.test`;
  let createdId: string | undefined;
  try {
    const created = await fetch(`${baseUrl}/usuarios`, {
      method: "POST", headers,
      body: JSON.stringify({ nombre: "Usuario Prueba", correo, password: "Clave-local-prueba-2026!", rol: "EMPLEADO", departamento: "TECNOLOGIA", nivelSeguridad: "NIVEL_2", pais: " peru ", tipoContrato: "TEMPORAL", estado: "ACTIVO" })
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { user: { id: string; pais: string; passwordHash?: string } };
    createdId = createdBody.user.id;
    assert.equal(createdBody.user.pais, "PERU");
    assert.equal(createdBody.user.passwordHash, undefined);
    const duplicate = await fetch(`${baseUrl}/usuarios`, {
      method: "POST", headers,
      body: JSON.stringify({ nombre: "Duplicado", correo, password: "Clave-local-prueba-2026!", rol: "EMPLEADO", departamento: "TECNOLOGIA", nivelSeguridad: "NIVEL_2", pais: "PERU", tipoContrato: "TEMPORAL", estado: "ACTIVO" })
    });
    assert.equal(duplicate.status, 409);
    const listed = await fetch(`${baseUrl}/usuarios`, { headers });
    assert.equal(listed.status, 200);
    const listBody = await listed.json() as { users: Array<{ correo: string; passwordHash?: string }> };
    assert.equal(listBody.users.some(user => user.correo === correo), true);
    assert.equal(listBody.users.every(user => user.passwordHash === undefined), true);
    const updated = await fetch(`${baseUrl}/usuarios/${createdId}`, {
      method: "PUT", headers, body: JSON.stringify({ estado: "SUSPENDIDO", departamento: null, pais: " costa rica " })
    });
    assert.equal(updated.status, 200);
    const updatedBody = await updated.json() as { user: { estado: string; departamento: string | null; pais: string } };
    assert.equal(updatedBody.user.estado, "SUSPENDIDO");
    assert.equal(updatedBody.user.departamento, null);
    assert.equal(updatedBody.user.pais, "COSTA RICA");
    for (const pais of ["P", "PERU<script>", "PERU  CHILE", "A".repeat(81)]) {
      const invalid: Response = await fetch(`${baseUrl}/usuarios/${createdId}`, {
        method: "PUT", headers, body: JSON.stringify({ pais })
      });
      assert.equal(invalid.status, 400, `El país ${pais} debe rechazarse`);
    }
  } finally {
    if (createdId) await prisma.usuario.delete({ where: { id: createdId } });
  }
});
