import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { aFiltrosCartera, validarFiltrosUrl } from "@/lib/filtros-url";
import { navReportes, navSoluciones } from "@/lib/navegacion";

// Se resuelven las rutas sin correr loaders ni renderizar: los loaders necesitan servidor y
// jsdom nunca carga las hojas de estilo que React espera.
describe("rutas de la app", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  const rutas = [
    "/",
    "/cartera",
    "/socios",
    "/proyectos",
    "/mercado",
    "/chat",
    "/chat/abc123",
    "/presentacion",
    "/soluciones/cartera-salud",
    "/soluciones/adjudicaciones",
    "/soluciones/obra",
    "/soluciones/terrenos",
    "/soluciones/simulador",
  ];

  for (const ruta of rutas)
    it(`encuentra una página para ${ruta}`, () => {
      const matches = router.matchRoutes(ruta);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    });

  it("toda la navegación apunta a rutas que existen", () => {
    for (const { to } of [...navReportes, ...navSoluciones]) {
      const matches = router.matchRoutes(to);
      expect(matches.at(-1)?.routeId, to).not.toBe(rootRouteId);
    }
  });

  it("valida los filtros de la URL y descarta valores inventados", () => {
    expect(
      validarFiltrosUrl({ p: "u12", plan: "Amplia", suc: "Villa Morra", barrio: "Recoleta" }),
    ).toEqual({ p: "u12", plan: "Amplia", suc: "Villa Morra", barrio: "Recoleta" });
    expect(validarFiltrosUrl({ p: "1999", plan: "Oro", suc: "Marte", barrio: "Narnia" })).toEqual(
      {},
    );
    expect(aFiltrosCartera({ p: "a2025" })).toMatchObject({ desde: "2025-01", hasta: "2025-12" });
    expect(aFiltrosCartera({})).toMatchObject({ desde: "2026-01", hasta: "2026-09" });
  });
});
