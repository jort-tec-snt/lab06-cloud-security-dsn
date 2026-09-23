import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { AbacContext, AbacDecision } from "./authorization/abac";
import { evaluateAbac } from "./authorization/abac";
import { createDocumentAuthorizer } from "./authorization/abac/authorize-document";
import { serverEnvironmentAdapter } from "./authorization/abac/environment";
import type { AuthenticatedRequest } from "./auth";
import { ApiError } from "./lib/errors";
import { prisma } from "./lib/prisma";

const at1130 = new Date("2026-09-23T16:30:00.000Z"); // 11:30 en Lima

function context(): AbacContext {
  return {
    usuario: {
      id: "u1", rol: "SUPERVISOR", departamentoId: "finanzas",
      nivelSeguridad: "NIVEL_3", pais: "PERU", tipoContrato: "INDEFINIDO", estado: "ACTIVO"
    },
    documento: {
      id: "d1", propietarioId: "u1", departamentoId: "finanzas",
      nivelConfidencialidad: "NIVEL_3", estado: "PUBLICADO", pais: "PERU"
    },
    accion: "CONSULTAR_DOCUMENTO",
    entorno: { fechaHora: at1130, direccionIp: "192.0.2.10", ubicacion: "PERU", dispositivo: "CORPORATIVO" }
  };
}

function checked(decision: AbacDecision, code: string, allowed: boolean): void {
  const evaluation = decision.evaluaciones.find(item => item.politica === code);
  assert.ok(evaluation, `${code} debe evaluarse`);
  assert.equal(evaluation.permitido, allowed);
  assert.equal(evaluation.resultado, allowed ? "PERMITIDO" : "DENEGADO");
  assert.notEqual(evaluation.valorEsperado, undefined);
  assert.notEqual(evaluation.valorDetectado, undefined);
}

after(async () => prisma.$disconnect());

test("guía: supervisor de Finanzas nivel 3 aprueba documento nivel 3", async () => {
  const input = context();
  input.accion = "APROBAR_DOCUMENTO";
  const decision = await evaluateAbac(input);
  assert.equal(decision.resultado, "ABAC_ALLOWED");
  assert.equal(decision.permitido, true);
  assert.equal(decision.politica, null);
  checked(decision, "NIVEL_SEGURIDAD", true);
  checked(decision, "USUARIO_ACTIVO", true);
});

test("departamento: empleado consulta y modifica el suyo; se deniega otro", async () => {
  for (const accion of ["CONSULTAR_DOCUMENTO", "MODIFICAR_DOCUMENTO"] as const) {
    const input = context();
    input.accion = accion;
    input.usuario.rol = "EMPLEADO";
    checked(await evaluateAbac(input), "MISMO_DEPARTAMENTO", true);
    input.documento.departamentoId = "rrhh";
    const denied = await evaluateAbac(input);
    checked(denied, "MISMO_DEPARTAMENTO", false);
    assert.equal(denied.resultado, "ABAC_DENIED");
  }
});

test("nivel: igualdad permite y nivel inferior deniega", async () => {
  const input = context();
  checked(await evaluateAbac(input), "NIVEL_SEGURIDAD", true);
  input.documento.nivelConfidencialidad = "NIVEL_4";
  checked(await evaluateAbac(input), "NIVEL_SEGURIDAD", false);
});

test("propietario: solo aplica a empleado que modifica; propiedad ajena deniega", async () => {
  const input = context();
  input.accion = "MODIFICAR_DOCUMENTO";
  input.usuario.rol = "EMPLEADO";
  checked(await evaluateAbac(input), "PROPIETARIO_DOCUMENTO", true);
  input.documento.propietarioId = "u2";
  checked(await evaluateAbac(input), "PROPIETARIO_DOCUMENTO", false);
  for (const rol of ["SUPERVISOR", "GERENTE", "ADMINISTRADOR"]) {
    input.usuario.rol = rol;
    assert.equal((await evaluateAbac(input)).evaluaciones.some(item => item.politica === "PROPIETARIO_DOCUMENTO"), false);
  }
  input.usuario.rol = "EMPLEADO";
  for (const accion of ["CONSULTAR_DOCUMENTO", "ELIMINAR_DOCUMENTO", "APROBAR_DOCUMENTO"] as const) {
    input.accion = accion;
    assert.equal((await evaluateAbac(input)).evaluaciones.some(item => item.politica === "PROPIETARIO_DOCUMENTO"), false);
  }
});

test("horario: nivel 5 se consulta a las 11:30; fuera de 08:00–18:00 se deniega", async () => {
  const input = context();
  input.usuario.nivelSeguridad = "NIVEL_5";
  input.documento.nivelConfidencialidad = "NIVEL_5";
  checked(await evaluateAbac(input), "HORARIO_LABORAL", true);
  input.entorno.fechaHora = new Date("2026-09-23T00:00:00.000Z"); // 19:00 Lima
  checked(await evaluateAbac(input), "HORARIO_LABORAL", false);
  assert.equal((await evaluateAbac(input)).resultado, "ABAC_DENIED");
});

test("país: consulta compara usuario.pais con documento.pais sin usar ubicación", async () => {
  const input = context();
  checked(await evaluateAbac(input), "PAIS_PERMITIDO", true);
  input.entorno.ubicacion = "CHILE";
  checked(await evaluateAbac(input), "PAIS_PERMITIDO", true);
  input.entorno.ubicacion = null;
  checked(await evaluateAbac(input), "PAIS_PERMITIDO", true);
  input.usuario.pais = "CHILE";
  checked(await evaluateAbac(input), "PAIS_PERMITIDO", false);
  input.entorno.ubicacion = "PERU";
  checked(await evaluateAbac(input), "PAIS_PERMITIDO", false);
  input.documento.pais = "CHILE";
  checked(await evaluateAbac(input), "PAIS_PERMITIDO", true);
  input.usuario.pais = "PERU";
  checked(await evaluateAbac(input), "PAIS_PERMITIDO", false);
  input.accion = "MODIFICAR_DOCUMENTO";
  assert.equal((await evaluateAbac(input)).evaluaciones.some(item => item.politica === "PAIS_PERMITIDO"), false);
});

test("dispositivo: nivel 5 exige CORPORATIVO en consulta", async () => {
  const input = context();
  input.usuario.nivelSeguridad = "NIVEL_5";
  input.documento.nivelConfidencialidad = "NIVEL_5";
  checked(await evaluateAbac(input), "DISPOSITIVO_CONFIABLE", true);
  input.entorno.dispositivo = "PERSONAL";
  checked(await evaluateAbac(input), "DISPOSITIVO_CONFIABLE", false);
  assert.equal((await evaluateAbac(input)).resultado, "ABAC_DENIED");
});

test("estado: ACTIVO permite; INACTIVO y SUSPENDIDO se deniegan", async () => {
  const input = context();
  checked(await evaluateAbac(input), "USUARIO_ACTIVO", true);
  for (const estado of ["INACTIVO", "SUSPENDIDO"] as const) {
    input.usuario.estado = estado;
    checked(await evaluateAbac(input), "USUARIO_ACTIVO", false);
  }
});

test("invitado: externo, público y nivel 1 permite; cada condición rota deniega", async () => {
  const input = context();
  input.usuario.rol = "INVITADO";
  input.usuario.tipoContrato = "EXTERNO";
  input.usuario.nivelSeguridad = "NIVEL_1";
  input.documento.nivelConfidencialidad = "NIVEL_1";
  checked(await evaluateAbac(input), "INVITADO_RESTRINGIDO", true);
  input.usuario.tipoContrato = "CONSULTOR";
  checked(await evaluateAbac(input), "INVITADO_RESTRINGIDO", false);
  input.usuario.tipoContrato = "EXTERNO";
  input.documento.nivelConfidencialidad = "NIVEL_2";
  checked(await evaluateAbac(input), "INVITADO_RESTRINGIDO", false);
  input.documento.nivelConfidencialidad = "NIVEL_1";
  input.documento.estado = "PENDIENTE";
  checked(await evaluateAbac(input), "INVITADO_RESTRINGIDO", false);
});

test("guía: empleado RRHH nivel 2 modifica Finanzas nivel 4 y fallan departamento y nivel", async () => {
  const input = context();
  input.usuario.rol = "EMPLEADO";
  input.usuario.departamentoId = "rrhh";
  input.usuario.nivelSeguridad = "NIVEL_2";
  input.documento.nivelConfidencialidad = "NIVEL_4";
  input.accion = "MODIFICAR_DOCUMENTO";
  const decision = await evaluateAbac(input);
  assert.equal(decision.resultado, "ABAC_DENIED");
  checked(decision, "MISMO_DEPARTAMENTO", false);
  checked(decision, "NIVEL_SEGURIDAD", false);
});

test("una política desactivada en PostgreSQL no se evalúa", async () => {
  const code = "PAIS_PERMITIDO";
  const original = await prisma.politica.findUniqueOrThrow({ where: { codigo: code }, select: { activa: true } });
  const input = context();
  input.usuario.pais = "CHILE";
  assert.equal((await evaluateAbac(input)).resultado, "ABAC_DENIED");
  try {
    await prisma.politica.update({ where: { codigo: code }, data: { activa: false } });
    const decision = await evaluateAbac(input);
    assert.equal(decision.evaluaciones.some(item => item.politica === code), false);
    assert.equal(decision.resultado, "ABAC_ALLOWED");
  } finally {
    await prisma.politica.update({ where: { codigo: code }, data: { activa: original.activa } });
  }
});

test("adaptador de servidor ignora headers de ubicación y dispositivo", async () => {
  const request = { ip: "192.0.2.7", headers: { "x-location": "PERU", "x-device": "CORPORATIVO" } };
  const environment = await serverEnvironmentAdapter.fromRequest(request as never);
  assert.equal(environment.direccionIp, "192.0.2.7");
  assert.ok(environment.fechaHora instanceof Date);
  assert.equal(environment.ubicacion, null);
  assert.equal(environment.dispositivo, null);
});

test("integración sobre documento cargado entrega 403 ABAC_DENIED", async () => {
  const input = context();
  input.usuario.rol = "EMPLEADO";
  input.usuario.departamentoId = "rrhh";
  const request = {
    auth: { user: {
      id: input.usuario.id, rol: { nombre: input.usuario.rol }, departamentoId: input.usuario.departamentoId,
      nivelSeguridad: input.usuario.nivelSeguridad, pais: input.usuario.pais,
      tipoContrato: input.usuario.tipoContrato,
      estado: input.usuario.estado
    } }
  } as unknown as AuthenticatedRequest;
  const authorize = createDocumentAuthorizer({ fromRequest: () => input.entorno });
  await assert.rejects(authorize(request, input.documento, input.accion), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
    assert.equal(error.code, "ABAC_DENIED");
    assert.equal(error.details?.politica, "MISMO_DEPARTAMENTO");
    return true;
  });
});

test("integración toma país del usuario autenticado y conserva ubicación en el entorno", async () => {
  const input = context();
  input.usuario.pais = "CHILE";
  input.entorno.ubicacion = "PERU";
  const request = {
    auth: { user: {
      id: input.usuario.id, rol: { nombre: input.usuario.rol }, departamentoId: input.usuario.departamentoId,
      nivelSeguridad: input.usuario.nivelSeguridad, pais: input.usuario.pais,
      tipoContrato: input.usuario.tipoContrato, estado: input.usuario.estado
    } }
  } as unknown as AuthenticatedRequest;
  const authorize = createDocumentAuthorizer({ fromRequest: () => input.entorno });
  await assert.rejects(authorize(request, input.documento, input.accion), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
    assert.equal(error.details?.politica, "PAIS_PERMITIDO");
    assert.equal(error.details?.valorEsperado, "PERU");
    assert.equal(error.details?.valorDetectado, "CHILE");
    return true;
  });
});
