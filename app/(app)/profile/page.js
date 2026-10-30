"use client";

import { useEffect, useRef, useState } from "react";
import { FiSave, FiUser, FiMail, FiLock, FiCheck, FiEdit3, FiUpload, FiTrash2 } from "react-icons/fi";
import { apiFetch, apiFetchBlob, apiFetchFormData } from "@/lib/api";
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

  // Firma (PNG) para los documentos: se guarda en Google Drive; aquí solo la vista previa.
  const [firmaUrl, setFirmaUrl] = useState(null);
  const [subiendoFirma, setSubiendoFirma] = useState(false);
  const [firmaMensaje, setFirmaMensaje] = useState("");
  const inputFirmaRef = useRef(null);

  async function cargarVistaFirma() {
    try {
      const blob = await apiFetchBlob("/auth/me/firma");
      setFirmaUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      setFirmaUrl(null);
    }
  }

  // Actualiza la sesión guardada (tieneFirma) sin perder permisos ni roles.
  function guardarEnSesion(userData) {
    const merged = { ...getCurrentUser(), ...userData };
    setUser(merged);
    saveSession({ accessToken: localStorage.getItem("corbana_access_token"), refreshToken: localStorage.getItem("corbana_refresh_token"), user: merged });
  }

  async function handleSubirFirma(file) {
    setFirmaMensaje("");
    setError("");
    if (!file) return;
    if (file.type !== "image/png") return setError("La firma debe ser una imagen PNG (idealmente con fondo transparente).");
    if (file.size > 1024 * 1024) return setError("La imagen de la firma no puede pesar más de 1 MB.");
    setSubiendoFirma(true);
    try {
      const fd = new FormData();
      fd.append("firma", file, file.name);
      const userData = await apiFetchFormData("/auth/me/firma", fd, { method: "PUT" });
      guardarEnSesion(userData);
      await cargarVistaFirma();
      setFirmaMensaje("Firma guardada");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendoFirma(false);
      if (inputFirmaRef.current) inputFirmaRef.current.value = "";
    }
  }

  async function handleQuitarFirma() {
    if (!confirm("¿Quitar tu firma? Los documentos dejarán de llevarla.")) return;
    setFirmaMensaje("");
    setSubiendoFirma(true);
    try {
      const userData = await apiFetch("/auth/me/firma", { method: "DELETE" });
      guardarEnSesion(userData);
      setFirmaUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendoFirma(false);
    }
  }

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
        if (userData.tieneFirma) cargarVistaFirma();
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
              <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1">
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

      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">
          <h5 className="fw-semibold mb-1 d-flex align-items-center gap-2">
            <FiEdit3 size={18} /> Mi firma
          </h5>
          <p className="small text-secondary mb-3">
            Sube una imagen <strong>PNG</strong> de tu firma (idealmente con fondo transparente, máximo 1 MB). Se usa para firmar los documentos y se guarda en la carpeta de Google Drive de Corbana.
          </p>
          <div
            className="border rounded-3 d-flex align-items-center justify-content-center mb-3"
            style={{ height: 120, backgroundColor: "#f8fafc", backgroundImage: "repeating-conic-gradient(#f1f5f9 0% 25%, transparent 0% 50%)", backgroundSize: "16px 16px" }}
          >
            {firmaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firmaUrl} alt="Mi firma" style={{ maxHeight: 104, maxWidth: "90%", objectFit: "contain" }} />
            ) : (
              <span className="small text-secondary">{user?.tieneFirma ? "Cargando firma..." : "Todavía no has subido tu firma"}</span>
            )}
          </div>
          <input ref={inputFirmaRef} type="file" accept="image/png" className="d-none" onChange={(e) => handleSubirFirma(e.target.files?.[0])} />
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button type="button" disabled={subiendoFirma} className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1" onClick={() => inputFirmaRef.current?.click()}>
              <FiUpload /> {subiendoFirma ? "Guardando..." : user?.tieneFirma ? "Cambiar firma" : "Subir firma"}
            </button>
            {user?.tieneFirma && (
              <button type="button" disabled={subiendoFirma} className="btn btn-link btn-sm text-danger text-decoration-none d-flex align-items-center gap-1" onClick={handleQuitarFirma}>
                <FiTrash2 /> Quitar
              </button>
            )}
            {firmaMensaje && (
              <span className="small text-success d-flex align-items-center gap-1">
                <FiCheck /> {firmaMensaje}
              </span>
            )}
            {user?.firmaActualizadaEn && (
              <span className="small text-secondary ms-auto">Actualizada el {new Date(user.firmaActualizadaEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</span>
            )}
          </div>
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
              <button type="submit" disabled={changingPassword} className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1">
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
