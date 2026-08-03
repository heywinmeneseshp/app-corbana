"use client";

import { useEffect, useState } from "react";
import { FiCloudRain, FiAlertTriangle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// Modal bloqueante: si el usuario tiene un rol programado para capturar la
// precipitación diaria de alguna finca (ver Maestros > Precipitación Diaria)
// y quedó atrasado, no puede usar el resto del sistema hasta ponerse al día
// — sin botón de cerrar, sin click-fuera-para-cerrar.
export default function PrecipitacionDiariaModal() {
  const [pendientes, setPendientes] = useState(null); // null = todavía no se sabe
  const [valores, setValores] = useState({}); // `${fincaUuid}|${fecha}` -> string
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cargar = () => {
    apiFetch("/precipitacion-diaria/pendientes")
      .then((data) => setPendientes(data))
      .catch(() => setPendientes([])); // si falla el chequeo, no bloqueamos al usuario por eso
  };

  useEffect(cargar, []);

  if (!pendientes || pendientes.length === 0) return null;

  const totalCampos = pendientes.reduce((acc, f) => acc + f.fechas.length, 0);
  const completos = Object.values(valores).filter((v) => v !== undefined && v !== "" && !isNaN(Number(v))).length;
  const listo = completos === totalCampos;

  const setValor = (fincaUuid, fecha, valor) => {
    setValores((prev) => ({ ...prev, [`${fincaUuid}|${fecha}`]: valor }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listo) return;
    setError("");
    setSaving(true);
    try {
      const registros = pendientes.flatMap((f) =>
        f.fechas.map((fecha) => ({
          fincaUuid: f.fincaUuid,
          fecha,
          mm: Number(valores[`${f.fincaUuid}|${fecha}`]),
        })),
      );
      await apiFetch("/precipitacion-diaria", { method: "POST", body: JSON.stringify({ registros }) });
      setValores({});
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 2000 }}
    >
      <div className="bg-white rounded-4 shadow-lg p-4 p-md-5" style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <FiCloudRain className="text-primary" size={22} />
          <h2 className="h5 fw-bold mb-0">Precipitación pendiente de registrar</h2>
        </div>
        <p className="text-secondary small mb-4">
          Tenés días sin registrar. Completá la precipitación (mm) de cada día para poder continuar.
        </p>

        <form onSubmit={handleSubmit}>
          {pendientes.map((f) => (
            <div key={f.fincaUuid} className="mb-4">
              <h3 className="h6 fw-semibold mb-2">{f.fincaNombre}</h3>
              <div className="d-flex flex-column gap-2">
                {f.fechas.map((fecha) => (
                  <div key={fecha} className="d-flex align-items-center gap-2">
                    <span className="text-secondary small" style={{ width: 110 }}>
                      {fecha}
                    </span>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        required
                        className="form-control"
                        placeholder="0.0"
                        value={valores[`${f.fincaUuid}|${fecha}`] ?? ""}
                        onChange={(e) => setValor(f.fincaUuid, fecha, e.target.value)}
                      />
                      <span className="input-group-text">mm</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="alert alert-danger py-2 small d-flex align-items-center gap-2">
              <FiAlertTriangle /> {error}
            </div>
          )}

          <button type="submit" className="btn btn-brand w-100 rounded-3 py-2" disabled={!listo || saving}>
            {saving ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
