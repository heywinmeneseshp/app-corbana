"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import InfoTooltip from "@/components/reportes/InfoTooltip";
import GraficoSemanalComparable from "@/components/reportes/GraficoSemanalComparable";
import CollapsibleCard from "@/components/reportes/CollapsibleCard";
import RangoSemanasSlider, { filtrarSemanas } from "@/components/reportes/RangoSemanasSlider";
import { INFO_HOJAS_TOTALES, INFO_INDICE, INFO_YLI_YLS } from "@/components/reportes/PromedioInfeccionChart";
import { COLORES_EDAD, INFO_CONTEO } from "@/components/reportes/PromedioPorEdadChart";
import { INFO_CLIMA, METRICAS } from "@/components/reportes/ClimaChart";

const COLOR_YLI = "#dc2626";
const COLOR_YLS = "#2563eb";
const COLOR_INDICE = "#9333ea";

const LINEAS_YLI_YLS = [
  { key: "yli", label: "Promedio YLI", color: COLOR_YLI, campo: "promedioYli" },
  { key: "yls", label: "Promedio YLS", color: COLOR_YLS, campo: "promedioYls" },
];
const LINEAS_HOJAS = [{ key: "hojas", label: "Promedio hojas", color: "#16a34a", campo: "promedioHojasTotales" }];
const LINEAS_INDICE = [{ key: "indice", label: "Promedio Índice de Infección", color: COLOR_INDICE, campo: "promedioIndiceInfeccion" }];

// Pestaña "Índice de infección": YLI/YLS, hojas totales e Índice de Infección,
// cada una con el filtro de selecciones, el slider de semanas y pantalla completa.
export function InfeccionGraficos({ sel }) {
  const endpoint = "/evaluaciones/infeccion-promedio";
  const vacio = "No hay evaluaciones de infección para mostrar.";
  return (
    <>
      <GraficoSemanalComparable
        titulo="Promedio de YLI y YLS por Semana"
        info={<InfoTooltip texto={INFO_YLI_YLS} />}
        endpoint={endpoint}
        series={sel.series}
        lineas={LINEAS_YLI_YLS}
        limites={[{ valor: 8, color: "#f59e0b" }]}
        mensajeVacio={vacio}
      />
      <GraficoSemanalComparable
        titulo="Promedio de Hojas Totales por Semana"
        info={<InfoTooltip texto={INFO_HOJAS_TOTALES} />}
        endpoint={endpoint}
        series={sel.series}
        lineas={LINEAS_HOJAS}
        ocultarSiVacio
      />
      <GraficoSemanalComparable
        titulo="Promedio de Índice de Infección por Semana"
        info={<InfoTooltip texto={INFO_INDICE} />}
        endpoint={endpoint}
        series={sel.series}
        lineas={LINEAS_INDICE}
        limites={[{ valor: 33, color: "#dc2626" }]}
        yUnit="%"
        formato={(v) => `${Number(v).toFixed(2)}%`}
        ocultarSiVacio
      />
    </>
  );
}

// Una línea por edad de la planta (semanas desde el embolse) presente en los
// datos; el tooltip indica a qué semana de embolse corresponde.
const lineasPorEdad = (items) => {
  const edades = [...new Set(items.map((i) => i.edad))].filter((e) => e != null).sort((a, b) => a - b);
  return edades.map((edad, i) => ({
    key: `e${edad}`,
    label: `${edad} semanas`,
    color: COLORES_EDAD[i % COLORES_EDAD.length],
    filtro: (it) => it.edad === edad,
    extra: (it) => (it.semanaEmbolseCodigo ? `embolse ${it.semanaEmbolseCodigo}` : null),
  }));
};

// Pestaña "Conteo de Hojas": promedio de hojas funcionales por edad.
export function ConteoGraficos({ sel }) {
  return (
    <GraficoSemanalComparable
      titulo="Promedio de Hojas Funcionales por Edad"
      info={<InfoTooltip texto={INFO_CONTEO} />}
      endpoint="/evaluaciones/conteo-promedio"
      series={sel.series}
      lineas={lineasPorEdad}
      mensajeVacio="No hay evaluaciones de Conteo de Hojas para mostrar."
      alto={340}
    />
  );
}


// Temperatura, humedad relativa y precipitación en la MISMA gráfica: las tres
// tienen escalas muy distintas, así que cada una va en su propio eje (°C a la
// izquierda; % y mm a la derecha). Solo con una selección.
function ClimaCombinado({ serie, diario }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rango, setRango] = useState(null);
  const claveSerie = JSON.stringify([serie.anio, serie.fincaUuids, diario]);
  const campoX = diario ? "numeroDia" : "numeroSemana";

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ anio: String(serie.anio) });
    if (serie.fincaUuids.length) params.set("fincaUuid", serie.fincaUuids.join(","));
    apiFetch(`/clima/${diario ? "promedio-diario" : "promedio-semanal"}?${params.toString()}`)
      .then((res) => !cancelado && setItems(res.items || []))
      .catch((err) => !cancelado && setError(err.message))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSerie]);

  const filas = useMemo(
    () =>
      items
        .filter((i) => i[campoX] != null)
        .map((i) => ({
          numeroSemana: i.numeroSemana,
          numeroDia: i.numeroDia,
          etiqueta: diario ? `${i.fecha.slice(8, 10)}/${i.fecha.slice(5, 7)}` : `S${i.numeroSemana}`,
          fecha: i.fecha,
          semanaCodigo: i.semanaCodigo,
          totalMm: i.totalMm,
          promedioTemperatura: i.promedioTemperatura,
          promedioHumedad: i.promedioHumedad,
        }))
        .sort((a, b) => a[campoX] - b[campoX]),
    [items, campoX, diario],
  );
  const visibles = filtrarSemanas(filas, rango, campoX);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRango(null);
  }, [diario]);
  const [mm, temp, hum] = [METRICAS[0], METRICAS[1], METRICAS[2]];
  const fmt = (v, u) => `${Number(v).toLocaleString("es")} ${u}`;

  return (
    <CollapsibleCard titulo="Temperatura, humedad y precipitación" subtitulo={serie.label} info={<InfoTooltip texto={INFO_CLIMA} />} colapsable={false} expandible className="mb-3">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando promedios...</p>}
      {!loading && !error && filas.length === 0 && <p className="text-secondary small py-4 text-center mb-0">No hay registros de clima para mostrar.</p>}
      {!loading && !error && filas.length > 0 && (
        <>
          <div className="grafico-alto" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visibles} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} interval={!diario && rango && rango[1] - rango[0] < 20 ? 0 : "preserveStartEnd"} minTickGap={diario ? 28 : 12} />
                <YAxis yAxisId="temp" orientation="left" tick={{ fontSize: 10, fill: temp.color }} width={42} unit="°" domain={["auto", "auto"]} stroke={temp.color} />
                <YAxis yAxisId="hum" orientation="right" tick={{ fontSize: 10, fill: hum.color }} width={42} unit="%" domain={["auto", "auto"]} stroke={hum.color} />
                <YAxis yAxisId="mm" orientation="right" tick={{ fontSize: 10, fill: mm.color }} width={46} unit=" mm" stroke={mm.color} />
                <Tooltip
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                  labelFormatter={(_, p) => (diario ? `Día ${p?.[0]?.payload?.fecha}` : `Semana ${p?.[0]?.payload?.numeroSemana}${p?.[0]?.payload?.semanaCodigo ? ` (${p[0].payload.semanaCodigo})` : ""}`)}
                  formatter={(v, name, item) => [fmt(v, item.dataKey === "totalMm" ? "mm" : item.dataKey === "promedioTemperatura" ? "°C" : "%"), name]}
                />
                <Legend />
                <Bar yAxisId="mm" dataKey="totalMm" name="Precipitación (mm)" fill={mm.color} fillOpacity={0.45} barSize={14} />
                <Line yAxisId="temp" type="monotone" dataKey="promedioTemperatura" name="Temperatura (°C)" stroke={temp.color} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                <Line yAxisId="hum" type="monotone" dataKey="promedioHumedad" name="Humedad relativa (%)" stroke={hum.color} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <RangoSemanasSlider value={rango} onChange={setRango} max={diario ? 366 : 53} rotulo={diario ? "Días" : "Semanas"} />
        </>
      )}
    </CollapsibleCard>
  );
}

// Pestaña "Clima": precipitación, temperatura y humedad por semana. Con una
// sola selección, un clic en un punto muestra el aporte de cada finca.
export function ClimaGraficos({ sel }) {
  const [combinado, setCombinado] = useState(false);
  const [diario, setDiario] = useState(false);
  const [detalle, setDetalle] = useState(null); // { semanaCodigo, fincas, metrica }
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");

  const verDetalle = (metrica) => (punto) => {
    if (!punto?.semanaUuid) return;
    setDetalle(null);
    setErrorDetalle("");
    setCargandoDetalle(true);
    const params = new URLSearchParams();
    const uuids = sel.series[0]?.fincaUuids || [];
    if (uuids.length) params.set("fincaUuid", uuids.join(","));
    apiFetch(`/clima/promedio-semanal/${punto.semanaUuid}/detalle?${params.toString()}`)
      .then((res) => setDetalle({ ...res, metrica }))
      .catch((err) => setErrorDetalle(err.message))
      .finally(() => setCargandoDetalle(false));
  };

  const vistaCombinada = combinado && sel.series.length === 1;

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-2 small">
        <div className="btn-group btn-group-sm" role="group" aria-label="Periodo">
          <button type="button" className={`btn ${!diario ? "btn-brand" : "btn-light"}`} onClick={() => setDiario(false)}>
            Semanal
          </button>
          <button type="button" className={`btn ${diario ? "btn-brand" : "btn-light"}`} onClick={() => setDiario(true)}>
            Diario
          </button>
        </div>
        <label className="form-check form-switch m-0">
          <input type="checkbox" className="form-check-input" checked={combinado} onChange={(e) => setCombinado(e.target.checked)} />{" "}
          <span className="form-check-label">Ver temperatura, humedad y precipitación en un solo gráfico</span>
        </label>
        {combinado && sel.series.length > 1 && <span className="text-secondary">(la vista combinada es para una sola selección; con varias se muestran por separado)</span>}
      </div>

      {vistaCombinada && <ClimaCombinado serie={sel.series[0]} diario={diario} />}

      {!vistaCombinada && METRICAS.map((m, i) => (
        <GraficoSemanalComparable
          key={m.key}
          titulo={m.label}
          info={i === 0 ? <InfoTooltip texto={INFO_CLIMA} /> : undefined}
          endpoint={diario ? "/clima/promedio-diario" : "/clima/promedio-semanal"}
          diario={diario}
          series={sel.series}
          lineas={[{ key: m.key, label: m.label, color: m.color, campo: m.campo }]}
          yUnit={m.unidad === "mm" ? undefined : m.unidad}
          formato={(v) => `${Number(v).toLocaleString("es")} ${m.unidad}`}
          mensajeVacio="No hay registros de clima para mostrar."
          precipitacion={false}
          onPuntoClick={diario ? undefined : verDetalle(m)}
          ayuda={!diario && sel.series.length === 1 ? "Haz clic en un punto para ver el detalle por finca de esa semana." : undefined}
        />
      ))}

      {(cargandoDetalle || errorDetalle || detalle) && (
        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold small">Detalle por finca {detalle ? `— ${detalle.semanaCodigo} · ${detalle.metrica.label}` : ""}</span>
            <button
              type="button"
              className="btn-close"
              style={{ fontSize: "0.6rem" }}
              onClick={() => {
                setDetalle(null);
                setErrorDetalle("");
              }}
              aria-label="Cerrar"
            />
          </div>
          {cargandoDetalle && <p className="text-secondary small mb-0">Cargando...</p>}
          {errorDetalle && <p className="text-danger small mb-0">{errorDetalle}</p>}
          {detalle && !cargandoDetalle && (
            <div className="table-responsive" style={{ maxHeight: "14rem" }}>
              <table className="table table-sm mb-0">
                <thead>
                  <tr className="text-secondary small">
                    <th>Finca</th>
                    <th className="text-end">{detalle.metrica.label}</th>
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
                      <td className="text-end small fw-medium">{f[detalle.metrica.campo] != null ? `${f[detalle.metrica.campo]} ${detalle.metrica.unidad}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
