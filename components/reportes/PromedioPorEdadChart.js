"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FiMaximize2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import InfoTooltip from "@/components/reportes/InfoTooltip";
import EvaluacionCompareModal from "@/components/reportes/EvaluacionCompareModal";
import { usePrecipitacionOverlay, conPrecipitacion, PrecipitacionControls, PrecipitacionSerie } from "@/components/reportes/PrecipitacionOverlay";
// Paleta de colores para las líneas de edad — se cicla si hay más edades
// presentes en los datos que colores (no hay un tope fijo de edades: se
// grafican TODAS las que aparezcan evaluadas, no solo un rango prefijado).
export const COLORES_EDAD = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#dc2626", "#0891b2", "#db2777", "#65a30d", "#7c3aed", "#92400e"];
const colorDeEdad = (indice) => COLORES_EDAD[indice % COLORES_EDAD.length];

const INFO_CONTEO = (
  <>
    <p className="mb-2">Promedio de hojas funcionales por planta, agrupado por edad (semanas transcurridas desde la semana de embolse de su cinta hasta la semana en que se evaluó).</p>
    <p className="mb-0">Cada línea es una edad distinta, promediada entre todas las plantas de esa edad evaluadas esa semana — se muestran todas las edades evaluadas, sin límite. El tooltip indica a qué semana de embolse corresponde cada edad.</p>
  </>
);

// `payload[i].payload` trae los campos de la fila completa (todas las
// edades), así que cada línea busca ahí su propia semana de embolse
// (`semanaEmbolseCodigo_e${edad}`) — no viene en el propio `payload[i]`.
export function TooltipEdad({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-3 shadow-sm px-3 py-2 small" style={{ width: "max-content", maxWidth: "none" }}>
      <div className="fw-medium mb-1">{label}</div>
      {payload.map((p) => {
        const edad = p.dataKey?.replace("e", "");
        const semanaEmbolse = p.payload?.[`semanaEmbolseCodigo_e${edad}`];
        return (
          <div key={p.dataKey} className="d-flex justify-content-between align-items-center gap-3" style={{ whiteSpace: "nowrap" }}>
            <span>
              <span className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, backgroundColor: p.stroke }} />
              {p.name}
              {semanaEmbolse && <span className="text-secondary ms-1" style={{ fontSize: "0.7rem" }}>(embolse {semanaEmbolse})</span>}
            </span>
            <span className="fw-semibold">{Number(p.value).toLocaleString("es")}</span>
          </div>
        );
      })}
    </div>
  );
}

// Promedio de hojas funcionales por edad de la planta (semanas desde el
// embolse). Una línea por edad presente en los datos, en el eje X las
// semanas de registro de las evaluaciones. Por defecto muestra el año
// actual — para comparar entre fincas o entre años está el botón de
// expandir.
export default function PromedioPorEdadChart({ titulo, endpoint, mensajeVacio }) {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ anio: new Date().getFullYear() });
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
  }, [fincaUuid, endpoint]);

  // Semanas en el eje X (en orden), cada una con un valor por edad presente.
  const filas = [];
  const semanasPorCodigo = new Map();
  for (const item of items || []) {
    let fila = semanasPorCodigo.get(item.semanaCodigo);
    if (!fila) {
      fila = { semanaCodigo: item.semanaCodigo };
      semanasPorCodigo.set(item.semanaCodigo, fila);
      filas.push(fila);
    }
    fila[`e${item.edad}`] = item.promedio;
    fila[`semanaEmbolseCodigo_e${item.edad}`] = item.semanaEmbolseCodigo;
  }
  const edadesPresentes = [...new Set((items || []).map((i) => i.edad))].sort((a, b) => a - b);

  const fincaNombre = fincas.find((f) => f.uuid === fincaUuid)?.nombre || "Todas las fincas";
  const anioActual = new Date().getFullYear();
  const precip = usePrecipitacionOverlay({ fincaUuid, anio: anioActual });
  const filasConPrecip = conPrecipitacion(filas, precip.precipPorSemana);

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div>
          <span className="d-flex align-items-center gap-2">
            <h2 className="h6 fw-bold mb-0">{titulo}</h2>
            <InfoTooltip texto={INFO_CONTEO} />
          </span>
          <p className="text-secondary small mb-0">{fincaNombre}</p>
        </div>
        <div className="d-flex align-items-center gap-2">
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
          <button
            type="button"
            className="btn btn-sm p-0 border-0 text-secondary"
            title="Comparar con otra finca u otro año"
            onClick={() => setModalAbierto(true)}
            style={{ fontSize: "0.9rem" }}
          >
            <FiMaximize2 />
          </button>
        </div>
      </div>

      <PrecipitacionControls {...precip} />

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando promedios...</p>}

      {!loading && !error && filas.length === 0 && (
        <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
      )}

      {!loading && !error && filas.length > 0 && (
        <>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filasConPrecip} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                <Tooltip cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} content={<TooltipEdad />} labelFormatter={(label) => `Semana ${label}`} />
                {edadesPresentes.map((edad, i) => (
                  <Line
                    key={edad}
                    type="monotone"
                    dataKey={`e${edad}`}
                    name={`${edad} semanas`}
                    stroke={colorDeEdad(i)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                ))}
                <PrecipitacionSerie activo={precip.activo} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="d-flex flex-wrap justify-content-center gap-3 mt-2 small">
            {edadesPresentes.map((edad, i) => (
              <span key={edad} className="d-inline-flex align-items-center gap-1">
                <span
                  className="d-inline-block rounded-circle"
                  style={{ width: 10, height: 10, backgroundColor: colorDeEdad(i) }}
                />
                {edad} semanas
              </span>
            ))}
          </div>
        </>
      )}

      <EvaluacionCompareModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        titulo={titulo}
        endpoint={endpoint}
        lineas={edadesPresentes.map((edad, i) => ({
          key: `e${edad}`,
          label: `${edad} semanas`,
          color: colorDeEdad(i),
          filtro: (item) => item.edad === edad,
        }))}
        fincaUuidBase={fincaUuid}
        fincaBaseLabel={fincaNombre}
      />
    </div>
  );
}
