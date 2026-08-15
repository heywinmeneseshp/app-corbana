"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { FiMaximize2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import InfoTooltip from "@/components/reportes/InfoTooltip";
import EvaluacionCompareModal from "@/components/reportes/EvaluacionCompareModal";

const COLOR_YLI = "#dc2626";
const COLOR_YLS = "#2563eb";
const COLOR_INDICE = "#9333ea";

const INFO_YLI_YLS = (
  <>
    <p className="fw-semibold mb-1">YLI (Youngest Leaf Infected)</p>
    <p className="mb-2">Número de la hoja más joven que ya muestra infección — se promedia entre las plantas evaluadas de la semana.</p>
    <p className="fw-semibold mb-1">YLS (Youngest Leaf Spotted)</p>
    <p className="mb-0">Número de la hoja más joven con manchas — mismo promedio semanal.</p>
  </>
);

const INFO_HOJAS_TOTALES = (
  <p className="mb-0">Promedio de hojas funcionales por planta, entre todas las plantas evaluadas de la semana.</p>
);

const INFO_INDICE = (
  <>
    <p className="mb-2">Índice de Infección de cada evaluación: PPI ponderado por la severidad de cada hoja evaluada.</p>
    <p className="mb-0">Se promedia solo entre las evaluaciones que sí tienen hojas registradas — una evaluación sin datos de hojas no arrastra el promedio hacia abajo.</p>
  </>
);

function BotonExpandir({ onClick }) {
  return (
    <button type="button" className="btn btn-sm p-0 border-0 text-secondary" title="Comparar con otra finca u otro año" onClick={onClick} style={{ fontSize: "0.9rem" }}>
      <FiMaximize2 />
    </button>
  );
}

// Promedio semanal del Índice de Infección (YLI y YLS) más el promedio de
// hojas totales evaluadas. Se muestra en tres gráficas: YLI/YLS juntas,
// hojas totales, e Índice de Infección. Por defecto muestra el año actual
// — mismo criterio que ClimaChart/Suma Bruta — con botón de expandir por
// gráfica para comparar entre fincas y entre años.
export default function PromedioInfeccionChart({ titulo, endpoint = "/evaluaciones/infeccion-promedio", mensajeVacio }) {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(null); // null | "yliYls" | "hojas" | "indice"

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
              <div className="d-flex align-items-center justify-content-between">
                <h3 className="h6 fw-semibold text-success mb-1 d-flex align-items-center gap-2">
                  Promedio de YLI y YLS por Semana
                  <InfoTooltip texto={INFO_YLI_YLS} />
                </h3>
                <BotonExpandir onClick={() => setModalAbierto("yliYls")} />
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={items} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                    <Tooltip
                      cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      formatter={(value, name) => [Number(value).toLocaleString("es"), name]}
                      labelFormatter={(label) => `Semana ${label}`}
                    />
                    <ReferenceLine
                      y={8}
                      stroke="#f59e0b"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      label={{ value: "8", position: "right", fill: "#f59e0b", fontSize: 11, fontWeight: 600 }}
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
            <div className="mb-3">
              <div className="d-flex align-items-center justify-content-between">
                <h3 className="h6 fw-semibold text-success mb-1 d-flex align-items-center gap-2">
                  Promedio de Hojas Totales por Semana
                  <InfoTooltip texto={INFO_HOJAS_TOTALES} />
                </h3>
                <BotonExpandir onClick={() => setModalAbierto("hojas")} />
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={items} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
                    <Tooltip
                      cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      formatter={(value, name) => [Number(value).toLocaleString("es"), name]}
                      labelFormatter={(label) => `Semana ${label}`}
                    />
                    <Line type="monotone" dataKey="promedioHojasTotales" name="Promedio hojas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {tiene("promedioIndiceInfeccion") ? (
            <div>
              <div className="d-flex align-items-center justify-content-between">
                <h3 className="h6 fw-semibold text-success mb-1 d-flex align-items-center gap-2">
                  Promedio de Índice de Infección por Semana
                  <InfoTooltip texto={INFO_INDICE} />
                </h3>
                <BotonExpandir onClick={() => setModalAbierto("indice")} />
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={items} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semanaCodigo" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals unit="%" />
                    <Tooltip
                      cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      formatter={(value) => [`${Number(value).toFixed(2)}%`, "Promedio Índice de Infección"]}
                      labelFormatter={(label) => `Semana ${label}`}
                    />
                    <ReferenceLine
                      y={33}
                      stroke="#dc2626"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      label={{ value: "33%", position: "right", fill: "#dc2626", fontSize: 11, fontWeight: 600 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="promedioIndiceInfeccion"
                      name="Promedio Índice de Infección"
                      stroke={COLOR_INDICE}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {!tiene("promedioYli") && !tiene("promedioYls") && !tiene("promedioHojasTotales") && !tiene("promedioIndiceInfeccion") && (
            <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>
          )}
        </>
      )}

      <EvaluacionCompareModal
        open={modalAbierto === "yliYls"}
        onClose={() => setModalAbierto(null)}
        titulo="Promedio de YLI y YLS por Semana"
        endpoint={endpoint}
        lineas={[
          { key: "yli", label: "Promedio YLI", color: COLOR_YLI, campo: "promedioYli" },
          { key: "yls", label: "Promedio YLS", color: COLOR_YLS, campo: "promedioYls" },
        ]}
        fincaUuidBase={fincaUuid}
        fincaBaseLabel={fincaNombre}
      />
      <EvaluacionCompareModal
        open={modalAbierto === "hojas"}
        onClose={() => setModalAbierto(null)}
        titulo="Promedio de Hojas Totales por Semana"
        endpoint={endpoint}
        lineas={[{ key: "hojas", label: "Promedio hojas", color: "#16a34a", campo: "promedioHojasTotales" }]}
        fincaUuidBase={fincaUuid}
        fincaBaseLabel={fincaNombre}
      />
      <EvaluacionCompareModal
        open={modalAbierto === "indice"}
        onClose={() => setModalAbierto(null)}
        titulo="Promedio de Índice de Infección por Semana"
        endpoint={endpoint}
        lineas={[{ key: "indice", label: "Promedio Índice de Infección", color: COLOR_INDICE, campo: "promedioIndiceInfeccion" }]}
        limitesControl={[{ valor: 33, color: "#dc2626" }]}
        fincaUuidBase={fincaUuid}
        fincaBaseLabel={fincaNombre}
      />
    </div>
  );
}
