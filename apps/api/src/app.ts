import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { login, logout, me } from "./auth";
import { createUser, listUsers, updateUser } from "./users";
import { errorHandler } from "./lib/errors";
import { myPermissions } from "./authorization/rbac";
import { auditedRoute } from "./audit";
import { approveDocument, createDocument, deleteDocument, getDocument, listAudit, listDocuments, updateDocument } from "./documents";

export type DatabaseCheck = () => Promise<void>;

export function getHealthHandler(checkDatabase: DatabaseCheck) {
  return async (_request: Request, response: Response): Promise<void> => {
    try {
      await checkDatabase();
      response.status(200).json({
        status: "ok",
        service: "securedocs-api",
        database: "connected",
        timestamp: new Date().toISOString()
      });
    } catch {
      response.status(503).json({
        status: "degraded",
        service: "securedocs-api",
        database: "unavailable",
        timestamp: new Date().toISOString()
      });
    }
  };
}

export function createApp(checkDatabase: DatabaseCheck): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json());

  app.get("/health", getHealthHandler(checkDatabase));
  app.post("/auth/login", auditedRoute({ accion: "INICIAR_SESION", recurso: () => "auth/login", successReason: "AUTH: credenciales válidas" }, login));
  app.get("/auth/me", auditedRoute({ accion: "CONSULTAR_SESION", recurso: () => "auth/me", auth: true, successReason: "AUTH: válida" }, me));
  app.get("/auth/permissions", auditedRoute({ accion: "CONSULTAR_PERMISOS", recurso: () => "auth/permissions", auth: true, successReason: "AUTH: válida; RBAC: permisos consultados" }, myPermissions));
  app.post("/auth/logout", auditedRoute({ accion: "CERRAR_SESION", recurso: () => "auth/logout", auth: true, successReason: "AUTH: sesión revocada" }, logout));
  app.get("/usuarios", auditedRoute({ accion: "CONSULTAR_USUARIOS", recurso: () => "usuarios", auth: true, permissions: ["GESTIONAR_USUARIOS"], successReason: "AUTH: válida; RBAC: permiso concedido" }, listUsers));
  app.post("/usuarios", auditedRoute({ accion: "CREAR_USUARIO", recurso: () => "usuarios", auth: true, permissions: ["GESTIONAR_USUARIOS", "ASIGNAR_ROLES"], successReason: "AUTH: válida; RBAC: permisos concedidos" }, createUser));
  app.put("/usuarios/:id", auditedRoute({ accion: "MODIFICAR_USUARIO", recurso: request => `usuarios/${request.params.id}`, auth: true,
    permissions: request => request.body && typeof request.body === "object" && "rol" in request.body
      ? ["GESTIONAR_USUARIOS", "ASIGNAR_ROLES"] : ["GESTIONAR_USUARIOS"],
    successReason: "AUTH: válida; RBAC: permisos concedidos" }, updateUser));
  app.get("/documentos", listDocuments);
  app.get("/documentos/:id", getDocument);
  app.post("/documentos", createDocument);
  app.put("/documentos/:id", updateDocument);
  app.delete("/documentos/:id", deleteDocument);
  app.post("/documentos/:id/aprobar", approveDocument);
  app.get("/auditoria", listAudit);
  app.use(errorHandler);

  return app;
}
