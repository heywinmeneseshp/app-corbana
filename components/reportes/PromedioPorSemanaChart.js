"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { FiMaximize2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import InfoTooltip from "@/components/reportes/InfoTooltip";
import { usePrecipitacionOverlay, conPrecipitacion, PrecipitacionControls, PrecipitacionSerie } from "@/components/reportes/PrecipitacionOverlay";

// Color de la cinta de embolse por semana (mismo ciclo de 8 colores que el
// backend: src/utils/semanaColor.js). Se usa para pintar el punto de cada
// semana en la gráfica.
export const COLORES_CINTA = {
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
//
// `fincaUuid` es controlado desde afuera (ver SumaBrutaGraficos más abajo)
// para que el mismo filtro aplique a este gráfico y al de "por hoja" a la
// vez. Por defecto muestra el año actual — mismo criterio que ClimaChart —
// para ver otros años o comparar entre fincas está el botón de expandir.
export default function PromedioPorSemanaChart({
  titulo,
  endpoint,
  colorLinea,
  mensajeVacio,
  limitesControl = [],
  fincaUuid = "",
  anio = new Date().getFullYear(),
  onExpand,
  info,
}) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ anio });
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    apiFetch(`${endpoint}?${params.toString()}`)
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
  }, [fincaUuid, anio, endpoint]);

  const itemsFiltrados = items || [];
  const precip = usePrecipitacionOverlay({ fincaUuid, anio });
  const itemsConPrecip = conPrecipitacion(itemsFiltrados, precip.precipPorSemana);

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="d-flex align-items-center gap-2">
          <h2 className="h6 fw-bold mb-0">{titulo}</h2>
          {info && <InfoTooltip texto={info} />}
        </span>
        {onExpand && (
          <button
            type="button"
            className="btn btn-sm p-0 border-0 text-secondary"
            title="Comparar con otra finca u otro año"
            onClick={onExpand}
            style={{ fontSize: "0.9rem" }}
          >
            <FiMaximize2 />
          </button>
        )}
      </div>

      <PrecipitacionControls {...precip} />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando promedios...</p>}

      {!loading && !error && itemsFiltrados.length === 0 && (
        <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
      )}

      {!loading && !error && itemsFiltrados.length > 0 && (
        <>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={itemsConPrecip} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                <Tooltip
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                  formatter={(value, name) => [Number(value).toLocaleString("es"), name === "promedio" ? "Promedio" : name]}
                  labelFormatter={(label, payload) => {
                    const cinta = payload?.[0]?.payload?.cinta;
                    return `Semana ${label}${cinta ? ` — Cinta ${cinta}` : ""}`;
                  }}
                />
                {limitesControl.map((limite) => (
                  <ReferenceLine
                    key={limite.valor}
                    y={limite.valor}
                    stroke={limite.color || "#dc2626"}
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{ value: String(limite.valor), position: "right", fill: limite.color || "#dc2626", fontSize: 11, fontWeight: 600 }}
                  />
                ))}
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
                <PrecipitacionSerie activo={precip.activo} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-secondary small mb-0 mt-1">Cada punto representa una semana, pintado con el color de su cinta de embolse.</p>
        </>
      )}
    </div>
  );
}