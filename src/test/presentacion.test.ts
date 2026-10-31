import { describe, expect, it } from "vitest";
import { normalizeSlide, presentationSlides } from "@/lib/presentation-data";

describe("presentación", () => {
  it("la navegación se queda dentro del deck", () => {
    expect(normalizeSlide(0)).toBe(1);
    expect(normalizeSlide(99)).toBe(presentationSlides.length);
    expect(normalizeSlide("3")).toBe(3);
    expect(normalizeSlide("invalida")).toBe(1);
  });

  it("cada diapositiva tiene título, capítulo y notas del presentador", () => {
    expect(presentationSlides).toHaveLength(6);
    for (const s of presentationSlides) {
      expect(s.title.length).toBeGreaterThan(10);
      expect(s.chapter.length).toBeGreaterThan(3);
      // Las notas son para quien presenta: ahí va lo que no se puede afirmar.
      expect(s.notes.length).toBeGreaterThan(80);
    }
  });
});
