"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";

const COLOR_YLI = "#dc2626";
const COLOR_YLS = "#2563eb";

// Promedio semanal del Índice de Infección (YLI y YLS) más el promedio de
// hojas totales evaluadas. Se muestra en dos gráficas: la primera junta los
// promedios YLI y YLS, la segunda el promedio de hojas por separado.
export default function PromedioInfeccionChart({ titulo, endpoint = "/evaluaciones/infeccion-promedio", mensajeVacio }) {
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

  const tiene = (campo) => (items || []).some((i) => i[campo] != null);

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
          {tiene("promedioYli") || tiene("promedioYls") ? (
            <div className="mb-3">
              <h3 className="h6 fw-semibold text-success mb-1">Promedio de YLI y YLS por Semana</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={items} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                    <Tooltip
                      formatter={(value, name) => [Number(value).toLocaleString("es"), name]}
                      labelFormatter={(label) => `Semana ${label}`}
                    />
                    <Line type="monotone" dataKey="promedioYli" name="Promedio YLI" stroke={COLOR_YLI} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="promedioYls" name="Promedio YLS" stroke={COLOR_YLS} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="d-flex flex-wrap justify-content-center gap-3 mt-1 small">
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="d-inline-block rounded-circle" style={{ width: 10, height: 10, backgroundColor: COLOR_YLI }} />
                  Promedio YLI
                </span>
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="d-inline-block rounded-circle" style={{ width: 10, height: 10, backgroundColor: COLOR_YLS }} />
                  Promedio YLS
                </span>
              </div>
            </div>
          ) : null}

          {tiene("promedioHojasTotales") ? (
            <div>
              <h3 className="h6 fw-semibold text-success mb-1">Promedio de Hojas Totales por Semana</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={items} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                    <Tooltip
                      formatter={(value, name) => [Number(value).toLocaleString("es"), name]}
                      labelFormatter={(label) => `Semana ${label}`}
                    />
                    <Line type="monotone" dataKey="promedioHojasTotales" name="Promedio hojas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {!tiene("promedioYli") && !tiene("promedioYls") && !tiene("promedioHojasTotales") && (
            <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
          )}
        </>
      )}
    </div>
  );
}