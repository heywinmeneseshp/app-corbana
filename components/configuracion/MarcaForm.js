"use client";

import { useEffect, useRef, useState } from "react";
import { FiSave, FiCheck, FiTrash2, FiUpload } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { obtenerMarca, refrescarMarca, MARCA_DEFAULT } from "@/lib/marca";
import CorbanaLogo from "@/components/CorbanaLogo";

const LADO_MAX = 256; // px — suficiente para el sidebar/PDF, mantiene el data URL liviano

// Redimensiona la imagen elegida a un cuadrado (contain, fondo transparente)
// para que el logo se vea bien en cualquier tamaño donde se use, y para no
// guardar archivos innecesariamente pesados en la base de datos.
function redimensionar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = LADO_MAX;
        canvas.height = LADO_MAX;
        const ctx = canvas.getContext("2d");
        const escala = Math.min(LADO_MAX / img.width, LADO_MAX / img.height);
        const w = img.width * escala;
        const h = img.height * escala;
        ctx.drawImage(img, (LADO_MAX - w) / 2, (LADO_MAX - h) / 2, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export default function MarcaForm() {
  const [nombreApp, setNombreApp] = useState(MARCA_DEFAULT.nombreApp);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    obtenerMarca()
      .then((marca) => {
        setNombreApp(marca.nombreApp);
        setLogoUrl(marca.logoUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const dataUrl = await redimensionar(file);
      setLogoUrl(dataUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await apiFetch("/configuraciones/marca", {
        method: "PUT",
        body: JSON.stringify({ nombreApp, logoUrl }),
      });
      await refrescarMarca();
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
            <div className="mb-3">
              <label className="form-label small fw-medium">Nombre de la app</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                className="form-control rounded-3"
                value={nombreApp}
                onChange={(e) => setNombreApp(e.target.value)}
              />
              <p className="form-text small">Aparece en el menú lateral, el login y el resto de la aplicación.</p>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium d-block">Logo</label>
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center rounded-3 border"
                  style={{ width: 64, height: 64, backgroundColor: "var(--brand-900, #14532d)" }}
                >
                  <AppLogoPreview logoUrl={logoUrl} />
                </div>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FiUpload /> Subir imagen
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-3 d-flex align-items-center gap-1"
                        onClick={() => setLogoUrl(null)}
                      >
                        <FiTrash2 /> Quitar
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="d-none"
                    onChange={handleArchivo}
                  />
                  <p className="form-text small mb-0">PNG, JPG o WEBP. Se ajusta automáticamente a un ícono cuadrado.</p>
                </div>
              </div>
            </div>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            <div className="d-flex gap-2 align-items-center">
              <button type="submit" disabled={saving} className="btn btn-brand rounded-3 d-flex align-items-center gap-1">
                <FiSave /> {saving ? "Guardando..." : "Guardar"}
              </button>
              {saved && (
                <span className="small text-success d-flex align-items-center gap-1">
                  <FiCheck /> Guardado.
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Previsualiza exactamente el logo que se está por guardar (todavía no
// confirmado), independiente del que ya está activo en el resto de la app.
function AppLogoPreview({ logoUrl }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="Logo" width={40} height={40} style={{ objectFit: "contain" }} />
    );
  }
  return <CorbanaLogo size={28} color="#fff" />;
}
