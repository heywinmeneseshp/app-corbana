"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";

// Edades (semanas desde el embolse de su cinta) que se grafican.
export const EDADES_GRAFICA = [8, 9, 10, 11, 12];

// Colores de cada edad (en el mismo orden que EDADES_GRAFICA).
export const COLORES_EDAD = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#dc2626"];

export function TooltipEdad({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-3 shadow-sm px-3 py-2 small" style={{ maxWidth: 220 }}>
      <div className="fw-medium mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="d-flex justify-content-between gap-3">
          <span>
            <span className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, backgroundColor: p.stroke }} />
            {p.name}
          </span>
          <span className="fw-semibold">{Number(p.value).toLocaleString("es")}</span>
        </div>
      ))}
    </div>
  );
}

// Promedio de hojas funcionales por edad de la planta (semanas desde el
// embolse). Una línea por edad presente en los datos, en el eje X las
// semanas de registro de las evaluaciones.
export default function PromedioPorEdadChart({ titulo, endpoint, mensajeVacio }) {
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

  // Semanas en el eje X (en orden), cada una con un valor por edad presente.
  const filas = [];
  const semanasPorCodigo = new Map();
  for (const item of items || []) {
    if (!EDADES_GRAFICA.includes(item.edad)) continue;
    let fila = semanasPorCodigo.get(item.semanaCodigo);
    if (!fila) {
      fila = { semanaCodigo: item.semanaCodigo };
      semanasPorCodigo.set(item.semanaCodigo, fila);
      filas.push(fila);
    }
    fila[`e${item.edad}`] = item.promedio;
  }
  const edadesPresentes = [...new Set((items || []).map((i) => i.edad))]
    .filter((e) => EDADES_GRAFICA.includes(e))
    .sort((a, b) => a - b);

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

      {!loading && !error && filas.length === 0 && (
        <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
      )}

      {!loading && !error && filas.length > 0 && (
        <>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filas} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                <Tooltip content={<TooltipEdad />} labelFormatter={(label) => `Semana ${label}`} />
                {edadesPresentes.map((edad, i) => (
                  <Line
                    key={edad}
                    type="monotone"
                    dataKey={`e${edad}`}
                    name={`${edad} semanas`}
                    stroke={COLORES_EDAD[edad - EDADES_GRAFICA[0]]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="d-flex flex-wrap justify-content-center gap-3 mt-2 small">
            {edadesPresentes.map((edad) => (
              <span key={edad} className="d-inline-flex align-items-center gap-1">
                <span
                  className="d-inline-block rounded-circle"
                  style={{ width: 10, height: 10, backgroundColor: COLORES_EDAD[edad - EDADES_GRAFICA[0]] }}
                />
                {edad} semanas
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}