"use client";

// UC (unidades calóricas) acumuladas por semana de embolse: una línea por
// semana de embolse, con la edad (semanas desde el embolse) en el eje X, y una
// tabla con las UC acumuladas a las edades que el usuario quiere comparar.
import { useEffect, useMemo, useState } from "react";
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FiThermometer } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import ReportesTabs from "@/components/ReportesTabs";
import RangoSemanasSlider from "@/components/reportes/RangoSemanasSlider";
import InfoModulo from "@/components/InfoModulo";
import { COLOR_HEX } from "@/lib/semanaColor";

const fmt = (n, d = 0) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }));

const parseEdades = (texto) =>
  [...new Set(String(texto).split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 40))].sort((a, b) => a - b);

export default function UcAcumuladasEmbolse() {
  const anioActual = new Date().getFullYear();
  const [opciones, setOpciones] = useState({ fuentes: [], bases: [14] });
  const [fuente, setFuente] = useState("");
  const [baseUc, setBaseUc] = useState("");
  const [anio, setAnio] = useState(anioActual);
  const [rango, setRango] = useState(null); // semanas de embolse [desde, hasta]; null = todas
  const [edadesTexto, setEdadesTexto] = useState("9, 10, 11, 12");
  const [verTendencia, setVerTendencia] = useState(true);
  // Resultado junto con la consulta que lo produjo: si no coincide con la actual, está cargando.
  const [res, setRes] = useState({ clave: null, data: null, error: "" });
  const [errorOpciones, setErrorOpciones] = useState("");

  useEffect(() => {
    apiFetch("/reportes/uc-embolse/opciones")
      .then((o) => {
        setOpciones(o);
        const finca = o.fuentes.find((f) => f.codigo === "204") || o.fuentes.find((f) => f.tipo === "openmeteo") || o.fuentes[0];
        setFuente(finca?.id || "");
        setBaseUc(String(o.bases?.[0] ?? 14));
      })
      .catch((e) => setErrorOpciones(e.message));
  }, []);

  const edades = useMemo(() => parseEdades(edadesTexto), [edadesTexto]);
  // Solo se calculan hasta la mayor edad pedida (mínimo 12 para que la tabla no quede vacía al escribir).
  const edadMaxNum = Math.min(40, Math.max(12, ...edades));

  const consulta = useMemo(() => {
    if (!fuente || baseUc === "") return null;
    const p = new URLSearchParams({ fuente, baseUc, anio: String(anio), edadMax: String(edadMaxNum) });
    if (rango) {
      p.set("semanaDesde", String(rango[0]));
      p.set("semanaHasta", String(rango[1]));
    }
    return p.toString();
  }, [fuente, baseUc, anio, rango, edadMaxNum]);

  useEffect(() => {
    if (!consulta) return;
    let vivo = true;
    apiFetch(`/reportes/uc-embolse?${consulta}`)
      .then((d) => vivo && setRes({ clave: consulta, data: d, error: "" }))
      .catch((e) => vivo && setRes({ clave: consulta, data: null, error: e.message }));
    return () => {
      vivo = false;
    };
  }, [consulta]);

  const cargando = consulta !== null && res.clave !== consulta;
  const data = res.data;
  const error = errorOpciones || res.error;

  // Una fila por edad, una columna por semana de embolse.
  const filas = useMemo(() => {
    if (!data) return [];
    const porEdad = new Map();
    for (const c of data.cohortes) {
      for (const p of c.puntos) {
        if (!porEdad.has(p.edad)) porEdad.set(p.edad, { edad: p.edad });
        porEdad.get(p.edad)[c.semana.codigo] = p.uc;
      }
    }
    return [...porEdad.values()].sort((a, b) => a.edad - b.edad);
  }, [data]);

  // Una fila por semana de embolse; una barra por cada edad elegida (UC acumuladas a esa edad).
  const datosBarras = useMemo(() => {
    if (!data) return [];
    return data.cohortes.map((c) => {
      const fila = { codigo: c.semana.codigo, semanaNum: c.semana.numeroSemana, colorCinta: COLOR_HEX[c.semana.color] || "#64748b" };
      for (const e of edades) {
        const p = c.puntos.find((x) => x.edad === e);
        fila[`e${e}`] = p ? p.uc : null;
        fila[`c${e}`] = p ? p.completa : false;
        fila[`s${e}`] = p ? p.semanaCosecha : null;
      }
      const semanasCosecha = edades
        .map((e) => /S(\d+)/.exec(fila[`s${e}`] || "")?.[1])
        .filter(Boolean)
        .map(Number);
      fila.cosechaTxt = semanasCosecha.length === 0 ? "" : semanasCosecha.length === 1 || semanasCosecha[0] === semanasCosecha[semanasCosecha.length - 1] ? String(semanasCosecha[0]) : `${semanasCosecha[0]}–${semanasCosecha[semanasCosecha.length - 1]}`;
      return fila;
    });
  }, [data, edades]);
  // Cada grupo lleva el color de su cinta de embolse; las edades se distinguen por la intensidad (menor edad = más claro).
  const opacidadEdad = (i, total) => (total <= 1 ? 1 : 0.35 + (0.65 * i) / (total - 1));

  const colorDe = (c) => COLOR_HEX[c.semana.color] || "#64748b";
  const opcionesAnio = [anioActual, anioActual - 1, anioActual - 2, anioActual - 3];

  return (
    <RequirePermission code="menu.reportes">
      <div className="p-3 p-md-4">
        <ReportesTabs />
        <div className="mb-3">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiThermometer /> UC por embolse
            <InfoModulo
              titulo="UC acumuladas por embolse"
              secciones={[
                { titulo: "Qué muestra", texto: "Las unidades calóricas (UC) acumuladas de cada semana de embolse a las edades que elijas. Cada grupo de barras es una semana de embolse y cada barra es una edad (por ejemplo 6, 8, 10 y 12 semanas)." },
                { titulo: "Cómo se calcula", items: [
                  "UC del día = (temperatura máxima + mínima) / 2 − la base elegida.",
                  "La edad 1 es la semana del embolse. Las UC acumuladas a edad N suman todos los días desde el inicio de la semana del embolse hasta el último día de la semana N.",
                  "El día exacto del embolse no se guarda, por eso se parte del primer día de su semana.",
                ] },
                { titulo: "Cómo usarlo", items: [
                  "Elige la fuente de clima (Open-Meteo de una finca o una estación) y la base de UC.",
                  "Escribe las edades que quieres ver en cada embolse (por ejemplo 6, 8, 10, 12): cada una es una barra en la gráfica y una columna de la tabla.",
                  "Una barra clara indica una edad todavía en curso (la semana no ha terminado); si el embolse aún no llega a esa edad, no tiene barra y la tabla dice «en curso».",
                ] },
              ]}
            />
          </h1>
          <p className="text-secondary small mb-0">Unidades calóricas acumuladas desde la semana de embolse, según su edad en semanas.</p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label small fw-medium mb-1">Fuente de clima</label>
              <select className="form-select form-select-sm rounded-3" value={fuente} onChange={(e) => setFuente(e.target.value)}>
                {opciones.fuentes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                    {f.tipo === "estacion" ? " (estación)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-1">
              <label className="form-label small fw-medium mb-1">Base UC</label>
              <select className="form-select form-select-sm rounded-3" value={baseUc} onChange={(e) => setBaseUc(e.target.value)}>
                {opciones.bases.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Año del embolse</label>
              <select className="form-select form-select-sm rounded-3" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {opcionesAnio.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-medium mb-1">Edades a ver en cada embolse (semanas)</label>
              <input type="text" className="form-control form-control-sm rounded-3" value={edadesTexto} onChange={(e) => setEdadesTexto(e.target.value)} placeholder="9, 10, 11, 12" />
            </div>
          </div>
          <div className="mt-3 px-1">
            <RangoSemanasSlider value={rango} onChange={setRango} rotulo="Semanas de embolse" />
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {cargando && <p className="text-secondary small">Calculando...</p>}
        {!cargando && data && data.cohortes.length === 0 && <p className="text-secondary small">No hay semanas de embolse para ese año y rango.</p>}

        {data && data.cohortes.length > 0 && (
          <>
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
              {edades.length === 0 ? (
                <p className="text-secondary small mb-0">Escribe al menos una edad (por ejemplo 6, 8, 10, 12) para ver las barras.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: Math.max(0, datosBarras.length * (edades.length * 7 + 6)) }}>
                    <ResponsiveContainer width="100%" height={380}>
                      <ComposedChart data={datosBarras} margin={{ top: 4, right: 24, left: 0, bottom: 4 }} barCategoryGap="6%" barGap={1}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="semanaNum" tick={{ fontSize: 10 }} interval={0} height={36} label={{ value: "Semana de embolse", position: "insideBottom", offset: 0, fontSize: 11, fill: "#64748b" }} />
                        <XAxis xAxisId="cosecha" orientation="top" dataKey="cosechaTxt" tick={{ fontSize: 9 }} interval={0} angle={-50} textAnchor="start" height={50} label={{ value: "Semana de cosecha", position: "insideTop", offset: -4, fontSize: 11, fill: "#64748b" }} />
                        <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => fmt(v)} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border rounded-3 shadow-sm p-2 small">
                                <div className="fw-semibold mb-1">Embolse {d.codigo}</div>
                                {edades.map((e) => (
                                  <div key={e}>
                                    {e} sem: <strong>{d[`e${e}`] == null ? "—" : `${fmt(d[`e${e}`], 1)} UC`}</strong>
                                    {d[`s${e}`] && <span className="text-secondary"> · cosecha {d[`s${e}`]}</span>}
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        {edades.map((e, i) => (
                          <Bar key={e} dataKey={`e${e}`} name={`${e} semanas`} radius={[2, 2, 0, 0]}>
                            {datosBarras.map((d) => (
                              <Cell
                                key={d.codigo}
                                fill={d.colorCinta}
                                fillOpacity={d[`c${e}`] ? opacidadEdad(i, edades.length) : 0.15}
                                stroke={d[`c${e}`] ? "#64748b" : d.colorCinta}
                                strokeWidth={d[`c${e}`] ? 0.5 : 1}
                                strokeDasharray={d[`c${e}`] ? undefined : "3 2"}
                              />
                            ))}
                          </Bar>
                        ))}
                        {verTendencia &&
                          edades.map((e, i) => (
                            <Line
                              key={`t${e}`}
                              type="monotone"
                              dataKey={`e${e}`}
                              name={`Tendencia ${e} semanas`}
                              stroke="#334155"
                              strokeOpacity={opacidadEdad(i, edades.length)}
                              strokeWidth={1.6}
                              dot={false}
                              activeDot={false}
                              connectNulls
                              legendType="none"
                              tooltipType="none"
                            />
                          ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {edades.length > 0 && (
                <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mt-1 small text-secondary">
                  <span className="form-check mb-0">
                    <input type="checkbox" className="form-check-input" id="uc-tendencia" checked={verTendencia} onChange={(e) => setVerTendencia(e.target.checked)} />
                    <label className="form-check-label" htmlFor="uc-tendencia">
                      Línea de tendencia por edad
                    </label>
                  </span>
                  <span>Cada grupo = semana de embolse (color de su cinta). Barras de menor a mayor edad:</span>
                  {edades.map((e, i) => (
                    <span key={e} className="d-inline-flex align-items-center gap-1">
                      <span style={{ display: "inline-block", width: 12, height: 12, background: "#475569", opacity: opacidadEdad(i, edades.length), border: "1px solid #64748b" }} />
                      {e} sem
                    </span>
                  ))}
                  <span className="d-inline-flex align-items-center gap-1">
                    <span style={{ display: "inline-block", width: 12, height: 12, border: "1px dashed #64748b" }} /> en curso
                  </span>
                </div>
              )}
            </div>

            {edades.length > 0 && (
              <div className="card border-0 shadow-sm rounded-4 p-3">
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0 small align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Semana de embolse</th>
                        {edades.map((e) => (
                          <th key={e} className="text-end">
                            {e} semanas
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.cohortes.map((c) => (
                        <tr key={c.semana.uuid}>
                          <td className="fw-medium">
                            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: colorDe(c), marginRight: 8 }} />
                            {c.semana.codigo} <span className="text-secondary">· {c.semana.color}</span>
                          </td>
                          {edades.map((e) => {
                            const p = c.puntos.find((x) => x.edad === e);
                            return (
                              <td key={e} className="text-end">
                                {p ? (
                                  <>
                                    <span title={p.diasConDato < p.dias ? `Faltan datos de clima: ${p.diasConDato} de ${p.dias} días en esa semana` : undefined} className={p.diasConDato < p.dias ? "text-warning" : ""}>
                                      {fmt(p.uc, 0)}
                                    </span>
                                    {p.semanaCosecha && <div className="text-secondary" style={{ fontSize: "0.7rem" }}>cosecha {p.semanaCosecha}</div>}
                                  </>
                                ) : (
                                  <span className="text-secondary">en curso</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-secondary mb-0 mt-2" style={{ fontSize: "0.72rem" }}>
                  Base {data.base}. Un valor en amarillo indica días sin dato de clima en esa semana.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </RequirePermission>
  );
}
