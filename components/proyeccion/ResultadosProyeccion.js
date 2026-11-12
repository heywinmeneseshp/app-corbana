"use client";

import { Fragment, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiColumns, FiDownload } from "react-icons/fi";
import GraficasFincaModal from "./GraficasFincaModal";
import PorProducto from "./PorProducto";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// La unidad de caja es la de referencia del sistema: su peso es la tasa de conversión configurada (18.6 por defecto).
const metricas = (tasa) => [
  { id: "cajas", label: `Cajas ${tasa}`, bajo: "cajasBajo", alto: "cajasAlto" },
  { id: "embolses", label: "Embolses", bajo: "embolsesBajo", alto: "embolsesAlto" },
  { id: "racimos", label: "Racimos cosechados" },
  { id: "juntos", label: "Embolses, racimos, ratio y cajas" }, // solo en las tablas por semana y por mes
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

  const juntos = metrica === "juntos";
  // Valores por finca y periodo de cada campo (embolses, racimos y cajas): la vista "juntos" los muestra a la vez y el ratio sale de cajas / racimos.
  const { fincas, vals, totales } = useMemo(() => {
    const nombres = new Map(); // fincaUuid -> nombre
    const campos = ["embolses", "racimos", "cajas"];
    const v = Object.fromEntries(campos.map((c) => [c, new Map()])); // `${fincaUuid}|${clave}` -> valor
    for (const f of filas) {
      if (ocultas.has(f.fincaUuid)) continue; // columnas ocultas: no se muestran ni suman
      nombres.set(f.fincaUuid, f.fincaNombre);
      const clave = periodo === "semana" ? f.semanaCodigo : mesDe(f.fechaInicio);
      const k = `${f.fincaUuid}|${clave}`;
      for (const c of campos) v[c].set(k, (v[c].get(k) || 0) + (f[c] || 0));
    }
    const lista = [...nombres.entries()].map(([uuid, nombre]) => ({ uuid, nombre })).sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
    const t = {};
    for (const c of campos) {
      const porFinca = new Map();
      const porPeriodo = new Map();
      for (const [k, val] of v[c]) {
        const [uuid, clave] = k.split("|");
        porFinca.set(uuid, (porFinca.get(uuid) || 0) + val);
        porPeriodo.set(clave, (porPeriodo.get(clave) || 0) + val);
      }
      t[c] = { porFinca, porPeriodo, general: [...porFinca.values()].reduce((x, y) => x + y, 0) };
    }
    return { fincas: lista, vals: v, totales: t };
  }, [filas, periodo, ocultas]);

  // El ratio no se suma: es cajas / racimos de lo que se muestra (finca, periodo o total).
  const ratioDe = (caj, rac) => (rac > 0 ? fmtD(caj / rac, 4) : "—");
  const celda = (campo, uuid, clave) => {
    const k = `${uuid}|${clave}`;
    if (campo === "ratio") return ratioDe(vals.cajas.get(k), vals.racimos.get(k));
    return fmt(vals[campo].get(k));
  };
  const totalPeriodo = (campo, clave) => {
    const c = String(clave);
    return campo === "ratio" ? ratioDe(totales.cajas.porPeriodo.get(c), totales.racimos.porPeriodo.get(c)) : fmt(totales[campo].porPeriodo.get(c));
  };
  const totalFinca = (campo, uuid) => (campo === "ratio" ? ratioDe(totales.cajas.porFinca.get(uuid), totales.racimos.porFinca.get(uuid)) : fmt(totales[campo].porFinca.get(uuid)));
  const totalGeneral = (campo) => (campo === "ratio" ? ratioDe(totales.cajas.general, totales.racimos.general) : fmt(totales[campo].general));
  const datos = juntos
    ? [["embolses", "Embolses"], ["racimos", "Racimos"], ["ratio", "Ratio"], ["cajas", "Cajas"]]
    : [[metrica, null]];
  const anchoPrimera = periodo === "semana" ? 90 : 70;

  // Encabezados y columna de semana/mes con color propio para distinguirlos de los datos.
  const encabezado = { background: "#166534", color: "#fff" };
  const primeraCol = "#e8f6ee";
  const pie = "#d1ecdc";

  return (
    <div className="table-responsive" style={{ maxHeight: "65vh" }}>
      <table className="table table-sm table-hover table-bordered align-middle mb-0 small" style={{ whiteSpace: "nowrap", "--bs-table-border-color": "#b9c9be" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
          <tr>
            <th style={{ position: "sticky", left: 0, ...encabezado, zIndex: 3, minWidth: anchoPrimera }}>{periodo === "semana" ? "Semana" : "Mes"}</th>
            {juntos && <th style={{ position: "sticky", left: anchoPrimera, ...encabezado, zIndex: 3, minWidth: 70 }}>Dato</th>}
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
            const detalle = abierta ? filasCalculo(pr.clave, fincas, filaDe, tasa, juntos ? "cajas" : metrica) : [];
            // Semana desplegada: borde grueso y oscuro arriba de la semana y debajo de su última fila, para separar el bloque.
            const bordeArriba = abierta ? { borderTop: "3px solid #14532d" } : {};
            return (
              <Fragment key={pr.clave}>
                {datos.map(([campo, etiqueta], di) => (
                  <tr
                    key={campo}
                    role={desplegable ? "button" : undefined}
                    style={desplegable ? { cursor: "pointer" } : undefined}
                    title={desplegable ? "Clic para ver cómo se calcularon las cajas de esta semana" : undefined}
                    onClick={desplegable ? () => alternar(pr.clave) : undefined}
                  >
                    {di === 0 && (
                      <td rowSpan={datos.length} className="fw-semibold" style={{ position: "sticky", left: 0, background: primeraCol, color: "#14532d", zIndex: 1, ...bordeArriba }} title={pr.real ? "Semana real" : undefined}>
                        {desplegable && (abierta ? <FiChevronDown className="me-1" /> : <FiChevronRight className="me-1" />)}
                        {pr.titulo}
                        {pr.real ? "*" : ""}
                      </td>
                    )}
                    {etiqueta && (
                      <td className="small fw-medium" style={{ position: "sticky", left: anchoPrimera, background: primeraCol, color: "#14532d", zIndex: 1, ...(di === 0 ? bordeArriba : {}) }}>
                        {etiqueta}
                      </td>
                    )}
                    {fincas.map((f) => (
                      <td key={f.uuid} className="text-center" style={di === 0 ? bordeArriba : undefined}>
                        {celda(campo, f.uuid, pr.clave)}
                      </td>
                    ))}
                    <td className="text-center fw-semibold" style={{ background: pie, ...(di === 0 ? bordeArriba : {}) }}>
                      {totalPeriodo(campo, pr.clave)}
                    </td>
                  </tr>
                ))}
                {detalle.map((d, di) => {
                  const bordeAbajo = di === detalle.length - 1 ? { borderBottom: "3px solid #14532d" } : {};
                  return (
                  <tr key={d.clave} style={{ background: d.resalta ? "#e3eee7" : "#eff5f1" }}>
                    <td colSpan={juntos ? 2 : 1} style={{ position: "sticky", left: 0, background: d.resalta ? "#d3e2d8" : "#dfeae3", color: "#14532d", zIndex: 1, paddingLeft: "1.6rem", whiteSpace: "nowrap", ...bordeAbajo }} className={d.resalta ? "fw-semibold small" : "small"}>
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
          {datos.map(([campo, etiqueta], di) => (
            <tr key={campo} className="fw-bold" style={{ background: pie }}>
              {di === 0 && (
                <td rowSpan={datos.length} style={{ position: "sticky", left: 0, ...encabezado }}>
                  Total
                </td>
              )}
              {etiqueta && (
                <td className="small" style={{ position: "sticky", left: anchoPrimera, background: pie }}>
                  {etiqueta}
                </td>
              )}
              {fincas.map((f) => (
                <td key={f.uuid} className="text-center" style={{ background: pie }}>
                  {totalFinca(campo, f.uuid)}
                </td>
              ))}
              <td className="text-center" style={{ ...encabezado }}>
                {totalGeneral(campo)}
              </td>
            </tr>
          ))}
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

// Descarga la tabla por semana (o mes) y finca tal como se ve: la métrica elegida y sin las fincas ocultas.
async function exportarPivot({ resultado, metrica, metricaLabel, periodo, ocultas, nombreEscenario }) {
  const { filas, porSemana, meta } = resultado;
  const periodos = periodo === "semana" ? porSemana.map((s) => ({ clave: s.semanaCodigo, titulo: s.real ? `${s.semanaCodigo} *` : s.semanaCodigo })) : MESES.map((m, i) => ({ clave: i, titulo: m }));
  const nombres = new Map();
  const val = new Map();
  const extra = { embolses: new Map(), racimos: new Map(), cajas: new Map() }; // para la vista "Embolses, racimos, ratio y cajas"
  for (const f of filas) {
    if (ocultas.has(f.fincaUuid)) continue;
    nombres.set(f.fincaUuid, f.fincaNombre);
    const clave = periodo === "semana" ? f.semanaCodigo : mesDe(f.fechaInicio);
    const k = `${f.fincaUuid}|${clave}`;
    val.set(k, (val.get(k) || 0) + (f[metrica] || 0));
    for (const c of ["embolses", "racimos", "cajas"]) {
      const m = extra[c];
      m.set(k, (m.get(k) || 0) + (f[c] || 0));
    }
  }
  const fincas = [...nombres.entries()].map(([uuid, nombre]) => ({ uuid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const redondeo = (v) => Math.round(v * 100) / 100;

  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(periodo === "semana" ? "Por semana y finca" : "Por mes y finca");
  hoja.addRow([`Proyección ${meta.anio}${nombreEscenario ? ` · ${nombreEscenario}` : ""} · ${metricaLabel}`]).font = { bold: true, size: 12 };
  if (periodo === "semana") hoja.addRow(["* Semana ya transcurrida: usa el dato real"]).font = { italic: true, color: { argb: "FF6B7280" } };
  hoja.addRow([]);
  const encabezado = hoja.addRow([periodo === "semana" ? "Semana" : "Mes", ...fincas.map((f) => f.nombre), "Total"]);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } }));
  if (metrica === "juntos") {
    // Cuatro filas por periodo (embolses, racimos, ratio y cajas); el ratio es cajas / racimos.
    hoja.spliceRows(encabezado.number, 1, ["", "Dato", ...fincas.map((f) => f.nombre), "Total"]);
    const enc = hoja.getRow(encabezado.number);
    enc.getCell(1).value = periodo === "semana" ? "Semana" : "Mes";
    enc.font = { bold: true, color: { argb: "FFFFFFFF" } };
    enc.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } }));
    const suma = (c, uuid, clave) => (uuid ? extra[c].get(`${uuid}|${clave}`) || 0 : fincas.reduce((a2, f) => a2 + (extra[c].get(`${f.uuid}|${clave}`) || 0), 0));
    const sumaFinca = (c, uuid) => periodos.reduce((a2, per) => a2 + suma(c, uuid, per.clave), 0);
    const ratio = (caj, rac) => (rac > 0 ? Math.round((caj / rac) * 10000) / 10000 : null);
    for (const per of periodos) {
      for (const [c, etiqueta] of [["embolses", "Embolses"], ["racimos", "Racimos"], ["ratio", "Ratio"], ["cajas", "Cajas"]]) {
        const v = (uuid) => (c === "ratio" ? ratio(suma("cajas", uuid, per.clave), suma("racimos", uuid, per.clave)) : redondeo(suma(c, uuid, per.clave)));
        const fila = hoja.addRow([etiqueta === "Embolses" ? per.titulo : "", etiqueta, ...fincas.map((f) => v(f.uuid)), v(null)]);
        if (c === "ratio") fila.eachCell({ includeEmpty: false }, (cell, n) => n > 2 && (cell.numFmt = "0.0000"));
      }
    }
    for (const [c, etiqueta] of [["embolses", "Embolses"], ["racimos", "Racimos"], ["ratio", "Ratio"], ["cajas", "Cajas"]]) {
      const v = (uuid) => (c === "ratio" ? ratio(sumaFinca("cajas", uuid), sumaFinca("racimos", uuid)) : redondeo(sumaFinca(c, uuid)));
      const total = c === "ratio" ? ratio(fincas.reduce((a2, f) => a2 + sumaFinca("cajas", f.uuid), 0), fincas.reduce((a2, f) => a2 + sumaFinca("racimos", f.uuid), 0)) : redondeo(fincas.reduce((a2, f) => a2 + sumaFinca(c, f.uuid), 0));
      const fila = hoja.addRow([etiqueta === "Embolses" ? "Total" : "", etiqueta, ...fincas.map((f) => v(f.uuid)), total]);
      fila.font = { bold: true };
      if (c === "ratio") fila.eachCell({ includeEmpty: false }, (cell, n) => n > 2 && (cell.numFmt = "0.0000"));
    }
    hoja.getColumn(1).width = 14;
    hoja.getColumn(2).width = 11;
    for (let i = 3; i <= fincas.length + 3; i += 1) hoja.getColumn(i).width = 14;
    hoja.views = [{ state: "frozen", xSplit: 2, ySplit: encabezado.number }];
    const blobJ = new Blob([await libro.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const aJ = document.createElement("a");
    aJ.href = URL.createObjectURL(blobJ);
    aJ.download = `proyeccion-${meta.anio}-${periodo === "semana" ? "semana" : "mes"}-finca-juntos.xlsx`;
    aJ.click();
    URL.revokeObjectURL(aJ.href);
    return;
  }
  const totalesFinca = new Map();
  for (const per of periodos) {
    let total = 0;
    const valores = fincas.map((f) => {
      const v = val.get(`${f.uuid}|${per.clave}`) || 0;
      total += v;
      totalesFinca.set(f.uuid, (totalesFinca.get(f.uuid) || 0) + v);
      return redondeo(v);
    });
    hoja.addRow([per.titulo, ...valores, redondeo(total)]);
  }
  const pie = hoja.addRow(["Total", ...fincas.map((f) => redondeo(totalesFinca.get(f.uuid) || 0)), redondeo([...totalesFinca.values()].reduce((a, b) => a + b, 0))]);
  pie.font = { bold: true };
  hoja.getColumn(1).width = 14;
  for (let i = 2; i <= fincas.length + 2; i += 1) {
    hoja.getColumn(i).width = 14;
    hoja.getColumn(i).numFmt = "#,##0.##";
  }
  hoja.views = [{ state: "frozen", xSplit: 1, ySplit: encabezado.number }];

  const blob = new Blob([await libro.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `proyeccion-${meta.anio}-${periodo === "semana" ? "semana" : "mes"}-finca-${metrica}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
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
            {(vista === "semanal" || vista === "mensual") && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                title="Descargar esta tabla en Excel"
                onClick={() =>
                  exportarPivot({
                    resultado,
                    metrica,
                    metricaLabel: METRICAS.find((m) => m.id === metrica)?.label || metrica,
                    periodo: vista === "semanal" ? "semana" : "mes",
                    ocultas,
                    nombreEscenario,
                  })
                }
              >
                <FiDownload /> Excel
              </button>
            )}
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
      {vista === "grafico" && <Grafico resultado={resultado} metrica={metrica === "juntos" ? "cajas" : metrica} />}
      {vista === "comparativo" && <Comparativo resultado={resultado} />}
      {vista === "semanal" && <p className="small text-secondary mt-2 mb-0">* Semana ya transcurrida: usa el dato real. Haz clic en el nombre de una finca para ver sus gráficas, y en una semana para desplegar el cálculo de sus cajas (hectáreas, embolses, racimos por edad y ratio) debajo de ella.</p>}

      {graficas && <GraficasFincaModal resultado={resultado} uuids={graficas.uuids} titulo={graficas.titulo} onClose={() => setGraficas(null)} />}
    </div>
  );
}
