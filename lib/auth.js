// Sesión web httpOnly: tokens van en cookies (no accesibles por JS), solo
// datos del usuario quedan en localStorage para UI/permisos.

const USER_KEY = "corbana_user";

export function saveSession({ user }) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Compat: si el backend aún devuelve tokens en el body (móvil), los ignora
export function saveSessionTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem("corbana_access_token", accessToken);
  if (refreshToken) localStorage.setItem("corbana_refresh_token", refreshToken);
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PREVIEW_KEY);
  // Limpia restos de sesión vieja por si existían
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

export function hasPermission(code) {
  return getPermissions().includes(code);
}

export function hasAnyPermission(codes) {
  const mine = getPermissions();
  return codes.some((code) => mine.includes(code));
}
