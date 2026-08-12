"use client";

import { useEffect, useState } from "react";
import { FiTrendingUp, FiRefreshCw } from "react-icons/fi";
import { GiBananaBunch } from "react-icons/gi";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Dot,
} from "recharts";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { COLOR_HEX } from "@/lib/semanaColor";

const YEAR_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

function pivotData(anios) {
  const todasSemanas = new Set();
  for (const a of anios) {
    for (const p of a.puntos) {
      todasSemanas.add(p.numeroSemana);
    }
  }
  const semanasOrdered = [...todasSemanas].sort((a, b) => a - b);
  return semanasOrdered.map((semana) => {
    const point = { numeroSemana: semana };
    for (const a of anios) {
      const p = a.puntos.find((p) => p.numeroSemana === semana);
      point[String(a.anio)] = p ? p.totalEmbolsado : null;
    }
    return point;
  });
}

function TooltipPersonalizado({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border rounded-3 shadow-sm p-2 small">
      <div className="fw-semibold mb-1">Semana {label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="d-flex align-items-center gap-2">
          <span style={{ color: entry.color }}>●</span>
          <span>{entry.dataKey}:</span>
          <span className="fw-bold">{entry.value?.toLocaleString("es") ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReporteEmbolsesPage() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [aniosSeleccionados, setAniosSeleccionados] = useState([new Date().getFullYear()]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch((err) => setError(err.message));
  }, []);

  const anioActual = new Date().getFullYear();
  const anioOpciones = [];
  for (let i = anioActual - 5; i <= anioActual; i++) {
    anioOpciones.push(i);
  }

  function toggleAnio(anio) {
    setAniosSeleccionados((prev) =>
      prev.includes(anio) ? prev.filter((a) => a !== anio) : [...prev, anio]
    );
  }

  async function handleConsultar() {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ anios: aniosSeleccionados.join(",") });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      const res = await apiFetch(`/racimo-movimientos/reporte-embolses?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const aniosKey = aniosSeleccionados.join(",");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aniosSeleccionados.length > 0) handleConsultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaUuid, aniosKey]);

  const chartData = data ? pivotData(data.anios) : [];

  return (
    <RequirePermission code="menu.racimos.reporte_embolses">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <GiBananaBunch /> Reporte de Embolses
            </h1>
            <p className="text-secondary mb-0">Total de racimos embolsados por semana, comparativa multi-año.</p>
          </div>

          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label small fw-medium mb-1">Finca</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={fincaUuid}
                onChange={(e) => setFincaUuid(e.target.value)}
                style={{ minWidth: "10rem" }}
              >
                <option value="">Todas</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label small fw-medium mb-1">Años</label>
              <div className="d-flex flex-wrap gap-1">
                {anioOpciones.map((a) => (
                  <label
                    key={a}
                    className={`btn btn-sm rounded-3 ${aniosSeleccionados.includes(a) ? "btn-brand" : "btn-outline-secondary"}`}
                  >
                    <input
                      type="checkbox"
                      className="d-none"
                      checked={aniosSeleccionados.includes(a)}
                      onChange={() => toggleAnio(a)}
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleConsultar}
              disabled={loading || aniosSeleccionados.length === 0}
              title="Actualizar"
            >
              <FiRefreshCw className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {loading && !data && <p className="text-secondary">Cargando...</p>}

        {data && (
          <>
            <div className="row g-3 mb-3">
              {data.anios.map((a, i) => (
                <div key={a.anio} className="col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm rounded-4 p-3" style={{ borderLeft: `4px solid ${YEAR_COLORS[i % YEAR_COLORS.length]}` }}>
                    <span className="text-secondary small d-flex align-items-center gap-2">
                      <FiTrendingUp /> Total {a.anio}
                    </span>
                    <span className="fs-3 fw-bold" style={{ color: YEAR_COLORS[i % YEAR_COLORS.length] }}>
                      {a.totalAnual.toLocaleString("es")}
                    </span>
                    <span className="text-secondary small">
                      {data.finca ? data.finca.nombre : "Todas las fincas"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card border-0 shadow-sm rounded-4 p-3">
              <ResponsiveContainer width="100%" height={420}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="numeroSemana"
                    tickFormatter={(v) => `S${v}`}
                    tick={{ fontSize: 11 }}
                    interval={3}
                  />
                  <YAxis tick={{ fontSize: 11 }} width={60} domain={['auto', 'auto']} />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Legend />
                  {data.anios.map((a, i) => {
                    const yearKey = String(a.anio);
                    const puntosAnio = a.puntos;
                    return (
                      <Line
                        key={a.anio}
                        type="monotone"
                        dataKey={yearKey}
                        stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                        strokeWidth={2}
                        dot={(dotProps) => {
                          if (dotProps.payload[yearKey] === null) return null;
                          const p = puntosAnio.find((x) => x.numeroSemana === dotProps.payload.numeroSemana);
                          const colorHex = COLOR_HEX[p?.color] || YEAR_COLORS[i % YEAR_COLORS.length];
                          return <Dot cx={dotProps.cx} cy={dotProps.cy} r={4} fill={colorHex} stroke="#374151" strokeWidth={1} />;
                        }}
                        activeDot={(dotProps) => {
                          if (dotProps.payload[yearKey] === null) return null;
                          const p = puntosAnio.find((x) => x.numeroSemana === dotProps.payload.numeroSemana);
                          const colorHex = COLOR_HEX[p?.color] || YEAR_COLORS[i % YEAR_COLORS.length];
                          return <Dot cx={dotProps.cx} cy={dotProps.cy} r={6} fill={colorHex} stroke="#374151" strokeWidth={2} />;
                        }}
                        connectNulls={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {!data && !loading && (
          <p className="text-secondary text-center py-5">Seleccione al menos un año para ver el reporte.</p>
        )}
      </div>

      <style jsx>{`
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .btn-brand {
          background-color: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .btn-brand:hover {
          background-color: #15803d;
          border-color: #15803d;
          color: #fff;
        }
      `}</style>
    </RequirePermission>
  );
}
