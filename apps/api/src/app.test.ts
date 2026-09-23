import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { getHealthHandler } from "./app";

test("GET /health informa que la API y PostgreSQL están disponibles", async () => {
  let statusCode = 0;
  let body: Record<string, unknown> = {};
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      body = payload;
      return this;
    }
  } as unknown as Response;

  await getHealthHandler(async () => undefined)({} as Request, response);

  assert.equal(statusCode, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.database, "connected");
});
