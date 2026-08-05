"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";

// Color de la cinta de embolse por semana (mismo ciclo de 8 colores que el
// backend: src/utils/semanaColor.js). Se usa para pintar el punto de cada
// semana en la gráfica.
const COLORES_CINTA = {
  Azul: "#2563eb",
  Blanco: "#e2e8f0",
  Amarillo: "#facc15",
  Morado: "#9333ea",
  Rojo: "#dc2626",
  Café: "#92400e",
  Negro: "#111827",
  Verde: "#16a34a",
  Gris: "#9ca3af",
};

// Promedio por semana (todas las fincas o una en particular). El promedio se
// calcula en el backend, por lo que refleja siempre los valores vigentes. El
// punto de cada semana se pinta con el color de su cinta de embolse.
export default function PromedioPorSemanaChart({ titulo, endpoint, colorLinea, mensajeVacio }) {
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
    apiFetch(`${endpoint}${params.toString() ? `?${params.toString()}` : ""}`)
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
  }, [fincaUuid, endpoint]);

  const fincaNombre = fincas.find((f) => f.uuid === fincaUuid)?.nombre || "Todas las fincas";

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div>
          <h2 className="h6 fw-bold mb-0">{titulo}</h2>
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

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando promedios...</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={items} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                <Tooltip
                  formatter={(value, name) => [Number(value).toLocaleString("es"), name === "promedio" ? "Promedio" : name]}
                  labelFormatter={(label, payload) => {
                    const cinta = payload?.[0]?.payload?.cinta;
                    return `Semana ${label}${cinta ? ` — Cinta ${cinta}` : ""}`;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="promedio"
                  stroke={colorLinea}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return <circle cx={cx} cy={cy} r={4} fill={COLORES_CINTA[payload.cinta] || "#94a3b8"} stroke="#fff" strokeWidth={1.5} />;
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-secondary small mb-0 mt-1">Cada punto representa una semana, pintado con el color de su cinta de embolse.</p>
        </>
      )}
    </div>
  );
}