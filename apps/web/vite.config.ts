import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function frontendRootEnv(): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(new URL("../../.env", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter(line => /^VITE_[A-Z0-9_]+=/.test(line))
      .map(line => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }));
  } catch {
    return {};
  }
}

export default defineConfig(() => {
  const rootEnv = frontendRootEnv();
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(process.env.VITE_API_URL ?? rootEnv.VITE_API_URL ?? "http://localhost:3000"),
      "import.meta.env.VITE_DEMO_MODE": JSON.stringify(process.env.VITE_DEMO_MODE ?? rootEnv.VITE_DEMO_MODE ?? "false")
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true }
  };
});
