"use client";

import { useEffect, useState } from "react";
import { FiSave, FiUser, FiMail, FiLock, FiCheck } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, saveSession } from "@/lib/auth";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    const cached = getCurrentUser();
    if (cached) {
      setUser(cached);
      setNombre(cached.nombre || "");
      setApellido(cached.apellido || "");
      setEmail(cached.email || "");
    }
    apiFetch("/auth/me")
      .then((userData) => {
        setUser(userData);
        setNombre(userData.nombre || "");
        setApellido(userData.apellido || "");
        setEmail(userData.email || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const userData = await apiFetch("/auth/me", {
        method: "PUT",
        body: JSON.stringify({ nombre, apellido, email }),
      });
      // PUT /auth/me no devuelve permissions/roles/fincaIds (solo los datos
      // de perfil editados) — si se guardara tal cual, la sesión perdería
      // esos campos hasta el próximo login. Se combinan con lo que ya
      // estaba en caché para no pisarlos.
      const cached = getCurrentUser();
      const mergedUser = { ...cached, ...userData };
      setUser(mergedUser);
      const accessToken = localStorage.getItem("corbana_access_token");
      const refreshToken = localStorage.getItem("corbana_refresh_token");
      saveSession({ accessToken, refreshToken, user: mergedUser });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setPasswordSaved(false);
    setChangingPassword(true);
    try {
      await apiFetch("/auth/me/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 p-md-5">
        <p className="text-secondary">Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="p-4 p-md-5" style={{ maxWidth: 640 }}>
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Mi Perfil</h1>
        <p className="text-secondary mb-0">@<strong>{user?.usuario}</strong></p>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">
          <h5 className="fw-semibold mb-3 d-flex align-items-center gap-2">
            <FiUser size={18} /> Información personal
          </h5>
          <form onSubmit={handleSaveProfile}>
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small fw-medium">Nombre</label>
                <input
                  type="text"
                  required
                  className="form-control rounded-3"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium">Apellido</label>
                <input
                  type="text"
                  required
                  className="form-control rounded-3"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label small fw-medium d-flex align-items-center gap-1">
                <FiMail size={14} /> Email
              </label>
              <input
                type="email"
                required
                className="form-control rounded-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="d-flex gap-2">
              <button type="submit" disabled={saving} className="btn btn-brand rounded-3 d-flex align-items-center gap-1">
                <FiSave /> {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              {saved && (
                <span className="small text-success d-flex align-items-center gap-1">
                  <FiCheck /> Guardado
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <h5 className="fw-semibold mb-3 d-flex align-items-center gap-2">
            <FiLock size={18} /> Cambiar contraseña
          </h5>
          <form onSubmit={handleChangePassword}>
            <div className="mb-3">
              <label className="form-label small fw-medium">Contraseña actual</label>
              <input
                type="password"
                required
                className="form-control rounded-3"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-medium">Nueva contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                className="form-control rounded-3"
                placeholder="Mínimo 8 caracteres, letras y números"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-medium">Repetir nueva contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                className={`form-control rounded-3 ${confirmPassword && newPassword !== confirmPassword ? "is-invalid" : ""}`}
                placeholder="Repite la contraseña nueva"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <div className="invalid-feedback d-block">Las contraseñas no coinciden</div>
              )}
            </div>
            <div className="d-flex gap-2">
              <button type="submit" disabled={changingPassword} className="btn btn-brand rounded-3 d-flex align-items-center gap-1">
                <FiLock /> {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
              </button>
              {passwordSaved && (
                <span className="small text-success d-flex align-items-center gap-1">
                  <FiCheck /> Contraseña actualizada
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
