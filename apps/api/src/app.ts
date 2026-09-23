import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { authenticate, login, logout, me } from "./auth";
import { createUser, listUsers, updateUser } from "./users";
import { errorHandler } from "./lib/errors";
import { myPermissions, requireAllPermissions, requirePermission } from "./authorization/rbac";

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
  app.post("/auth/login", login);
  app.get("/auth/me", authenticate, me);
  app.get("/auth/permissions", authenticate, myPermissions);
  app.post("/auth/logout", authenticate, logout);
  app.get("/usuarios", authenticate, requirePermission("GESTIONAR_USUARIOS"), listUsers);
  app.post("/usuarios", authenticate, requireAllPermissions(["GESTIONAR_USUARIOS", "ASIGNAR_ROLES"]), createUser);
  app.put("/usuarios/:id", authenticate, requireAllPermissions(request =>
    request.body && typeof request.body === "object" && "rol" in request.body
      ? ["GESTIONAR_USUARIOS", "ASIGNAR_ROLES"]
      : ["GESTIONAR_USUARIOS"]
  ), updateUser);
  app.use(errorHandler);

  return app;
}
