"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const OPCIONES = [
  { valor: "DIARIA", nombre: "Diaria", ayuda: "Todos los días (a partir de las 5:00 a.m. hora Colombia)." },
  { valor: "SEMANAL", nombre: "Semanal", ayuda: "Una vez por semana (cada 7 días desde la última actualización)." },
  { valor: "MENSUAL", nombre: "Mensual", ayuda: "Una vez al mes (cada 30 días desde la última actualización)." },
];

function fmtFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

// Frecuencia de la actualización automática del clima de las fincas desde
// Open-Meteo (solo Administrador). Cada actualización trae los últimos 30 días
// de las fincas que tengan coordenadas.
export default function OpenMeteoConfigForm({ onClose }) {
  const [frecuencia, setFrecuencia] = useState("DIARIA");
  const [ultima, setUltima] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/estacion-meteorologica/open-meteo/configuracion")
      .then((c) => {
        setFrecuencia(c.frecuencia || "DIARIA");
        setUltima(c.ultimaActualizacion || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      await apiFetch("/estacion-meteorologica/open-meteo/configuracion", { method: "PUT", body: JSON.stringify({ frecuencia }) });
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <p className="small text-secondary mb-3">
        Elige cada cuánto se actualiza automáticamente el clima de las fincas desde Open-Meteo. Cada actualización trae los últimos
        30 días de las fincas con coordenadas (Maestros &gt; Fincas). También puedes actualizar a mano desde la pestaña Open-Meteo.
      </p>

      {loading ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : (
        <form onSubmit={handleGuardar}>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <div className="d-flex flex-column gap-2 mb-3">
            {OPCIONES.map((o) => (
              <label key={o.valor} className="form-check m-0">
                <input
                  type="radio"
                  name="openMeteoFrecuencia"
                  className="form-check-input"
                  checked={frecuencia === o.valor}
                  onChange={() => {
                    setFrecuencia(o.valor);
                    setGuardado(false);
                  }}
                />{" "}
                <span className="form-check-label fw-medium small">{o.nombre}</span>
                <div className="form-text mt-0">{o.ayuda}</div>
              </label>
            ))}
          </div>

          <p className="small text-secondary">
            Última actualización: <strong>{fmtFechaHora(ultima)}</strong>
          </p>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-brand btn-sm rounded-3 flex-grow-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
          {guardado && <p className="small text-success mb-0 mt-2">Guardado.</p>}
        </form>
      )}
    </>
  );
}
