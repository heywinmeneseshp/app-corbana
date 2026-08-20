"use client";

import { useEffect, useState } from "react";
import { FiSave, FiCheck } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// Como la app móvil no está en Play Store, esto controla el aviso de
// actualización que ven los usuarios al abrirla — antes vivía en Maestros →
// Versión App Móvil, movido acá porque es una configuración de la
// instalación, no un maestro de datos.
export default function VersionAppForm() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [latestVersion, setLatestVersion] = useState("");
  const [minSupportedVersion, setMinSupportedVersion] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  useEffect(() => {
    apiFetch("/configuraciones/app-version")
      .then((data) => {
        setLatestVersion(data.latestVersion || "");
        setMinSupportedVersion(data.minSupportedVersion || "");
        setDownloadUrl(data.downloadUrl || "");
        setReleaseNotes(data.releaseNotes || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await apiFetch("/configuraciones/app-version", {
        method: "PUT",
        body: JSON.stringify({ latestVersion, minSupportedVersion, downloadUrl, releaseNotes }),
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        {loading ? (
          <p className="text-secondary">Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small fw-medium">Última versión (x.y.z)</label>
                <input
                  type="text"
                  required
                  pattern="\d+\.\d+\.\d+"
                  className="form-control rounded-3"
                  placeholder="1.2.0"
                  value={latestVersion}
                  onChange={(e) => setLatestVersion(e.target.value)}
                />
                <p className="form-text small">La versión del APK más reciente que publicaste.</p>
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium">Versión mínima soportada (x.y.z)</label>
                <input
                  type="text"
                  required
                  pattern="\d+\.\d+\.\d+"
                  className="form-control rounded-3"
                  placeholder="1.0.0"
                  value={minSupportedVersion}
                  onChange={(e) => setMinSupportedVersion(e.target.value)}
                />
                <p className="form-text small">Por debajo de esta, la app bloquea el uso hasta actualizar.</p>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Enlace de descarga del APK</label>
              <input
                type="url"
                className="form-control rounded-3"
                placeholder="https://..."
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Notas de la versión (opcional)</label>
              <textarea
                className="form-control rounded-3"
                rows={3}
                placeholder="Qué cambió en esta versión..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
              />
            </div>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            <div className="d-flex gap-2 align-items-center">
              <button type="submit" disabled={saving} className="btn btn-brand rounded-3 d-flex align-items-center gap-1">
                <FiSave /> {saving ? "Guardando..." : "Guardar"}
              </button>
              {saved && (
                <span className="small text-success d-flex align-items-center gap-1">
                  <FiCheck /> Guardado — los usuarios verán el aviso al abrir la app.
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
