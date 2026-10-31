import { afterEach, describe, expect, it, vi } from "vitest";
import { authConfigurada, exigirCredenciales } from "@/lib/auth";

// Este test existe por un bug real: `exigirCredenciales()` se llamaba al tope de src/start.ts,
// que TanStack Start evalúa TAMBIÉN en el navegador. Ahí no hay process.env, así que lanzaba
// durante la hidratación y la app quedaba sin un solo controlador de eventos: los botones
// dejaban de responder sin ningún error visible en la página.
describe("el arranque no puede romper la hidratación", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("src/start.ts se importa en el navegador sin lanzar, aunque falten las credenciales", async () => {
    // El entorno de los tests es jsdom: window existe e import.meta.env.SSR es false,
    // igual que en el navegador.
    expect(typeof window).not.toBe("undefined");
    expect(import.meta.env.SSR).toBe(false);
    vi.stubEnv("HUB_USUARIO", "");
    vi.stubEnv("HUB_CLAVE", "");
    expect(authConfigurada()).toBe(false);
    await expect(import("@/start")).resolves.toBeDefined();
  });

  it("pero la guarda sigue lanzando cuando se la llama en el servidor", () => {
    vi.stubEnv("HUB_USUARIO", "");
    vi.stubEnv("HUB_CLAVE", "");
    expect(() => exigirCredenciales()).toThrow(/HUB_USUARIO/);
    vi.stubEnv("HUB_USUARIO", "alguien");
    vi.stubEnv("HUB_CLAVE", "algo");
    expect(() => exigirCredenciales()).not.toThrow();
  });
});
