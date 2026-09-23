import { createApp } from "./app";
import { prisma } from "./lib/prisma";

const port = Number(process.env.API_PORT ?? 3000);

const app = createApp(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

const server = app.listen(port, () => {
  console.log(`SecureDocs API escuchando en http://localhost:${port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Señal ${signal} recibida; cerrando la API.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
