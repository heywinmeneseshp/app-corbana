"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// pH y Conductividad Eléctrica (CE) son los dos parámetros que deciden si
// una prueba de mezcla queda ÓPTIMA/VÁLIDA o NO VÁLIDA. Nunca hardcodeados
// en el backend (ver evaluarResultado en mezcla.service.js) — este
// formulario es la única forma de cambiarlos, y solo el Administrador
// puede hacerlo. Las pruebas ya finalizadas guardan una copia de los
// parámetros vigentes al momento de aprobarse, así que cambiar esto acá
// nunca altera resultados históricos.
export default function MezclaParametrosForm() {
  const [phMinimo, setPhMinimo] = useState("");
  const [phMaximo, setPhMaximo] = useState("");
  const [ceMaxima, setCeMaxima] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/inventarios/mezclas/parametros")
      .then((data) => {
        setPhMinimo(String(data.phMinimo ?? ""));
        setPhMaximo(String(data.phMaximo ?? ""));
        setCeMaxima(String(data.ceMaxima ?? ""));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");

    if (Number(phMinimo) > Number(phMaximo)) {
      setError("El pH mínimo no puede ser mayor que el pH máximo.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiFetch("/inventarios/mezclas/parametros", {
        method: "PUT",
        body: JSON.stringify({
          phMinimo: Number(phMinimo),
          phMaximo: Number(phMaximo),
          ceMaxima: Number(ceMaxima),
        }),
      });
      setPhMinimo(String(data.phMinimo));
      setPhMaximo(String(data.phMaximo));
      setCeMaxima(String(data.ceMaxima));
      setOk("Parámetros guardados correctamente.");
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
              <div className="col-12 col-md-4">
                <label className="form-label small fw-medium">pH mínimo</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={14}
                  step="0.01"
                  className="form-control rounded-3"
                  value={phMinimo}
                  onChange={(e) => setPhMinimo(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-medium">pH máximo</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={14}
                  step="0.01"
                  className="form-control rounded-3"
                  value={phMaximo}
                  onChange={(e) => setPhMaximo(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-medium">CE máxima</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  className="form-control rounded-3"
                  value={ceMaxima}
                  onChange={(e) => setCeMaxima(e.target.value)}
                />
              </div>
            </div>
            <p className="form-text small mb-3">
              Una prueba de mezcla queda <strong>ÓPTIMA</strong> cuando el pH final está entre el mínimo y el máximo
              (inclusive) <strong>y</strong> la CE final es <strong>menor</strong> que el máximo configurado. Cambiar
              estos valores no afecta pruebas ya finalizadas — cada una guarda los parámetros que estaban vigentes
              cuando se aprobó.
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
