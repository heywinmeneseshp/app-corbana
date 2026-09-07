"use client";

// Página de reporte genérica para una sola métrica anual del dashboard
// (Cajas Producidas / Ratio / Aprovechamiento) — mismo endpoint y forma de
// datos que ya usa el Dashboard (`/dashboard/resumen`), pero como página
// dedicada dentro de Reportes con su propio filtro de finca/año, en vez de
// mezclada con el resto de tarjetas del Inicio.
//
// Cada "canasta" (ver SelectorCanastas) es un grupo de fincas/grupos que se
// suman entre sí — una canasta sola es la selección de siempre (agregada);
// 2+ canastas comparan sus agregados entre sí, cada una como su propia
// línea, multiplicado además por cada año marcado.
//
// Dos modos:
// - Selección simple (1 sola canasta Y 0 o 1 año, el caso normal): una
//   sola línea, con ranking de fincas y variación semanal (igual que antes).
// - Comparación (2+ canastas y/o 2+ años marcados): una línea por cada
//   combinación canasta × año — se pierden el ranking y la variación
//   semanal (no tienen un único punto de referencia con qué armarse), a
//   cambio de superponer las series elegidas en el mismo gráfico.
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import ReportesTabs from "@/components/ReportesTabs";
import SelectorCanastas from "@/components/reportes/SelectorCanastas";
import CollapsibleCard from "@/components/reportes/CollapsibleCard";
import SortableTh, { ordenarFilas } from "@/components/reportes/SortableTh";
import SemanaAutocomplete from "@/components/SemanaAutocomplete";

const SERIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

function ChartTooltip({ active, payload, label, decimal, semanaCodigoPorNumero }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border rounded-3 shadow-sm p-2 small">
      <div className="fw-semibold mb-1">{semanaCodigoPorNumero?.get(label) || `Semana ${label}`}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="d-flex align-items-center gap-2">
          <span style={{ color: entry.color }}>●</span>
          <span>{entry.name}:</span>
          <span className="fw-bold">
            {entry.value == null ? "—" : decimal ? entry.value : Number(entry.value).toLocaleString("es")}
          </span>
        </div>
      ))}
    </div>
  );
}

function VariacionBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-secondary">—</span>;
  const positiva = pct > 0;
  const neutra = pct === 0;
  const color = neutra ? "#64748b" : positiva ? "#16a34a" : "#dc2626";
  return (
    <span className="d-inline-flex align-items-center gap-1 fw-semibold" style={{ color }}>
      {!neutra && (positiva ? <FiTrendingUp size={13} /> : <FiTrendingDown size={13} />)}
      {positiva ? "+" : ""}
      {pct}%
    </span>
  );
}

export default function MetricaAnualChart({
  permCode,
  icon: Icon,
  titulo,
  subtitulo,
  arrayField,
  metricKey,
  color,
  decimal = false,
  prefix,
  yDomain,
  yUnit,
  referenceLineAt,
  rankingArrayField,
  rankingMetricKey,
  rankingUnit,
  rankingMostrarParticipacion = false,
  rankingSemanalKey,
}) {
  const [fincas, setFincas] = useState([]);
  const [canastas, setCanastas] = useState([{ id: "c0", nombre: "", objetivos: [], anios: [] }]);
  const [semanas, setSemanas] = useState([]);
  const [semanaUuid, setSemanaUuid] = useState("");
  const [data, setData] = useState(null); // modo simple
  const [seriesData, setSeriesData] = useState(null); // modo comparación
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const anioActual = new Date().getFullYear();
  const anioOpciones = [];
  for (let i = anioActual - 5; i <= anioActual; i++) anioOpciones.push(i);

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch((err) => setError(err.message));
    (async () => {
      try {
        let page = 1;
        let todas = [];
        while (true) {
          const res = await apiFetch(`/semanas?limit=100&page=${page}`);
          todas = todas.concat(res.items || []);
          if (page >= (res.meta?.totalPages || 1)) break;
          page += 1;
        }
        setSemanas(todas);
      } catch {
        // no bloquea el resto de la pantalla
      }
    })();
  }, []);

  // Cada canasta se agrega internamente (unión de fincaIds de todo lo que
  // tenga adentro) y se convierte en un solo "objetivo" — igual que ya hacía
  // un Grupo de Finca (varias fincas bajo un solo id de serie), solo que
  // armado al vuelo con lo que el usuario haya puesto en esa canasta. El
  // año (o años) ahora vive DENTRO de cada canasta, no en un selector
  // global — así se puede comparar "Zona Norte 2024" contra "Zona Norte
  // 2026" sin que la otra canasta herede años que no le tocan.
  const objetivosEfectivos = useMemo(() => {
    return canastas.map((c, i) => {
      const fincaIds = [...new Set(c.objetivos.flatMap((o) => o.fincaIds || []))];
      const nombreAuto =
        c.objetivos.length === 0
          ? "Todas las fincas"
          : c.objetivos.length === 1
            ? c.objetivos[0].nombre
            : c.objetivos.length <= 3
              ? c.objetivos.map((o) => o.nombre).join(" + ")
              : `${c.objetivos.length} seleccionados`;
      return {
        tipo: "canasta",
        uuid: c.id,
        nombre: c.nombre?.trim() || (canastas.length > 1 ? `Selección ${i + 1}` : nombreAuto),
        fincaIds,
        anios: c.anios.length > 0 ? c.anios : [anioActual],
      };
    });
  }, [canastas, anioActual]);

  // Serie efectiva: cada combinación canasta × su(s) propio(s) año(s).
  // Sin nada marcado, es una sola serie ("todas las fincas", año actual) —
  // el comportamiento de siempre.
  const seriesList = useMemo(() => {
    const aniosDistintos = new Set(objetivosEfectivos.flatMap((o) => o.anios));
    const out = [];
    for (const obj of objetivosEfectivos) {
      for (const anio of obj.anios) {
        out.push({
          key: `${obj.tipo}-${obj.uuid}-${anio}`,
          obj,
          anio,
          label: aniosDistintos.size > 1 || objetivosEfectivos.length > 1
            ? `${obj.nombre}${aniosDistintos.size > 1 ? ` ${anio}` : ""}`
            : obj.nombre,
        });
      }
    }
    return out;
  }, [objetivosEfectivos]);

  const modoComparacion = seriesList.length > 1;

  useEffect(() => {
    setLoading(true);
    setError("");

    if (!modoComparacion) {
      const serie = seriesList[0];
      const params = new URLSearchParams();
      if (serie.obj.fincaIds?.length > 0) params.set("fincas", serie.obj.fincaIds.join(","));
      params.set("anio", String(serie.anio));
      if (semanaUuid) params.set("semanaUuid", semanaUuid);
      apiFetch(`/dashboard/resumen?${params.toString()}`)
        .then((res) => {
          setData(res);
          setSeriesData(null);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
      return;
    }

    Promise.all(
      seriesList.map((serie) => {
        const params = new URLSearchParams();
        if (serie.obj.fincaIds?.length > 0) params.set("fincas", serie.obj.fincaIds.join(","));
        params.set("anio", String(serie.anio));
        return apiFetch(`/dashboard/resumen?${params.toString()}`).then((res) => ({ serie, res }));
      }),
    )
      .then((resultados) => {
        setSeriesData(resultados);
        setData(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [seriesList, semanaUuid, modoComparacion]);

  // --- Modo simple: igual que antes ---
  const puntos = useMemo(() => data?.[arrayField] || [], [data, arrayField]);
  const hayDatosSimple = useMemo(() => puntos.some((p) => p[metricKey] !== null && p[metricKey] !== undefined), [puntos, metricKey]);

  const rankingSinOrdenar = useMemo(() => {
    const filas = data?.[rankingArrayField] || [];
    return filas.filter((f) => f[rankingMetricKey] !== null && f[rankingMetricKey] !== undefined);
  }, [data, rankingArrayField, rankingMetricKey]);

  const totalRanking = useMemo(
    () => (rankingMostrarParticipacion ? rankingSinOrdenar.reduce((acc, f) => acc + (f[rankingMetricKey] || 0), 0) : 0),
    [rankingSinOrdenar, rankingMetricKey, rankingMostrarParticipacion],
  );

  const variacionSemanalPorFinca = useMemo(() => {
    const map = new Map();
    for (const f of data?.rankingSemanal?.fincas || []) map.set(f.fincaId, f[rankingSemanalKey]);
    return map;
  }, [data, rankingSemanalKey]);

  const [sortRanking, setSortRanking] = useState({ field: "metrica", dir: "desc" });
  function handleSortRanking(field) {
    setSortRanking((prev) => (prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" }));
  }

  const ranking = useMemo(() => {
    const accesores = {
      nombre: (f) => f.nombre,
      metrica: (f) => f[rankingMetricKey],
      participacion: (f) => (totalRanking > 0 ? f[rankingMetricKey] / totalRanking : null),
      actual: (f) => variacionSemanalPorFinca.get(f.fincaId)?.actual ?? null,
      anterior: (f) => variacionSemanalPorFinca.get(f.fincaId)?.anterior ?? null,
      variacion: (f) => variacionSemanalPorFinca.get(f.fincaId)?.variacionPct ?? null,
    };
    const getValue = accesores[sortRanking.field] || accesores.metrica;
    return ordenarFilas(rankingSinOrdenar, sortRanking, getValue);
  }, [rankingSinOrdenar, sortRanking, totalRanking, variacionSemanalPorFinca, rankingMetricKey]);

  // --- Modo comparación: mezcla las series por numeroSemana ---
  const { chartDataComparacion, semanaCodigoPorNumero } = useMemo(() => {
    if (!seriesData) return { chartDataComparacion: [], semanaCodigoPorNumero: new Map() };
    const porSemana = new Map();
    const codigos = new Map();
    for (const { serie, res } of seriesData) {
      for (const p of res[arrayField] || []) {
        if (!porSemana.has(p.numeroSemana)) porSemana.set(p.numeroSemana, { numeroSemana: p.numeroSemana });
        porSemana.get(p.numeroSemana)[serie.key] = p[metricKey];
        if (!codigos.has(p.numeroSemana)) codigos.set(p.numeroSemana, p.semanaCodigo);
      }
    }
    return {
      chartDataComparacion: [...porSemana.values()].sort((a, b) => a.numeroSemana - b.numeroSemana),
      semanaCodigoPorNumero: codigos,
    };
  }, [seriesData, arrayField, metricKey]);

  const hayDatosComparacion = chartDataComparacion.some((fila) => seriesList.some((s) => fila[s.key] != null));

  return (
    <RequirePermission code={permCode}>
      <div className="p-4 p-md-5">
        <ReportesTabs />
        <div className="mb-3">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <Icon /> {titulo}
          </h1>
          <p className="text-secondary mb-0">{subtitulo}</p>
        </div>

        <div className="mb-4 d-flex flex-wrap align-items-end gap-2">
          <SelectorCanastas fincas={fincas} anioOpciones={anioOpciones} canastas={canastas} onChange={setCanastas} />
          {!modoComparacion && (
            <div>
              <label className="form-label small fw-medium mb-1">Semana (para variación)</label>
              <SemanaAutocomplete
                semanas={semanas}
                value={semanaUuid}
                onChange={setSemanaUuid}
                placeholder="Más reciente"
                width="9rem"
                limit={50}
              />
            </div>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {modoComparacion && (
          <p className="text-secondary small mb-2">
            Comparando {seriesList.length} series — el ranking y la variación semanal solo se muestran con una sola
            selección.
          </p>
        )}

        <CollapsibleCard titulo={titulo} subtitulo={modoComparacion ? "Comparación entre selecciones" : undefined}>
        <div style={{ height: modoComparacion ? "460px" : "420px" }}>
          {loading && !data && !seriesData && <p className="text-secondary text-center py-5">Cargando...</p>}

          {!modoComparacion && !loading && !hayDatosSimple && (
            <p className="text-secondary text-center py-5">
              No hay datos de {titulo.toLowerCase()} para el año {seriesList[0]?.anio}.
            </p>
          )}
          {!modoComparacion && hayDatosSimple && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={puntos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="numeroSemana" tick={{ fontSize: 11 }} domain={[1, 53]} ticks={[1, 10, 20, 30, 40, 50]} />
                <YAxis tick={{ fontSize: 11 }} width={45} domain={yDomain || ["auto", "auto"]} unit={yUnit || ""} />
                <Tooltip
                  content={
                    <ChartTooltip
                      decimal={decimal}
                      semanaCodigoPorNumero={new Map(puntos.map((p) => [p.numeroSemana, p.semanaCodigo]))}
                    />
                  }
                />
                {referenceLineAt != null && <ReferenceLine y={referenceLineAt} stroke="#b45309" strokeDasharray="3 3" />}
                <Line
                  type="monotone"
                  dataKey={metricKey}
                  name={prefix}
                  stroke={color}
                  strokeWidth={2}
                  dot={(p) =>
                    p.payload?.[metricKey] != null ? (
                      <circle cx={p.cx} cy={p.cy} r={3} fill={color} stroke="#374151" strokeWidth={1} />
                    ) : null
                  }
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {modoComparacion && !loading && !hayDatosComparacion && (
            <p className="text-secondary text-center py-5">No hay datos para las series seleccionadas.</p>
          )}
          {modoComparacion && hayDatosComparacion && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataComparacion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="numeroSemana" tick={{ fontSize: 11 }} domain={[1, 53]} ticks={[1, 10, 20, 30, 40, 50]} />
                <YAxis tick={{ fontSize: 11 }} width={45} domain={yDomain || ["auto", "auto"]} unit={yUnit || ""} />
                <Tooltip content={<ChartTooltip decimal={decimal} semanaCodigoPorNumero={semanaCodigoPorNumero} />} />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                {referenceLineAt != null && <ReferenceLine y={referenceLineAt} stroke="#b45309" strokeDasharray="3 3" />}
                {seriesList.map((serie, i) => (
                  <Line
                    key={serie.key}
                    type="monotone"
                    dataKey={serie.key}
                    name={serie.label}
                    stroke={SERIE_COLORS[i % SERIE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        </CollapsibleCard>

        {!modoComparacion && ranking.length > 0 && (
          <CollapsibleCard
            titulo={`Ranking de fincas — ${seriesList[0]?.anio}`}
            subtitulo={
              data.rankingSemanal
                ? `Variación: ${data.rankingSemanal.semana.codigo}${data.rankingSemanal.semanaAnterior ? ` vs. ${data.rankingSemanal.semanaAnterior.codigo}` : ""}`
                : undefined
            }
            className="mt-3"
          >
            <div className="table-responsive">
              <table className="table table-sm table-borderless mb-0" style={{ fontSize: "0.8125rem" }}>
                <thead>
                  <tr className="text-secondary" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    <th style={{ width: "3rem" }}>#</th>
                    <SortableTh label="Finca" field="nombre" sort={sortRanking} onSort={handleSortRanking} align="start" />
                    <SortableTh label={`${titulo} (${seriesList[0]?.anio})`} field="metrica" sort={sortRanking} onSort={handleSortRanking} />
                    {rankingMostrarParticipacion && <SortableTh label="Participación" field="participacion" sort={sortRanking} onSort={handleSortRanking} />}
                    {data.rankingSemanal && (
                      <>
                        <SortableTh label="Semana actual" field="actual" sort={sortRanking} onSort={handleSortRanking} />
                        <SortableTh label="Semana anterior" field="anterior" sort={sortRanking} onSort={handleSortRanking} />
                        <SortableTh label="Variación" field="variacion" sort={sortRanking} onSort={handleSortRanking} />
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((f, i) => {
                    const m = variacionSemanalPorFinca.get(f.fincaId);
                    return (
                      <tr key={f.fincaId} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td className="text-secondary fw-medium">{i + 1}</td>
                        <td>
                          <span className="fw-medium">{f.codigo}</span>
                          <span className="text-secondary ms-1">— {f.nombre}</span>
                        </td>
                        <td className="text-end fw-bold" style={{ color }}>
                          {decimal ? f[rankingMetricKey] : f[rankingMetricKey].toLocaleString("es")}
                          {rankingUnit || ""}
                        </td>
                        {rankingMostrarParticipacion && (
                          <td className="text-end text-secondary">
                            {totalRanking > 0 ? `${((f[rankingMetricKey] / totalRanking) * 100).toFixed(1)}%` : "—"}
                          </td>
                        )}
                        {data.rankingSemanal && (
                          <>
                            <td className="text-end fw-medium">
                              {!m || m.actual === null || m.actual === undefined
                                ? "—"
                                : `${decimal ? m.actual : m.actual.toLocaleString("es")}${rankingUnit || ""}`}
                            </td>
                            <td className="text-end text-secondary">
                              {!m || m.anterior === null || m.anterior === undefined
                                ? "—"
                                : `${decimal ? m.anterior : m.anterior.toLocaleString("es")}${rankingUnit || ""}`}
                            </td>
                            <td className="text-end">
                              <VariacionBadge pct={m?.variacionPct} />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleCard>
        )}
      </div>

      <style jsx>{`
        /* Recharts le pone el foco (borde negro del navegador) al SVG
           entero al hacerle clic a un punto o a la leyenda — es solo ruido
           visual, el resaltado real ya lo hacemos con color/tamaño. */
        :global(.recharts-wrapper:focus),
        :global(.recharts-wrapper *:focus),
        :global(.recharts-surface:focus) {
          outline: none !important;
        }
      `}</style>
    </RequirePermission>
  );
}
