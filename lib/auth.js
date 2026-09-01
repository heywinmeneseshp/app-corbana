// Híbrido: guarda usuario + tokens en localStorage como fallback, y el
// backend además setea httpOnly cookies. Así si el navegador bloquea la
// cookie (CORS/sameSite), el header Bearer sigue funcionando.

const USER_KEY = "corbana_user";

export function saveSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem("corbana_access_token", accessToken);
  if (refreshToken) localStorage.setItem("corbana_refresh_token", refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PREVIEW_KEY);
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

const PREVIEW_KEY = "corbana_preview_rol";

// "Ver como rol": simulación solo de frontend — mientras esté activa,
// getPermissions() devuelve los permisos del rol elegido en vez de los del
// usuario real, así que el Sidebar y cada RequirePermission se recalculan
// como si fueran ese rol. Las llamadas a la API siguen yendo con el token
// real (no es una suplantación real), por eso es puramente para revisar
// qué ve/no ve cada rol en el menú y las pantallas.
export function startPreviewRol(rolNombre, permissions) {
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

export function getPermissions() {
  const preview = getPreviewRol();
  if (preview) return preview.permissions;
  return getCurrentUser()?.permissions || [];
}

// TEMPORAL: el módulo de Inventarios todavía no tiene restricciones de rol
// definidas — el usuario decidirá más adelante dónde ponerlas. Mientras
// tanto, cualquier código de permiso de Inventarios pasa siempre (tanto
// RequirePermission de página como los hasPermission(...) de cada botón).
// Quitar este bypass en cuanto pida las restricciones reales.
const esPermisoInventario = (code) => code.startsWith("menu.inventarios") || code.startsWith("inventario.");

export function hasPermission(code) {
  if (esPermisoInventario(code)) return true;
  return getPermissions().includes(code);
}

export function hasAnyPermission(codes) {
  if (codes.some(esPermisoInventario)) return true;
  const mine = getPermissions();
  return codes.some((code) => mine.includes(code));
}
