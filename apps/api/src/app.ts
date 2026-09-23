import express, { type Express, type Request, type Response } from "express";

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
  app.use(express.json());

  app.get("/health", getHealthHandler(checkDatabase));

  return app;
}
