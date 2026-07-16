// Maneja la sesión guardada en localStorage: tokens + datos del usuario
// (incluyendo sus permisos, que vienen ya calculados desde el login).

const USER_KEY = "corbana_user";

export function saveSession({ accessToken, refreshToken, user }) {
  localStorage.setItem("corbana_access_token", accessToken);
  localStorage.setItem("corbana_refresh_token", refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("corbana_access_token");
  localStorage.removeItem("corbana_refresh_token");
  localStorage.removeItem(USER_KEY);
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function getPermissions() {
  return getCurrentUser()?.permissions || [];
}

export function hasPermission(code) {
  return getPermissions().includes(code);
}

export function hasAnyPermission(codes) {
  const mine = getPermissions();
  return codes.some((code) => mine.includes(code));
}
