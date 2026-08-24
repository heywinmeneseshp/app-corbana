import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, getCurrentUser, clearSession, hasPermission } from "./auth.js";

describe("auth lib (httpOnly)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("guarda y lee usuario", () => {
    const user = { id: 1, usuario: "test", permissions: ["finca.ver"] };
    saveSession({ user });
    expect(getCurrentUser()).toEqual(user);
  });

  it("clearSession limpia usuario", () => {
    saveSession({ user: { id: 1 } });
    clearSession();
    expect(getCurrentUser()).toBeNull();
  });

  it("hasPermission funciona con preview desactivo", () => {
    saveSession({ user: { permissions: ["a", "b"] } });
    expect(hasPermission("a")).toBe(true);
    expect(hasPermission("c")).toBe(false);
  });
});
