import { describe, it, expect } from "vitest";
import { isReservedSlug } from "./reserved";
describe("slugs reservados", () => {
  it("bloquea rutas de la app", () => { for (const s of ["app", "login", "onboarding", "api", "_next", "b", "Login"]) expect(isReservedSlug(s)).toBe(true); });
  it("permite barberías", () => { for (const s of ["house-davidson", "demo"]) expect(isReservedSlug(s)).toBe(false); });
});
