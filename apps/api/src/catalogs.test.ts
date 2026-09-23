import assert from "node:assert/strict";
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

test("el catálogo de departamentos exige JWT, limita la respuesta y audita cada intento", async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ correo: "empleado@securedocs.test", password: "SecureDocs-Demo-Only-2026!" })
  });
  assert.equal(login.status, 200);
  const { accessToken } = await login.json() as { accessToken: string };
  const employee = await prisma.usuario.findUniqueOrThrow({
    where: { correo: "empleado@securedocs.test" },
    select: { id: true }
  });
  const since = new Date();

  const missing = await fetch(`${baseUrl}/catalogos/departamentos`);
  assert.equal(missing.status, 401);
  const invalid = await fetch(`${baseUrl}/catalogos/departamentos`, {
    headers: { authorization: "Bearer invalid.token.value" }
  });
  assert.equal(invalid.status, 401);
  const response = await fetch(`${baseUrl}/catalogos/departamentos`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });

  assert.equal(response.status, 200);
  const body = await response.json() as { departamentos: Array<Record<string, unknown>> };
  assert.ok(body.departamentos.length > 0);
  assert.equal(body.departamentos.every(department => {
    assert.deepEqual(Object.keys(department).sort(), ["id", "nombre"]);
    return true;
  }), true);

  const audits = await prisma.auditoria.findMany({
    where: {
      createdAt: { gte: since },
      accion: "CONSULTAR_DEPARTAMENTOS",
      recurso: "catalogos/departamentos"
    }
  });
  assert.equal(audits.length, 3);
  assert.deepEqual(
    audits.map(audit => [audit.resultado, audit.motivo, audit.usuarioId]).sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
    [
      ["DENEGADO", "AUTH: TOKEN_AUSENTE", null],
      ["DENEGADO", "AUTH: TOKEN_INVALIDO", null],
      ["PERMITIDO", "AUTH: válida; catálogo no sensible consultado", employee.id]
    ].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  );
});
