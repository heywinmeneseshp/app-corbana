"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import CollapsibleCard from "@/components/reportes/CollapsibleCard";
import { ejeAjustado as calcularEje } from "@/lib/dominioY";
import RangoSemanasSlider, { filtrarSemanas } from "@/components/reportes/RangoSemanasSlider";
import { PrecipitacionControls, PrecipitacionSerie, conPrecipitacion, usePrecipitacionOverlay } from "@/components/reportes/PrecipitacionOverlay";

const DASHES = ["6 3", "2 3", "8 3 2 3"];

function TooltipSemanal({ active, payload, formato, diario }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0].payload;
  return (
    <div className="bg-white border rounded-3 shadow-sm px-3 py-2 small" style={{ width: "max-content", maxWidth: "none" }}>
      <div className="fw-medium mb-1">
        {diario ? (
          <>Día {fila.fechaTexto || fila.numeroDia}</>
        ) : (
          <>
            Semana {fila.numeroSemana}
            {fila.semanaCodigo ? <span className="text-secondary fw-normal"> ({fila.semanaCodigo})</span> : null}
          </>
        )}
      </div>
      {payload.map((p) => {
        const extra = fila[`${p.dataKey}|extra`];
        return (
          <div key={p.dataKey} className="d-flex justify-content-between align-items-center gap-3" style={{ whiteSpace: "nowrap" }}>
            <span>
              <span className="d-inline-block rounded-circle me-1" style={{ width: 8, height: 8, backgroundColor: p.stroke || p.fill || p.color }} />
              {p.name}
              {extra && <span className="text-secondary ms-1" style={{ fontSize: "0.7rem" }}>({extra})</span>}
            </span>
            <span className="fw-semibold">{p.dataKey === "precipMm" ? `${Number(p.value).toLocaleString("es")} mm` : formato(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Gráfica semanal de Sanidad Vegetal con el diseño de Reportes > Producción:
// una línea por cada selección (finca/grupo × año) y por cada `linea`,
// slider de rango de semanas y pantalla completa.
//
// - `series`: las selecciones activas (ver useSelecciones). Cada una pide el
//   endpoint con su año y sus fincas (separadas por coma).
// - `lineas`: arreglo, o función (items) => arreglo, de
//   { key, label, color, campo = "promedio", filtro?, extra? }: qué sacar de
//   cada ítem de la respuesta. Con 1 sola serie usan su color; con varias,
//   cada serie usa el suyo y las líneas se distinguen por el trazo.
// - Con una sola serie se puede superponer la precipitación semanal.
export default function GraficoSemanalComparable({
  titulo,
  info,
  endpoint,
  series,
  lineas,
  limites = [],
  mensajeVacio = "No hay datos para mostrar.",
  alto = 300,
  yUnit,
  formato = (v) => Number(v).toLocaleString("es"),
  acciones,
  ocultarSiVacio = false,
  onPuntoClick,
  precipitacion = true,
  ayuda,
  diario = false, // eje X por día del año (items con numeroDia) en vez de por semana
  // Datos ya cargados por el padre ([{ serie, items }]): evita que cada gráfica
  // pida lo mismo por su cuenta (ej. Inicio, donde 4 gráficas salen de una misma consulta).
  datos = null,
  filtrosExpandido, // controles que solo se muestran en la vista de pantalla completa
  cargandoExterno = false,
  errorExterno = "",
  yDomain,
  ejeAjustado = false, // eje Y del punto más bajo al más alto de lo visible
}) {
  const [resultadosInt, setResultados] = useState([]); // [{ serie, items }]
  const [loadingInt, setLoading] = useState(true);
  const [errorInt, setError] = useState("");
  const resultados = datos ?? resultadosInt;
  const loading = datos ? cargandoExterno : loadingInt;
  const error = datos ? errorExterno : errorInt;
  const [rangoSemanas, setRangoSemanas] = useState(null);

  const claveSeries = JSON.stringify(series.map((s) => [s.key, s.anio, s.fincaUuids]));

  useEffect(() => {
    if (datos) return undefined;
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    Promise.all(
      series.map((serie) => {
        const params = new URLSearchParams({ anio: String(serie.anio) });
        if (serie.fincaUuids.length > 0) params.set("fincaUuid", serie.fincaUuids.join(","));
        return apiFetch(`${endpoint}?${params.toString()}`).then((res) => ({ serie, items: res.items || [] }));
      }),
    )
      .then((r) => {
        if (!cancelado) setResultados(r);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSeries, endpoint]);

  // Semanas y días tienen escalas distintas: al cambiar de modo se reinicia el rango.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRangoSemanas(null);
  }, [diario]);

  const lineasEfectivas = useMemo(() => (typeof lineas === "function" ? lineas(resultados.flatMap((r) => r.items)) : lineas), [lineas, resultados]);

  const { filas, claves } = useMemo(() => {
    const porSemana = new Map();
    const claves = [];
    const nSeries = resultados.length;
    resultados.forEach(({ serie, items }) => {
      lineasEfectivas.forEach((l, li) => {
        const dataKey = `${serie.key}|${l.key}`;
        claves.push({
          dataKey,
          name: nSeries === 1 ? l.label : lineasEfectivas.length === 1 ? serie.label : `${serie.label} — ${l.label}`,
          color: nSeries === 1 ? l.color : serie.color,
          dash: nSeries === 1 || li === 0 ? undefined : DASHES[(li - 1) % DASHES.length],
        });
        for (const it of items) {
          if (l.filtro && !l.filtro(it)) continue;
          const v = it[l.campo || "promedio"];
          const x = diario ? it.numeroDia : it.numeroSemana;
          if (v === null || v === undefined || x == null) continue;
          let fila = porSemana.get(x);
          if (!fila) {
            fila = diario
              ? { numeroDia: x, etiqueta: `${it.fecha.slice(8, 10)}/${it.fecha.slice(5, 7)}`, fechaTexto: it.fecha }
              : { numeroSemana: x, etiqueta: `S${x}` };
            porSemana.set(x, fila);
          }
          fila[dataKey] = Number(v);
          if (nSeries === 1) {
            fila.semanaCodigo = it.semanaCodigo;
            fila.semanaUuid = it.semanaUuid;
            if (l.extra) {
              const e = l.extra(it);
              if (e) fila[`${dataKey}|extra`] = e;
            }
          }
        }
      });
    });
    const campoX = diario ? "numeroDia" : "numeroSemana";
    return { filas: [...porSemana.values()].sort((a, b) => a[campoX] - b[campoX]), claves };
  }, [resultados, lineasEfectivas, diario]);

  const soloUna = resultados.length === 1;
  const unica = soloUna ? resultados[0].serie : null;
  const precip = usePrecipitacionOverlay({ fincaUuid: unica ? unica.fincaUuids.join(",") : "", anio: unica ? unica.anio : new Date().getFullYear() });
  const mostrarPrecip = precipitacion && soloUna && !diario;
  const filasConPrecip = mostrarPrecip ? conPrecipitacion(filas, precip.precipPorSemana) : filas;
  const filasVisibles = filtrarSemanas(filasConPrecip, rangoSemanas, diario ? "numeroDia" : "numeroSemana");
  const eje = ejeAjustado ? calcularEje(filasVisibles.flatMap((f) => claves.map((c) => f[c.dataKey]))) : null;

  if (ocultarSiVacio && !loading && !error && filas.length === 0) return null;

  const subtitulo = series.length === 1 ? series[0].label : `${series.length} series`;

  return (
    <CollapsibleCard titulo={titulo} subtitulo={subtitulo} info={info} acciones={acciones} filtrosExpandido={filtrosExpandido} colapsable={false} expandible className="mb-3">
      {mostrarPrecip && <PrecipitacionControls {...precip} />}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando promedios...</p>}
      {!loading && !error && filas.length === 0 && <p className="text-secondary small py-4 text-center mb-0">{mensajeVacio}</p>}

      {!loading && !error && filas.length > 0 && (
        <>
          <div className="grafico-alto" style={{ height: alto }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filasVisibles}
                margin={{ top: 8, right: 12, left: -6, bottom: 4 }}
                onClick={onPuntoClick && soloUna ? (e) => e?.activePayload?.[0]?.payload && onPuntoClick(e.activePayload[0].payload) : undefined}
                style={onPuntoClick && soloUna ? { cursor: "pointer" } : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} interval={!diario && rangoSemanas && rangoSemanas[1] - rangoSemanas[0] < 20 ? 0 : "preserveStartEnd"} minTickGap={diario ? 28 : 12} />
                <YAxis tick={{ fontSize: 10 }} width={44} allowDecimals unit={yUnit} domain={eje ? eje.domain : yDomain || ["auto", "auto"]} ticks={eje?.ticks} />
                <Tooltip cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} content={<TooltipSemanal formato={formato} diario={diario} />} />
                {limites.map((l) => (
                  <ReferenceLine
                    key={l.valor}
                    y={l.valor}
                    stroke={l.color || "#dc2626"}
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{ value: yUnit ? `${l.valor}${yUnit}` : String(l.valor), position: "right", fill: l.color || "#dc2626", fontSize: 11, fontWeight: 600 }}
                  />
                ))}
                {claves.map((c) => (
                  <Line
                    key={c.dataKey}
                    type="monotone"
                    dataKey={c.dataKey}
                    name={c.name}
                    stroke={c.color}
                    strokeWidth={2}
                    strokeDasharray={c.dash}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
                {mostrarPrecip && <PrecipitacionSerie activo={precip.activo} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="d-flex flex-wrap justify-content-center gap-3 mt-1 small">
            {claves.map((c) => (
              <span key={c.dataKey} className="d-inline-flex align-items-center gap-1">
                <span className="d-inline-block rounded-circle" style={{ width: 10, height: 10, backgroundColor: c.color }} />
                {c.name}
              </span>
            ))}
          </div>
          <RangoSemanasSlider value={rangoSemanas} onChange={setRangoSemanas} max={diario ? 366 : 53} rotulo={diario ? "Días" : "Semanas"} />
          {ayuda && <p className="text-secondary mb-0" style={{ fontSize: "0.7rem" }}>{ayuda}</p>}
        </>
      )}
    </CollapsibleCard>
  );
}
