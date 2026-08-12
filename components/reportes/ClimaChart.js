"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";

// Precipitación (mm), temperatura (°C) y humedad relativa (%) tienen escalas
// muy distintas — en vez de una sola gráfica con tres líneas ilegibles, se
// elige una métrica a la vez (mismo patrón de pestañas que ya usa la página
// de Sanidad Vegetal — Gráficos).
const METRICAS = [
  { key: "mm", label: "Precipitación (mm)", campo: "promedioMm", color: "#2563eb", unidad: "mm" },
  { key: "temperatura", label: "Temperatura (°C)", campo: "promedioTemperatura", color: "#dc2626", unidad: "°C" },
  { key: "humedad", label: "Humedad relativa (%)", campo: "promedioHumedad", color: "#16a34a", unidad: "%" },
];

export default function ClimaChart({ mensajeVacio = "No hay registros de clima para mostrar." }) {
  const [metrica, setMetrica] = useState(METRICAS[0].key);
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    apiFetch(`/clima/promedio-semanal${params.toString() ? `?${params.toString()}` : ""}`)
      .then((res) => {
        if (cancelado) return;
        setItems(res.items || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [fincaUuid]);

  const fincaNombre = fincas.find((f) => f.uuid === fincaUuid)?.nombre || "Todas las fincas";
  const metricaActual = METRICAS.find((m) => m.key === metrica);

  // Semanas sin dato para la métrica elegida (ej. temperatura, que no
  // siempre se captura) no dibujan punto — se filtran para esta serie en
  // particular, sin afectar a las otras métricas.
  const dataMetrica = (items || []).filter((it) => it[metricaActual.campo] !== null);

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div>
          <h2 className="h6 fw-bold mb-0">Promedio Semanal de Clima</h2>
          <p className="text-secondary small mb-0">{fincaNombre}</p>
        </div>
        <select
          className="form-select form-select-sm rounded-3"
          style={{ width: "auto" }}
          value={fincaUuid}
          onChange={(e) => setFincaUuid(e.target.value)}
        >
          <option value="">Todas las fincas</option>
          {fincas.map((f) => (
            <option key={f.uuid} value={f.uuid}>
              {f.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="d-flex gap-2 mb-3">
        {METRICAS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`btn btn-sm rounded-3 ${metrica === m.key ? "btn-brand text-white" : "btn-outline-secondary"}`}
            onClick={() => setMetrica(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando promedios...</p>}

      {!loading && !error && dataMetrica.length === 0 && (
        <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
      )}

      {!loading && !error && dataMetrica.length > 0 && (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataMetrica} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString("es")} ${metricaActual.unidad}`, metricaActual.label]}
                labelFormatter={(label) => `Semana ${label}`}
              />
              <Line
                type="monotone"
                dataKey={metricaActual.campo}
                stroke={metricaActual.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
