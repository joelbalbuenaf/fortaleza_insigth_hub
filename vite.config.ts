import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { existsSync } from "node:fs";

// Variables de servidor del .env local (ANTHROPIC_API_KEY, HUB_USUARIO…); en Render vienen del panel.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig(({ command, mode }) => {
  // Expone las variables VITE_* al cliente igual que antes.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
  );

  return {
    define,
    css: { transformer: "lightningcss" },
    resolve: {
      tsconfigPaths: true,
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: { port: 8080 },
    plugins: [
      tailwindcss(),
      tanstackStart({
        // Entrada SSR propia (src/server.ts) con manejo de errores.
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Nitro solo empaqueta el servidor en build; preset node-server (VPS/Docker) salvo NITRO_PRESET.
      ...(command === "build"
        ? [nitro({ preset: process.env["NITRO_PRESET"] ?? "node-server" })]
        : []),
      viteReact(),
    ],
  };
});
