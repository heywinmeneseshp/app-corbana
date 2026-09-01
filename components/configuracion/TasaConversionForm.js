"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// "Cajas de 20kg" es el nombre convencional de la unidad que usa Producción
// Semanal, pero el peso neto real de referencia es otro (ej. 18.16 kg) —
// configurable acá en vez de fijo en el código, para poder calcular cuántas
// "cajas de 20kg" equivalen a lo cargado en Programación de Corte (que
// viene en cajas del producto real, con su propio peso neto).
export default function TasaConversionForm() {
  const [peso, setPeso] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/configuraciones/tasa-conversion")
      .then((data) => setPeso(String(data.peso ?? "")))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      const data = await apiFetch("/configuraciones/tasa-conversion", {
        method: "PUT",
        body: JSON.stringify({ peso: Number(peso) }),
      });
      setPeso(String(data.peso));
      setOk("Tasa de conversión guardada correctamente.");
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
              <div className="col-12 col-md-5">
                <label className="form-label small fw-medium">Tasa de conversión — peso neto de referencia (kg)</label>
                <input
                  type="number"
                  required
                  min={0.01}
                  step="0.01"
                  className="form-control rounded-3"
                  placeholder="18.6"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                />
              </div>
            </div>
            <p className="form-text small mb-3">
              &quot;Cajas de 18kg&quot; es solo el nombre de la unidad — el peso neto real de referencia para
              convertir cajas de Programación de Corte a esta unidad es este valor, no 20. Fórmula: cajas 20kg =
              (cajas × peso neto del producto) ÷ este valor.
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
