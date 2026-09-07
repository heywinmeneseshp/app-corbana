"use client";

// Página de reporte genérica para un tipo de movimiento de racimos (hoy:
// Embolse y Repique) por semana, comparativa multi-año — mismo endpoint
// (`/racimo-movimientos/reporte-embolses`, parametrizado por `tipo`) para
// no duplicar backend ni frontend entre "Gráfico de Embolses" y "Gráfico
// de Repiques".
//
// Cross-filtering estilo Power BI (solo en modo simple, 1 sola selección):
// clic en un punto del gráfico → filtra la página por esa semana; clic en
// una barra de motivo → filtra por ese motivo; clic en una finca de la
// tabla → filtra la página a esa sola finca. Un segundo clic sobre lo mismo
// lo destildá (toggle).
import { useEffect, useMemo, useState } from "react";
import { FiTrendingUp, FiTrendingDown, FiX } from "react-icons/fi";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, LabelList,
} from "recharts";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import ReportesTabs from "@/components/ReportesTabs";
import SelectorCanastas from "@/components/reportes/SelectorCanastas";
import CollapsibleCard from "@/components/reportes/CollapsibleCard";
import SortableTh, { ordenarFilas } from "@/components/reportes/SortableTh";
import SemanaAutocomplete from "@/components/SemanaAutocomplete";
import { COLOR_HEX } from "@/lib/semanaColor";

const YEAR_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
const SERIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

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

// Igual que pivotData, pero mezclando N series (objetivo × año) en vez de
// solo años — usado en modo comparación (2+ fincas/grupos elegidos).
function pivotSeries(seriesData) {
  const porSemana = new Map();
  for (const { serie, puntos } of seriesData) {
    for (const p of puntos) {
      if (!porSemana.has(p.numeroSemana)) porSemana.set(p.numeroSemana, { numeroSemana: p.numeroSemana });
      porSemana.get(p.numeroSemana)[serie.key] = p.totalEmbolsado;
    }
  }
  return [...porSemana.values()].sort((a, b) => a.numeroSemana - b.numeroSemana);
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

function TooltipPersonalizado({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border rounded-3 shadow-sm p-2 small">
      <div className="fw-semibold mb-1">Semana {label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="d-flex align-items-center gap-2">
          <span style={{ color: entry.color }}>●</span>
          <span>{entry.name || entry.dataKey}:</span>
          <span className="fw-bold">{entry.value?.toLocaleString("es") ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

export default function GraficoMovimientoAnual({
  permCode,
  icon: Icon,
  titulo,
  subtitulo,
  tipo,
  colorPrincipal,
  etiquetaMetrica,
  // Repique trae desglose por motivo (gráfico de barras clicable); Embolse
  // no tiene motivo, así que este bloque va oculto por defecto.
  mostrarMotivos = false,
}) {
  const [fincas, setFincas] = useState([]);
  const [canastas, setCanastas] = useState([{ id: "c0", nombre: "", objetivos: [], anios: [new Date().getFullYear()] }]);
  const [semanas, setSemanas] = useState([]);
  const [semanaUuid, setSemanaUuid] = useState("");
  const [motivosUuids, setMotivosUuids] = useState([]);
  const [sortRanking, setSortRanking] = useState({ field: "total", dir: "desc" });
  const [data, setData] = useState(null); // modo simple (0-1 objetivo)
  const [seriesResultado, setSeriesResultado] = useState(null); // modo comparación (2+ objetivos)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const anioActual = new Date().getFullYear();
  const anioOpciones = [];
  for (let i = anioActual - 5; i <= anioActual; i++) {
    anioOpciones.push(i);
  }

  // Cada canasta se agrega internamente (unión de fincaUuids de todo lo que
  // tenga adentro) y se convierte en un solo "objetivo" — igual que ya hacía
  // un Grupo de Finca, solo que armado al vuelo con lo que el usuario haya
  // puesto en esa canasta. El año (o años) vive DENTRO de cada canasta, no
  // en un selector global. Con 1 sola canasta, se comporta como el filtro
  // simple de siempre; con 2+, cada una es su propia línea (o líneas, si
  // tiene varios años) a comparar.
  const objetivosEfectivos = useMemo(() => {
    return canastas.map((c, i) => {
      const fincaUuids = [...new Set(c.objetivos.flatMap((o) => o.fincaUuids || []))];
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
        fincaUuids,
        anios: c.anios.length > 0 ? c.anios : [anioActual],
      };
    });
  }, [canastas, anioActual]);

  const modoComparacion = objetivosEfectivos.length > 1;

  async function handleConsultar() {
    setError("");
    setLoading(true);
    try {
      if (objetivosEfectivos.length <= 1) {
        const objetivo = objetivosEfectivos[0];
        const params = new URLSearchParams({ anios: objetivo.anios.join(","), tipo });
        if (objetivo?.fincaUuids?.length > 0) params.set("fincaUuids", objetivo.fincaUuids.join(","));
        if (semanaUuid) params.set("semanaUuid", semanaUuid);
        if (motivosUuids.length > 0) params.set("motivoUuids", motivosUuids.join(","));
        const res = await apiFetch(`/racimo-movimientos/reporte-embolses?${params.toString()}`);
        setData(res);
        setSeriesResultado(null);
      } else {
        const resultados = await Promise.all(
          objetivosEfectivos.map(async (objetivo) => {
            const params = new URLSearchParams({ anios: objetivo.anios.join(","), tipo });
            if (objetivo.fincaUuids?.length > 0) params.set("fincaUuids", objetivo.fincaUuids.join(","));
            const res = await apiFetch(`/racimo-movimientos/reporte-embolses?${params.toString()}`);
            return { objetivo, res };
          }),
        );
        setSeriesResultado(resultados);
        setData(null);
      }
    } catch (err) {
      setError(err.message);
      setData(null);
      setSeriesResultado(null);
    } finally {
      setLoading(false);
    }
  }

  // Incluye los fincaUuids y años de cada canasta (no solo su id) — el id de
  // una canasta no cambia al editar lo que tiene adentro, así que solo el
  // tipo/uuid no alcanzaría para disparar un refetch.
  const objetivosKey = objetivosEfectivos.map((o) => `${o.uuid}:${(o.fincaUuids || []).join("-")}:${o.anios.join("-")}`).join(",");
  const motivosKey = motivosUuids.join(",");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleConsultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivosKey, semanaUuid, motivosKey, tipo]);

  // Al cambiar de finca/grupo/año, los motivos elegidos pueden ya no existir
  // en el nuevo alcance — se limpian para no dejar un filtro fantasma.
  useEffect(() => {
    setMotivosUuids([]);
  }, [objetivosKey]);

  // Clic en una barra de motivo: sin Ctrl/Cmd, reemplaza la selección por
  // esa sola barra (o la destilda si ya era la única marcada); con
  // Ctrl/Cmd, la agrega o la saca del conjunto — para poder filtrar por
  // varios motivos a la vez.
  function handleClickMotivo(uuid, event) {
    const multiple = event?.ctrlKey || event?.metaKey;
    setMotivosUuids((prev) => {
      if (multiple) {
        return prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid];
      }
      return prev.length === 1 && prev[0] === uuid ? [] : [uuid];
    });
  }

  // Clic en una finca de la tabla de ranking: reemplaza la selección
  // actual por esa sola finca — mismo efecto que elegirla a mano en
  // SelectorCanastas, filtrando toda la página (Power BI-style).
  function filtrarPorFinca(fincaId) {
    const finca = fincas.find((f) => f.id === fincaId);
    if (!finca) return;
    setCanastas([{
      id: "c0",
      nombre: "",
      objetivos: [{ tipo: "finca", uuid: finca.uuid, nombre: finca.nombre, fincaUuids: [finca.uuid] }],
      anios: canastas[0]?.anios?.length > 0 ? canastas[0].anios : [anioActual],
    }]);
  }

  function handleSortRanking(field) {
    setSortRanking((prev) => (prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" }));
  }

  const chartData = data ? pivotData(data.anios) : [];

  const totalRanking = (data?.rankingFincas || []).reduce((acc, f) => acc + f.totalEmbolsado, 0);
  const variacionPorFinca = new Map((data?.rankingSemanal?.fincas || []).map((f) => [f.fincaId, f]));

  const ranking = useMemo(() => {
    const filas = data?.rankingFincas || [];
    const accesores = {
      nombre: (f) => f.nombre,
      total: (f) => f.totalEmbolsado,
      participacion: (f) => (totalRanking > 0 ? f.totalEmbolsado / totalRanking : null),
      actual: (f) => variacionPorFinca.get(f.fincaId)?.actual ?? null,
      anterior: (f) => variacionPorFinca.get(f.fincaId)?.anterior ?? null,
      variacion: (f) => variacionPorFinca.get(f.fincaId)?.variacionPct ?? null,
    };
    const getValue = accesores[sortRanking.field] || accesores.total;
    return ordenarFilas(filas, sortRanking, getValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sortRanking, totalRanking]);

  // Modo comparación: una serie por objetivo × año (cada canasta puede
  // traer más de un año).
  const seriesList = useMemo(() => {
    if (!seriesResultado) return [];
    const aniosDistintos = new Set(objetivosEfectivos.flatMap((o) => o.anios));
    const out = [];
    for (const { objetivo, res } of seriesResultado) {
      for (const a of res.anios) {
        out.push({
          key: `${objetivo.tipo}-${objetivo.uuid}-${a.anio}`,
          label: aniosDistintos.size > 1 ? `${objetivo.nombre} ${a.anio}` : objetivo.nombre,
          puntos: a.puntos,
        });
      }
    }
    return out;
  }, [seriesResultado, objetivosEfectivos]);

  const chartDataComparacion = useMemo(
    () => pivotSeries(seriesResultado ? seriesList.map((s) => ({ serie: s, puntos: s.puntos })) : []),
    [seriesResultado, seriesList],
  );

  // Embolse colorea cada punto según la cinta a la que pertenece esa
  // semana (tiene sentido: cada semana ES una cinta de embolse). El resto
  // de los tipos (ej. Repique) ya no se ven "por cinta" — se agrupan por
  // semana de registro — así que el punto va de un solo color, el de la
  // línea, sin la variación de colores de cinta.
  const usarColorPorCinta = tipo === "EMBOLSE";

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
              <label className="form-label small fw-medium mb-1">Semana (filtro)</label>
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
            Comparando {objetivosEfectivos.length} selecciones — el ranking, la variación semanal y los motivos solo
            se muestran con una sola.
          </p>
        )}
        {!modoComparacion && (semanaUuid || motivosUuids.length > 0) && (
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="text-secondary small">Filtros activos:</span>
            {semanaUuid && (
              <button type="button" className="btn btn-sm btn-brand rounded-pill d-flex align-items-center gap-1" onClick={() => setSemanaUuid("")}>
                Semana: {semanas.find((s) => s.uuid === semanaUuid)?.codigo || "—"} <FiX size={12} />
              </button>
            )}
            {motivosUuids.map((uuid) => (
              <button
                key={uuid}
                type="button"
                className="btn btn-sm btn-brand rounded-pill d-flex align-items-center gap-1"
                onClick={() => setMotivosUuids((prev) => prev.filter((u) => u !== uuid))}
              >
                Motivo: {data?.motivosRepique?.find((m) => m.uuid === uuid)?.nombre || "—"} <FiX size={12} />
              </button>
            ))}
          </div>
        )}

        {loading && !data && !seriesResultado && <p className="text-secondary">Cargando...</p>}

        {!modoComparacion && data && (
          <>
            <CollapsibleCard titulo="Gráfico" subtitulo={etiquetaMetrica + " por semana"}>
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
                    const colorAnio = YEAR_COLORS[i % YEAR_COLORS.length];
                    return (
                      <Line
                        key={a.anio}
                        type="monotone"
                        dataKey={yearKey}
                        stroke={colorAnio}
                        strokeWidth={2}
                        dot={(dotProps) => {
                          if (dotProps.payload[yearKey] === null) return null;
                          const p = puntosAnio.find((x) => x.numeroSemana === dotProps.payload.numeroSemana);
                          const colorHex = usarColorPorCinta ? COLOR_HEX[p?.color] || colorAnio : colorAnio;
                          const activo = p?.uuid && p.uuid === semanaUuid;
                          return (
                            <circle
                              key={`${yearKey}-${dotProps.payload.numeroSemana}`}
                              cx={dotProps.cx}
                              cy={dotProps.cy}
                              r={activo ? 6 : 4}
                              fill={colorHex}
                              stroke={activo ? "#111827" : "#374151"}
                              strokeWidth={activo ? 2 : 1}
                              style={{ cursor: p?.uuid ? "pointer" : "default" }}
                              onClick={() => p?.uuid && setSemanaUuid(p.uuid === semanaUuid ? "" : p.uuid)}
                            />
                          );
                        }}
                        activeDot={(dotProps) => {
                          if (dotProps.payload[yearKey] === null) return null;
                          const p = puntosAnio.find((x) => x.numeroSemana === dotProps.payload.numeroSemana);
                          const colorHex = usarColorPorCinta ? COLOR_HEX[p?.color] || colorAnio : colorAnio;
                          return (
                            <circle
                              cx={dotProps.cx}
                              cy={dotProps.cy}
                              r={6}
                              fill={colorHex}
                              stroke="#374151"
                              strokeWidth={2}
                              style={{ cursor: "pointer" }}
                              onClick={() => p?.uuid && setSemanaUuid(p.uuid === semanaUuid ? "" : p.uuid)}
                            />
                          );
                        }}
                        connectNulls={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </CollapsibleCard>

            {mostrarMotivos && data.motivosRepique?.length > 0 && (
              <CollapsibleCard
                titulo="Por motivo"
                subtitulo="Clic para filtrar por ese motivo — Ctrl/Cmd+clic para marcar varios."
                className="mt-3"
              >
                <ResponsiveContainer width="100%" height={Math.max(220, data.motivosRepique.length * 32)}>
                  <BarChart data={data.motivosRepique} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString("es")} />
                    <Bar
                      dataKey="total"
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(entry, _index, event) => handleClickMotivo(entry.uuid, event)}
                    >
                      {data.motivosRepique.map((m) => (
                        <Cell
                          key={m.uuid}
                          fill={YEAR_COLORS[0]}
                          fillOpacity={motivosUuids.length === 0 || motivosUuids.includes(m.uuid) ? 1 : 0.35}
                        />
                      ))}
                      <LabelList
                        dataKey="total"
                        position="right"
                        formatter={(v) => Number(v).toLocaleString("es")}
                        style={{ fontSize: "0.7rem", fill: "#374151", fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CollapsibleCard>
            )}

            {ranking.length > 0 && (() => {
              const subtituloRanking = data.rankingSemanal
                ? `Variación: ${data.rankingSemanal.semana.codigo}${data.rankingSemanal.semanaAnterior ? ` vs. ${data.rankingSemanal.semanaAnterior.codigo}` : ""}`
                : undefined;
              return (
                <CollapsibleCard
                  titulo={`Ranking de fincas — ${data.anios.map((a) => a.anio).join(", ")}`}
                  subtitulo={subtituloRanking}
                  className="mt-3"
                >
                  <div className="table-responsive">
                    <table className="table table-sm table-borderless mb-0" style={{ fontSize: "0.8125rem" }}>
                      <thead>
                        <tr className="text-secondary" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          <th style={{ width: "3rem" }}>#</th>
                          <SortableTh label="Finca" field="nombre" sort={sortRanking} onSort={handleSortRanking} align="start" />
                          <SortableTh label={`${etiquetaMetrica} (${data.anios.map((a) => a.anio).join(", ")})`} field="total" sort={sortRanking} onSort={handleSortRanking} />
                          <SortableTh label="Participación" field="participacion" sort={sortRanking} onSort={handleSortRanking} />
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
                          const m = variacionPorFinca.get(f.fincaId);
                          return (
                            <tr
                              key={f.fincaId}
                              style={{ borderTop: "1px solid #e2e8f0", cursor: "pointer" }}
                              onClick={() => filtrarPorFinca(f.fincaId)}
                              title="Filtrar toda la página por esta finca"
                            >
                              <td className="text-secondary fw-medium">{i + 1}</td>
                              <td>
                                <span className="fw-medium">{f.codigo}</span>
                                <span className="text-secondary ms-1">— {f.nombre}</span>
                              </td>
                              <td className="text-end fw-bold" style={{ color: colorPrincipal }}>
                                {f.totalEmbolsado.toLocaleString("es")}
                              </td>
                              <td className="text-end text-secondary">
                                {totalRanking > 0 ? `${((f.totalEmbolsado / totalRanking) * 100).toFixed(1)}%` : "—"}
                              </td>
                              {data.rankingSemanal && (
                                <>
                                  <td className="text-end fw-medium">{m ? m.actual.toLocaleString("es") : "—"}</td>
                                  <td className="text-end text-secondary">{m ? m.anterior.toLocaleString("es") : "—"}</td>
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
              );
            })()}
          </>
        )}

        {modoComparacion && seriesResultado && (
          <CollapsibleCard titulo="Comparación" subtitulo={etiquetaMetrica + " por semana"}>
            <ResponsiveContainer width="100%" height={460}>
              <LineChart data={chartDataComparacion} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="numeroSemana" tickFormatter={(v) => `S${v}`} tick={{ fontSize: 11 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} width={60} domain={["auto", "auto"]} />
                <Tooltip content={<TooltipPersonalizado />} />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
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
          </CollapsibleCard>
        )}

        {!data && !seriesResultado && !loading && (
          <p className="text-secondary text-center py-5">No hay datos para mostrar.</p>
        )}
      </div>

      <style jsx>{`
        .btn-brand {
          background-color: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        /* Recharts le pone el foco (borde negro del navegador) al SVG
           entero al hacerle clic a una barra o un punto — es solo ruido
           visual acá, el resaltado real ya lo hacemos con color/tamaño. */
        :global(.recharts-wrapper:focus),
        :global(.recharts-wrapper *:focus),
        :global(.recharts-surface:focus) {
          outline: none !important;
        }
      `}</style>
    </RequirePermission>
  );
}
