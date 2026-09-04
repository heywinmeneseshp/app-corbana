"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { FiMaximize2, FiSettings } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { TooltipEdad } from "@/components/reportes/PromedioPorEdadChart";
import InfoTooltip from "@/components/reportes/InfoTooltip";

// El gráfico solo muestra las hojas 3 y 5 (la hoja 4 se evalúa y pesa en el
// total, pero no se grafica por separado acá).
const HOJAS = [3, 5];
const COLORES_HOJA = ["#2563eb", "#f59e0b"];

// Promedio de Suma Bruta desglosado por hoja (3, 4, 5) y semana de registro.
// Mismo patrón que PromedioPorEdadChart (Conteo de Hojas), pero agrupando
// por hoja en vez de por edad de la planta.
//
// `fincaUuid` es controlado desde afuera (ver SumaBrutaGraficos en
// graficos/page.js) para que el mismo filtro aplique también al gráfico
// "por semana". Por defecto muestra el año actual — para comparar entre
// fincas o entre años está el botón de expandir.
export default function PromedioSumaBrutaPorHojaChart({
  titulo,
  endpoint,
  mensajeVacio,
  fincaUuid = "",
  anio = new Date().getFullYear(),
  onExpand,
  onConfigurar,
  limites,
  info,
}) {
  const umbralAdvertencia = limites?.advertencia ?? 450;
  const umbralAlerta = limites?.alerta ?? 650;
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

  const filas = [];
  const semanasPorCodigo = new Map();
  for (const item of itemsFiltrados) {
    if (!HOJAS.includes(item.hoja)) continue;
    let fila = semanasPorCodigo.get(item.semanaCodigo);
    if (!fila) {
      fila = { semanaCodigo: item.semanaCodigo };
      semanasPorCodigo.set(item.semanaCodigo, fila);
      filas.push(fila);
    }
    fila[`h${item.hoja}`] = item.promedio;
  }
  // Orden descendente: así el tooltip (que sigue el orden en que se
  // dibujan las líneas) muestra Hoja 5 arriba de Hoja 3.
  const hojasPresentes = [...new Set(itemsFiltrados.map((i) => i.hoja))]
    .filter((h) => HOJAS.includes(h))
    .sort((a, b) => b - a);

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="d-flex align-items-center gap-2">
          <h2 className="h6 fw-bold mb-0">{titulo}</h2>
          {info && <InfoTooltip texto={info} />}
        </span>
        <div className="d-flex align-items-center gap-2">
          {onConfigurar && (
            <button
              type="button"
              className="btn btn-sm p-0 border-0 text-secondary"
              title="Configurar líneas de referencia"
              onClick={onConfigurar}
              style={{ fontSize: "0.9rem" }}
            >
              <FiSettings />
            </button>
          )}
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
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando promedios...</p>}

      {!loading && !error && filas.length === 0 && (
        <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
      )}

      {!loading && !error && filas.length > 0 && (
        <>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filas} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                <Tooltip
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                  content={<TooltipEdad />}
                  labelFormatter={(label) => `Semana ${label}`}
                />
                <ReferenceLine
                  y={umbralAdvertencia}
                  stroke="#f59e0b"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: String(umbralAdvertencia), position: "right", fill: "#f59e0b", fontSize: 11, fontWeight: 600 }}
                />
                <ReferenceLine
                  y={umbralAlerta}
                  stroke="#dc2626"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: String(umbralAlerta), position: "right", fill: "#dc2626", fontSize: 11, fontWeight: 600 }}
                />
                {hojasPresentes.map((hoja) => (
                  <Line
                    key={hoja}
                    type="monotone"
                    dataKey={`h${hoja}`}
                    name={`Suma Bruta Hoja ${hoja}`}
                    stroke={COLORES_HOJA[HOJAS.indexOf(hoja)]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="d-flex flex-wrap justify-content-center gap-3 mt-2 small">
            {hojasPresentes.map((hoja) => (
              <span key={hoja} className="d-inline-flex align-items-center gap-1">
                <span
                  className="d-inline-block rounded-circle"
                  style={{ width: 10, height: 10, backgroundColor: COLORES_HOJA[HOJAS.indexOf(hoja)] }}
                />
                Suma Bruta Hoja {hoja}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
