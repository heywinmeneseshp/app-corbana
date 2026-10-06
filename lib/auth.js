// Híbrido: guarda usuario + tokens en localStorage como fallback, y el
// backend además setea httpOnly cookies. Así si el navegador bloquea la
// cookie (CORS/sameSite), el header Bearer sigue funcionando.

const USER_KEY = "corbana_user";
const PREVIEW_KEY = "corbana_preview_rol";
const IMPERSONATION_ORIGINAL_KEY = "corbana_impersonation_original";
// Contador monótono de inicios de sesión (nunca se limpia, ni siquiera en
// clearSession): cada login real lo sube en 1, así los modales descartables
// (ej. AreaLoteModal cerrado por el Admin) saben cuándo hubo un login nuevo
// y vuelven a mostrarse. A propósito NO se toca en saveSession: el refresh
// silencioso de tokens y la impersonación también pasan por ahí y no son
// un login nuevo.
const SESSION_SEQ_KEY = "corbana_session_seq";

export function marcarNuevaSesion() {
  if (typeof window === "undefined") return;
  const actual = Number(localStorage.getItem(SESSION_SEQ_KEY) || 0) || 0;
  localStorage.setItem(SESSION_SEQ_KEY, String(actual + 1));
}

export function getSesionSeq() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_SEQ_KEY);
}

export function saveSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem("corbana_access_token", accessToken);
  if (refreshToken) localStorage.setItem("corbana_refresh_token", refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PREVIEW_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_KEY);
  localStorage.removeItem("corbana_access_token");
  localStorage.removeItem("corbana_refresh_token");
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

// "Ver como rol": simulación solo de frontend — mientras esté activa,
// getPermissions() devuelve los permisos del rol elegido en vez de los del
// usuario real, así que el Sidebar y cada RequirePermission se recalculan
// como si fueran ese rol. Las llamadas a la API siguen yendo con el token
// real (no es una suplantación real), por eso es puramente para revisar
// qué ve/no ve cada rol en el menú y las pantallas.
export function startPreviewRol(rolNombre, permissions) {
  // No se puede mezclar con una suplantación real activa — salir de esa
  // primero (si no, quedaría ambiguo qué manda).
  if (isImpersonating()) stopImpersonation();
  localStorage.setItem(PREVIEW_KEY, JSON.stringify({ rolNombre, permissions }));
}

export function stopPreviewRol() {
  localStorage.removeItem(PREVIEW_KEY);
}

export function getPreviewRol() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY) || "null");
  } catch {
    return null;
  }
}

// "Ver como usuario": a diferencia de "Ver como rol" (simulación de
// frontend, arriba), esto es una SUPLANTACIÓN REAL — el backend
// (POST /users/:uuid/impersonate, solo Administrador) emite un token propio
// del usuario elegido, con sus permisos y fincaIds reales. La sesión activa
// pasa a ser esa (mismo `saveSession` que usa un login normal), así que
// selectores/listados/reportes quedan filtrados exactamente como los vería
// esa persona — no solo el menú. Guardamos la sesión ORIGINAL del admin
// para poder volver a ella al salir, sin tener que loguearse de nuevo.
export function startImpersonation({ accessToken, refreshToken, user }) {
  // Si ya se estaba suplantando a alguien y se suplanta a otra persona
  // desde ahí, NO pisar el backup — debe seguir apuntando a la sesión
  // original de verdad (el admin), no al usuario suplantado anterior.
  if (!isImpersonating()) {
    const original = {
      accessToken: localStorage.getItem("corbana_access_token"),
      refreshToken: localStorage.getItem("corbana_refresh_token"),
      user: getCurrentUser(),
    };
    localStorage.setItem(IMPERSONATION_ORIGINAL_KEY, JSON.stringify(original));
  }
  localStorage.removeItem(PREVIEW_KEY);
  saveSession({ accessToken, refreshToken, user });
}

export function stopImpersonation() {
  const original = getImpersonationOriginal();
  if (!original) return false;
  saveSession(original);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_KEY);
  return true;
}

export function isImpersonating() {
  return getImpersonationOriginal() !== null;
}

export function getImpersonationOriginal() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(IMPERSONATION_ORIGINAL_KEY) || "null");
  } catch {
    return null;
  }
}

export function getPermissions() {
  const previewRol = getPreviewRol();
  if (previewRol) return previewRol.permissions;
  return getCurrentUser()?.permissions || [];
}

// TEMPORAL: por ahora Inventarios solo restringe qué SECCIONES/SUBMENÚS se
// ven (códigos "menu.inventarios.*", chequeados de verdad más abajo) — los
// permisos granulares de acción dentro de cada pantalla ("inventario.ver/
// crear/editar/eliminar...") siguen sin restricción mientras se define
// dónde ponerlas. Quitar este bypass en cuanto pida esas restricciones.
const esPermisoAccionInventario = (code) => code.startsWith("inventario.");

export function hasPermission(code) {
  if (esPermisoAccionInventario(code)) return true;
  return getPermissions().includes(code);
}

export function hasAnyPermission(codes) {
  if (codes.some(esPermisoAccionInventario)) return true;
  const mine = getPermissions();
  return codes.some((code) => mine.includes(code));
}
