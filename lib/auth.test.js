import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, getCurrentUser, clearSession, hasPermission, marcarNuevaSesion, getSesionSeq } from "./auth.js";

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

  it("marcarNuevaSesion sube un contador monotono que sobrevive al logout", () => {
    expect(getSesionSeq()).toBeNull();
    marcarNuevaSesion();
    expect(getSesionSeq()).toBe("1");
    marcarNuevaSesion();
    expect(getSesionSeq()).toBe("2");
    // El logout NO lo reinicia: el próximo login genera una secuencia nueva.
    clearSession();
    expect(getSesionSeq()).toBe("2");
    marcarNuevaSesion();
    expect(getSesionSeq()).toBe("3");
  });

  it("saveSession no toca la secuencia (refresh silencioso no es un login)", () => {
    marcarNuevaSesion();
    saveSession({ accessToken: "nuevo-token", user: { id: 1 } });
    expect(getSesionSeq()).toBe("1");
  });
});
