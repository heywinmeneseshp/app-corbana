"use client";

import { Fragment, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiColumns } from "react-icons/fi";
import GraficasFincaModal from "./GraficasFincaModal";
import PorProducto from "./PorProducto";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// La unidad de caja es la de referencia del sistema: su peso es la tasa de conversión configurada (18.6 por defecto).
const metricas = (tasa) => [
  { id: "cajas", label: `Cajas ${tasa}`, bajo: "cajasBajo", alto: "cajasAlto" },
  { id: "embolses", label: "Embolses", bajo: "embolsesBajo", alto: "embolsesAlto" },
  { id: "racimos", label: "Racimos cosechados" },
];
const COLORES = { proyeccion: "#16a34a", bajo: "#d97706", alto: "#2563eb", a1: "#64748b", a2: "#a8a29e" };

const fmt = (n) => Number(n ?? 0).toLocaleString("es", { maximumFractionDigits: 0 });
const mesDe = (fecha) => new Date(new Date(`${fecha}T00:00:00Z`).getTime() + 3 * 86400000).getUTCMonth(); // mes del jueves

// Tabla finca × semana (o finca × mes) con totales por columna y por fila.
const fmtD = (n, d) => Number(n ?? 0).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d });

// Construye las filas del cálculo de una semana. Orden: hectáreas, embolses por ha, embolses, racimos que aporta cada edad
// (embolse de la semana de origen × tasa de corte), racimos, ratio y cajas.
// `metrica` recorta el desglose a lo que lleva a esa cifra: Embolses solo hectáreas → embolses; Racimos hasta los racimos; Cajas todo.
function filasCalculo(semana, fincas, filaDe, tasa, metrica = "cajas") {
  const de = (uuid) => filaDe.get(`${uuid}|${semana}`);
  const suma = (campo) => fincas.reduce((a, f) => a + (de(f.uuid)?.[campo] || 0), 0);
  const ejemplo = fincas.map((f) => de(f.uuid)).find(Boolean);
  const edades = ejemplo ? ejemplo.detalleEdades : [];
  const sumaEdad = (idx) => fincas.reduce((a, f) => a + (de(f.uuid)?.detalleEdades?.[idx]?.racimos || 0), 0);
  const ha = suma("hectareasEfectivas");
  const emb = suma("embolses");
  const rac = suma("racimos");
  const caj = suma("cajas");

  const filas = [
    { clave: "ha", titulo: "Hectáreas en producción", celda: (u) => fmtD(de(u)?.hectareasEfectivas, 1), total: () => fmtD(ha, 1) },
    {
      clave: "ephs",
      titulo: "Embolses por ha",
      celda: (u) => fmtD(de(u)?.embolsesPorHa, 1),
      total: () => (ha > 0 ? fmtD(emb / ha, 1) : "—"),
      ayuda: () => "Embolses por hectárea de esta semana del año (promedio histórico) o real si la semana ya pasó",
    },
    { clave: "emb", titulo: "Embolses de la semana", celda: (u) => fmt(de(u)?.embolses), total: () => fmt(emb), ayuda: () => "Hectáreas × embolses por ha" },
    ...edades.map((e, idx) => ({
      clave: `edad-${e.edad}`,
      titulo: `Racimos de edad ${e.edad}${e.semanaCodigo ? ` (embolse ${e.semanaCodigo})` : ""}`,
      celda: (u) => {
        const d = de(u)?.detalleEdades?.[idx];
        return d ? fmt(d.racimos) : "—";
      },
      total: () => fmt(sumaEdad(idx)),
      ayuda: (u) => {
        const d = de(u)?.detalleEdades?.[idx];
        return d?.semanaCodigo ? `${fmt(d.embolse)} embolses de ${d.semanaCodigo}${d.embolseReal ? " (reales)" : " (proyectados)"} × ${(d.tasa * 100).toFixed(2)}% de corte a edad ${d.edad}` : "Sin embolse de origen";
      },
    })),
    { clave: "rac", titulo: "Racimos cosechados", celda: (u) => fmt(de(u)?.racimos), total: () => fmt(rac), resalta: true, ayuda: () => "Suma de los racimos de cada edad (o real si la semana ya pasó)" },
    {
      clave: "ratio",
      titulo: "Ratio (cajas por racimo)",
      celda: (u) => fmtD(de(u)?.ratio, 4),
      total: () => (rac > 0 ? fmtD(caj / rac, 4) : "—"),
      resalta: true,
      ayuda: (u) => (de(u)?.fuente === "real" ? "Ratio real de la semana" : `Promedio histórico de esta semana del año: ${de(u)?.ratioHistorico}`),
    },
    { clave: "caj", titulo: `Cajas ${tasa} = racimos × ratio`, celda: (u) => fmt(de(u)?.cajas), total: () => fmt(caj), resalta: true },
  ];
  if (metrica === "embolses") return filas.filter((f) => ["ha", "ephs", "emb"].includes(f.clave));
  if (metrica === "racimos") return filas.filter((f) => !["ratio", "caj"].includes(f.clave));
  return filas;
}

function Pivot({ resultado, metrica, periodo, ocultas, onGraficas }) {
  const { filas, porSemana } = resultado;
  const tasa = resultado.meta.tasaConversion ?? 18.6;
  // Semanas desplegadas: debajo de la semana aparecen las filas con el cálculo (ha, embolses, racimos por edad, ratio, cajas).
  const [abiertas, setAbiertas] = useState(() => new Set());
  const alternar = (clave) =>
    setAbiertas((prev) => {
      const n = new Set(prev);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  const filaDe = useMemo(() => new Map(filas.map((f) => [`${f.fincaUuid}|${f.semanaCodigo}`, f])), [filas]);
  // Filas = semanas (o meses); columnas = fincas.
  const periodos = periodo === "semana" ? porSemana.map((s) => ({ clave: s.semanaCodigo, titulo: s.semanaCodigo, real: s.real })) : MESES.map((m, i) => ({ clave: i, titulo: m }));

  const { fincas, valores, totalesFinca, totalesPeriodo } = useMemo(() => {
    const nombres = new Map(); // fincaUuid -> nombre
    const val = new Map(); // `${fincaUuid}|${clave}` -> valor
    for (const f of filas) {
      if (ocultas.has(f.fincaUuid)) continue; // columnas ocultas: no se muestran ni suman
      nombres.set(f.fincaUuid, f.fincaNombre);
      const clave = periodo === "semana" ? f.semanaCodigo : mesDe(f.fechaInicio);
      const k = `${f.fincaUuid}|${clave}`;
      val.set(k, (val.get(k) || 0) + (f[metrica] || 0));
    }
    const lista = [...nombres.entries()].map(([uuid, nombre]) => ({ uuid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    const totF = new Map();
    const totP = new Map();
    for (const [k, v] of val) {
      const [uuid, clave] = k.split("|");
      totF.set(uuid, (totF.get(uuid) || 0) + v);
      totP.set(clave, (totP.get(clave) || 0) + v);
    }
    return { fincas: lista, valores: val, totalesFinca: totF, totalesPeriodo: totP };
  }, [filas, metrica, periodo, ocultas]);

  const totalGeneral = [...totalesFinca.values()].reduce((a, b) => a + b, 0);
  // Encabezados y columna de semana/mes con color propio para distinguirlos de los datos.
  const encabezado = { background: "#166534", color: "#fff" };
  const primeraCol = "#e8f6ee";
  const pie = "#d1ecdc";

  return (
    <div className="table-responsive" style={{ maxHeight: "65vh" }}>
      <table className="table table-sm table-hover table-bordered align-middle mb-0 small" style={{ whiteSpace: "nowrap", "--bs-table-border-color": "#b9c9be" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
          <tr>
            <th style={{ position: "sticky", left: 0, ...encabezado, zIndex: 3, minWidth: periodo === "semana" ? 90 : 70 }}>{periodo === "semana" ? "Semana" : "Mes"}</th>
            {fincas.map((f) => (
              <th
                key={f.uuid}
                className="text-center"
                role="button"
                title="Clic para ver las gráficas de ratio, embolses y cajas de esta finca"
                style={{ minWidth: 92, ...encabezado, cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                onClick={() => onGraficas({ uuids: [f.uuid], titulo: `Gráficas · ${f.nombre}` })}
              >
                {f.nombre}
              </th>
            ))}
            <th
              className="text-center"
              role="button"
              title="Clic para ver las gráficas del total de las fincas visibles"
              style={{ minWidth: 100, ...encabezado, cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
              onClick={() => onGraficas({ uuids: fincas.map((f) => f.uuid), titulo: "Gráficas · Total de las fincas visibles" })}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((pr) => {
            const desplegable = periodo === "semana";
            const abierta = desplegable && abiertas.has(pr.clave);
            // Filas del cálculo de esta semana: cada una trae su valor por finca y el total de las fincas visibles.
            const detalle = abierta ? filasCalculo(pr.clave, fincas, filaDe, tasa, metrica) : [];
            // Semana desplegada: borde grueso y oscuro arriba de la semana y debajo de su última fila, para separar el bloque.
            const bordeArriba = abierta ? { borderTop: "3px solid #14532d" } : {};
            return (
              <Fragment key={pr.clave}>
                <tr
                  role={desplegable ? "button" : undefined}
                  style={desplegable ? { cursor: "pointer" } : undefined}
                  title={desplegable ? "Clic para ver cómo se calcularon las cajas de esta semana" : undefined}
                  onClick={desplegable ? () => alternar(pr.clave) : undefined}
                >
                  <td className="fw-semibold" style={{ position: "sticky", left: 0, background: primeraCol, color: "#14532d", zIndex: 1, ...bordeArriba }} title={pr.real ? "Semana real" : undefined}>
                    {desplegable && (abierta ? <FiChevronDown className="me-1" /> : <FiChevronRight className="me-1" />)}
                    {pr.titulo}
                    {pr.real ? "*" : ""}
                  </td>
                  {fincas.map((f) => (
                    <td key={f.uuid} className="text-center" style={bordeArriba}>
                      {fmt(valores.get(`${f.uuid}|${pr.clave}`))}
                    </td>
                  ))}
                  <td className="text-center fw-semibold" style={{ background: pie, ...bordeArriba }}>
                    {fmt(totalesPeriodo.get(String(pr.clave)))}
                  </td>
                </tr>
                {detalle.map((d, di) => {
                  const bordeAbajo = di === detalle.length - 1 ? { borderBottom: "3px solid #14532d" } : {};
                  return (
                  <tr key={d.clave} style={{ background: d.resalta ? "#e3eee7" : "#eff5f1" }}>
                    <td style={{ position: "sticky", left: 0, background: d.resalta ? "#d3e2d8" : "#dfeae3", color: "#14532d", zIndex: 1, paddingLeft: "1.6rem", whiteSpace: "nowrap", ...bordeAbajo }} className={d.resalta ? "fw-semibold small" : "small"}>
                      {d.titulo}
                    </td>
                    {fincas.map((f) => (
                      <td key={f.uuid} className="text-center small" style={{ background: d.resalta ? "#e3eee7" : "#eff5f1", ...bordeAbajo }} title={d.ayuda?.(f.uuid)}>
                        {d.celda(f.uuid)}
                      </td>
                    ))}
                    <td className="text-center small fw-semibold" style={{ background: d.resalta ? "#d3e2d8" : "#dbe7df", ...bordeAbajo }}>
                      {d.total()}
                    </td>
                  </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot style={{ position: "sticky", bottom: 0 }}>
          <tr className="fw-bold" style={{ background: pie }}>
            <td style={{ position: "sticky", left: 0, ...encabezado }}>Total</td>
            {fincas.map((f) => (
              <td key={f.uuid} className="text-center" style={{ background: pie }}>
                {fmt(totalesFinca.get(f.uuid))}
              </td>
            ))}
            <td className="text-center" style={{ ...encabezado }}>{fmt(totalGeneral)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Grafico({ resultado, metrica }) {
  const m = metricas(resultado.meta.tasaConversion ?? 18.6).find((x) => x.id === metrica);
  const [a1, a2] = resultado.comparativo.anios;
  const datos = resultado.porSemana.map((s, i) => {
    const comp = resultado.comparativo.porSemana[i]?.valores || {};
    return {
      semana: s.numeroSemana,
      proyeccion: s[metrica],
      bajo: m.bajo ? s[m.bajo] : undefined,
      alto: m.alto ? s[m.alto] : undefined,
      a1: metrica === "racimos" ? undefined : comp[a1]?.[metrica],
      a2: metrica === "racimos" ? undefined : comp[a2]?.[metrica],
    };
  });
  return (
    <div style={{ height: 380 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v) => (v == null ? "—" : fmt(v))} labelFormatter={(l) => `Semana ${l}`} />
          <Legend />
          <Line type="monotone" dataKey="proyeccion" name={`${resultado.meta.anio} proyectado`} stroke={COLORES.proyeccion} strokeWidth={2.5} dot={false} />
          {m.bajo && <Line type="monotone" dataKey="bajo" name="Conservador (p25)" stroke={COLORES.bajo} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />}
          {m.alto && <Line type="monotone" dataKey="alto" name="Optimista (p75)" stroke={COLORES.alto} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />}
          {metrica !== "racimos" && <Line type="monotone" dataKey="a1" name={`${a1} real`} stroke={COLORES.a1} strokeWidth={1.5} dot={false} />}
          {metrica !== "racimos" && <Line type="monotone" dataKey="a2" name={`${a2} real`} stroke={COLORES.a2} strokeWidth={1.5} dot={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Comparativo({ resultado }) {
  const { comparativo, anual, porMes, meta } = resultado;
  const [a1, a2] = comparativo.anios;
  const variacion = (proy, real) => (real > 0 ? `${proy >= real ? "+" : ""}${(((proy / real) - 1) * 100).toFixed(1)}%` : "—");
  return (
    <div>
      <div className="row g-3 mb-3">
        {[
          { t: "Embolses", k: "embolses" },
          { t: `Cajas ${resultado.meta.tasaConversion ?? 18.6}`, k: "cajas" },
        ].map(({ t, k }) => (
          <div key={k} className="col-12 col-md-6">
            <div className="border rounded-3 p-3">
              <div className="small text-secondary mb-1">{t} del año</div>
              <div className="d-flex flex-wrap gap-4 align-items-end">
                <div>
                  <div className="fs-4 fw-bold">{fmt(anual[k])}</div>
                  <div className="small text-secondary">{meta.anio} proyectado</div>
                </div>
                {[a1, a2].map((a) => (
                  <div key={a}>
                    <div className="fw-semibold">{fmt(comparativo.anual[a][k])}</div>
                    <div className="small text-secondary">
                      {a} real ({variacion(anual[k], comparativo.anual[a][k])})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0 small">
          <thead className="table-light">
            <tr>
              <th rowSpan={2}>Mes</th>
              <th colSpan={3} className="text-center">Embolses</th>
              <th colSpan={3} className="text-center">Cajas {resultado.meta.tasaConversion ?? 18.6}</th>
            </tr>
            <tr>
              <th className="text-end">{meta.anio} proy.</th>
              <th className="text-end">{a1}</th>
              <th className="text-end">{a2}</th>
              <th className="text-end">{meta.anio} proy.</th>
              <th className="text-end">{a1}</th>
              <th className="text-end">{a2}</th>
            </tr>
          </thead>
          <tbody>
            {porMes.map((m, i) => {
              const comp = comparativo.porMes[i].valores;
              return (
                <tr key={m.mes}>
                  <td className="fw-medium">{MESES[i]}</td>
                  <td className="text-end fw-semibold">{fmt(m.embolses)}</td>
                  <td className="text-end">{fmt(comp[a1].embolses)}</td>
                  <td className="text-end">{fmt(comp[a2].embolses)}</td>
                  <td className="text-end fw-semibold">{fmt(m.cajas)}</td>
                  <td className="text-end">{fmt(comp[a1].cajas)}</td>
                  <td className="text-end">{fmt(comp[a2].cajas)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Resultados de la proyección: tablas finca × semana y finca × mes (con totales), gráfico anual y comparativo histórico.
function SelectorColumnas({ fincas, ocultas, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const alternar = (uuid) => {
    const n = new Set(ocultas);
    if (n.has(uuid)) n.delete(uuid);
    else n.add(uuid);
    onChange(n);
  };
  return (
    <div className="position-relative">
      <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => setAbierto((v) => !v)}>
        <FiColumns /> Columnas{ocultas.size > 0 ? ` (${fincas.length - ocultas.size}/${fincas.length})` : ""}
      </button>
      {abierto && (
        <>
          <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }} onClick={() => setAbierto(false)} />
          <div className="position-absolute end-0 mt-1 bg-white border rounded-3 shadow p-2" style={{ zIndex: 1041, width: 240, maxHeight: "55vh", overflowY: "auto" }}>
            <div className="d-flex justify-content-between mb-1">
              <button type="button" className="btn btn-sm btn-link p-0" onClick={() => onChange(new Set())}>
                Mostrar todas
              </button>
              <button type="button" className="btn btn-sm btn-link p-0" onClick={() => onChange(new Set(fincas.map((f) => f.uuid)))}>
                Ocultar todas
              </button>
            </div>
            {fincas.map((f) => (
              <div key={f.uuid} className="form-check">
                <input type="checkbox" className="form-check-input" id={`col-${f.uuid}`} checked={!ocultas.has(f.uuid)} onChange={() => alternar(f.uuid)} />
                <label className="form-check-label small" htmlFor={`col-${f.uuid}`}>
                  {f.nombre}
                </label>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ResultadosProyeccion({ resultado, productos = [], onProductosChange = () => {}, puedeEditar = false, nombreEscenario = "" }) {
  const METRICAS = metricas(resultado.meta.tasaConversion ?? 18.6);
  const [vista, setVista] = useState("semanal");
  const [metrica, setMetrica] = useState("cajas");
  const [ocultas, setOcultas] = useState(() => new Set()); // fincas (columnas) ocultas en las tablas
  const [graficas, setGraficas] = useState(null); // { uuids, titulo } de la finca (o total) cuyas gráficas se muestran
  const fincasLista = useMemo(
    () => resultado.aprovechamiento.map((a) => ({ uuid: a.fincaUuid, nombre: a.fincaNombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [resultado],
  );

  const vistas = [
    ["semanal", "Por semana y finca"],
    ["mensual", "Por mes y finca"],
    ["producto", "Por producto"],
    ["grafico", "Gráfico anual"],
    ["comparativo", "Comparar con el histórico"],
  ];

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="d-inline-flex flex-wrap gap-1 p-1" style={{ background: "#e6eee8", borderRadius: 8, padding: "2px" }} role="tablist">
          {vistas.map(([id, label]) => {
            const activa = vista === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activa}
                className="btn btn-sm border-0 px-2"
                style={{
                  borderRadius: 6,
                  fontSize: "0.78rem",
                  padding: "2px 10px",
                  background: activa ? "#fff" : "transparent",
                  color: activa ? "#166534" : "#4b6354",
                  fontWeight: activa ? 700 : 500,
                  boxShadow: activa ? "0 1px 2px rgba(20,83,45,0.18)" : "none",
                }}
                onClick={() => setVista(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
        {vista !== "comparativo" && (
          <div className="d-flex align-items-center gap-2">
            {(vista === "semanal" || vista === "mensual" || vista === "producto") && <SelectorColumnas fincas={fincasLista} ocultas={ocultas} onChange={setOcultas} />}
            <select className="form-select form-select-sm" style={{ width: "auto" }} value={metrica} onChange={(e) => setMetrica(e.target.value)}>
              {METRICAS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {vista === "semanal" && <Pivot resultado={resultado} metrica={metrica} periodo="semana" ocultas={ocultas} onGraficas={setGraficas} />}
      {vista === "mensual" && <Pivot resultado={resultado} metrica={metrica} periodo="mes" ocultas={ocultas} onGraficas={setGraficas} />}
      {vista === "producto" && <PorProducto resultado={resultado} ocultas={ocultas} productos={productos} onChange={onProductosChange} puedeEditar={puedeEditar} nombreEscenario={nombreEscenario} />}
      {vista === "grafico" && <Grafico resultado={resultado} metrica={metrica} />}
      {vista === "comparativo" && <Comparativo resultado={resultado} />}
      {vista === "semanal" && <p className="small text-secondary mt-2 mb-0">* Semana ya transcurrida: usa el dato real. Haz clic en el nombre de una finca para ver sus gráficas, y en una semana para desplegar el cálculo de sus cajas (hectáreas, embolses, racimos por edad y ratio) debajo de ella.</p>}

      {graficas && <GraficasFincaModal resultado={resultado} uuids={graficas.uuids} titulo={graficas.titulo} onClose={() => setGraficas(null)} />}
    </div>
  );
}
