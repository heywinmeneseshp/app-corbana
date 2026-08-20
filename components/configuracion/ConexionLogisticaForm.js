"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// Enlace + API key del API de Logística (Banarica) — compartido entre
// Fincas (sincroniza almacenes) y Programación de Corte (sincroniza lo
// cargado allá). Vive en Configuración porque es un dato de la instalación,
// no de un módulo puntual. La API key es la misma que exige
// api-rest-banarica vía el header `api` para integraciones
// servidor-a-servidor (checkApiKeyOrJwt) — no un usuario/contraseña.
export default function ConexionLogisticaForm() {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/configuraciones/logistica")
      .then((data) => {
        setUrl(data.url || "");
        setHasApiKey(Boolean(data.hasApiKey));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      const data = await apiFetch("/configuraciones/logistica", {
        method: "PUT",
        body: JSON.stringify({ url, apiKey: apiKey || undefined }),
      });
      setHasApiKey(Boolean(data.hasApiKey));
      setApiKey("");
      setOk("Conexión guardada correctamente.");
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
            <div className="row g-3 mb-2">
              <div className="col-12 col-md-7">
                <label className="form-label small fw-medium">Enlace del API de Logística</label>
                <input
                  type="url"
                  required
                  className="form-control rounded-3"
                  placeholder="https://api-logistica-banarica.vercel.app"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-5">
                <label className="form-label small fw-medium">API Key</label>
                <input
                  type="password"
                  className="form-control rounded-3"
                  placeholder={hasApiKey ? "•••••••• (dejar en blanco para no cambiarla)" : ""}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </div>
            <p className="form-text small mb-3">
              Se usará para consultar <code>/api/v1/almacenes/</code> y <code>/api/v1/programacion-corte</code> — la
              API key es la misma que Logística configura en su variable <code>API_KEY</code> (header <code>api</code>).
            </p>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            {ok && <div className="alert alert-success py-2 small">{ok}</div>}

            <button type="submit" disabled={saving} className="btn btn-brand rounded-3 d-flex align-items-center gap-1">
              <FiSave /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
