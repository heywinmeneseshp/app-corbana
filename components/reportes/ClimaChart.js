"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FiMaximize2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ClimaCompareModal from "@/components/reportes/ClimaCompareModal";
import InfoTooltip from "@/components/reportes/InfoTooltip";

const INFO_CLIMA = (
  <>
    <p className="fw-semibold mb-1">Precipitación promedio (mm)</p>
    <p className="mb-2">
      Cada finca acumula su propia lluvia de la semana (suma de sus 7 días — los días sin registro dentro
      de su rango real de captura cuentan como 0 mm). El valor mostrado es el promedio de esos acumulados
      entre las fincas del filtro (con una sola finca, es el acumulado de esa finca).
    </p>
    <p className="fw-semibold mb-1">Temperatura y humedad relativa</p>
    <p className="mb-0">Promedio simple de los días con dato real de esa semana (no se rellenan con 0).</p>
  </>
);

// Precipitación (mm), temperatura (°C) y humedad relativa (%) tienen escalas
// muy distintas — en vez de una sola gráfica con tres líneas ilegibles, se
// elige una métrica a la vez (mismo patrón de pestañas que ya usa la página
// de Sanidad Vegetal — Gráficos).
const METRICAS = [
  { key: "mm", label: "Precipitación promedio (mm)", campo: "totalMm", color: "#2563eb", unidad: "mm" },
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
  const [modalAbierto, setModalAbierto] = useState(false);
  const [detalle, setDetalle] = useState(null); // { semanaCodigo, fincas } | null
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");
    setDetalle(null);
    setErrorDetalle("");
    const params = new URLSearchParams();
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    // Por defecto se muestra solo el año actual (antes traía todo el
    // histórico junto, muy difícil de leer) — para ver otros años o
    // comparar, está el botón de expandir con el modal de comparación.
    params.set("anio", new Date().getFullYear());
    apiFetch(`/clima/promedio-semanal?${params.toString()}`)
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

  // Al hacer clic en un punto, trae cuánto aportó cada finca a ese total —
  // solo se pide al hacer clic, no se precarga para todas las semanas.
  const verDetalleSemana = (semanaUuid) => {
    if (!semanaUuid) return;
    setDetalle(null);
    setErrorDetalle("");
    setCargandoDetalle(true);
    const params = new URLSearchParams();
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    apiFetch(`/clima/promedio-semanal/${semanaUuid}/detalle?${params.toString()}`)
      .then((res) => {
        setDetalle(res);
        setCargandoDetalle(false);
      })
      .catch((err) => {
        setErrorDetalle(err.message);
        setCargandoDetalle(false);
      });
  };

  // Semanas sin dato para la métrica elegida (ej. temperatura, que no
  // siempre se captura) no dibujan punto — se filtran para esta serie en
  // particular, sin afectar a las otras métricas.
  //
  // `ts` (timestamp) en vez de la posición en el arreglo: con un eje
  // categórico por semanaCodigo, dos semanas con dato pero separadas por
  // varias semanas sin captura quedaban dibujadas una al lado de la otra,
  // como si fueran consecutivas — un salto real de meses se veía igual que
  // uno de una semana. Con un eje numérico por fecha real, la distancia
  // horizontal entre puntos refleja el tiempo real que pasó.
  const dataMetrica = (items || [])
    .filter((it) => it[metricaActual.campo] !== null)
    .map((it) => ({ ...it, ts: new Date(it.fecha).getTime() }));

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div>
          <span className="d-flex align-items-center gap-2">
            <h2 className="h6 fw-bold mb-0">Promedio Semanal de Clima</h2>
            <InfoTooltip texto={INFO_CLIMA} />
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
            <LineChart
              data={dataMetrica}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              onClick={(e) => {
                const punto = e?.activePayload?.[0]?.payload;
                if (punto) verDetalleSemana(punto.semanaUuid);
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 10 }}
                tickFormatter={(ts) => {
                  // El eje sigue siendo por tiempo real (para que la
                  // distancia entre puntos refleje semanas saltadas), pero
                  // la etiqueta muestra la semana más cercana a ese tick en
                  // vez del mes — el tick generado por Recharts no siempre
                  // cae justo en un punto real.
                  let cercano = dataMetrica[0];
                  for (const it of dataMetrica) {
                    if (Math.abs(it.ts - ts) < Math.abs(cercano.ts - ts)) cercano = it;
                  }
                  return cercano?.semanaCodigo || "";
                }}
              />
              <YAxis tick={{ fontSize: 10 }} width={40} allowDecimals />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString("es")} ${metricaActual.unidad}`, metricaActual.label]}
                labelFormatter={(ts) => {
                  const it = dataMetrica.find((r) => r.ts === ts);
                  return it ? it.semanaCodigo : new Date(ts).toLocaleDateString("es");
                }}
              />
              <Line
                type="monotone"
                dataKey={metricaActual.campo}
                stroke={metricaActual.color}
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload, key } = props;
                  if (cx == null || cy == null) return null;
                  return (
                    <g key={key} style={{ cursor: "pointer" }} onClick={() => verDetalleSemana(payload.semanaUuid)}>
                      {/* Círculo invisible más grande: el visible (r=4) es muy
                          chico para hacerle clic con precisión — este amplía
                          el área clicleable sin cambiar cómo se ve el punto. */}
                      <circle cx={cx} cy={cy} r={12} fill="transparent" />
                      <circle cx={cx} cy={cy} r={4} fill={metricaActual.color} stroke="#fff" strokeWidth={1} />
                    </g>
                  );
                }}
                activeDot={{ r: 6, onClick: (_, i) => verDetalleSemana(i?.payload?.semanaUuid) }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: "0.7rem" }}>
            Hacé clic en un punto para ver el detalle por finca de esa semana.
          </p>
        </div>
      )}

      {(cargandoDetalle || errorDetalle || detalle) && (
        <div className="border rounded-3 p-3 mt-2">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold small">
              Detalle por finca {detalle ? `— ${detalle.semanaCodigo}` : ""}
            </span>
            <button
              type="button"
              className="btn-close"
              style={{ fontSize: "0.6rem" }}
              onClick={() => {
                setDetalle(null);
                setErrorDetalle("");
              }}
              aria-label="Cerrar"
            ></button>
          </div>
          {cargandoDetalle && <p className="text-secondary small mb-0">Cargando...</p>}
          {errorDetalle && <p className="text-danger small mb-0">{errorDetalle}</p>}
          {detalle && !cargandoDetalle && (
            <div className="table-responsive" style={{ maxHeight: "14rem" }}>
              <table className="table table-sm mb-0">
                <thead>
                  <tr className="text-secondary small">
                    <th>Finca</th>
                    <th className="text-end">{metricaActual.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.fincas.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-secondary small text-center py-2">
                        Ninguna finca estaba siendo monitoreada esa semana.
                      </td>
                    </tr>
                  )}
                  {detalle.fincas.map((f) => (
                    <tr key={f.fincaUuid}>
                      <td className="small">{f.fincaNombre}</td>
                      <td className="text-end small fw-medium">
                        {f[metricaActual.campo] != null ? `${f[metricaActual.campo]} ${metricaActual.unidad}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ClimaCompareModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        metricaKey={metrica}
        metricaLabel={metricaActual.label}
        metricaCampo={metricaActual.campo}
        metricaColor={metricaActual.color}
        metricaUnidad={metricaActual.unidad}
        fincaUuidBase={fincaUuid}
        fincaBaseLabel={fincaNombre}
      />
    </div>
  );
}
