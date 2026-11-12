"use client";

import { Fragment, useMemo } from "react";

// Vista «Embolses, aprovechamiento, racimos, ratio y cajas»: cada semana (o mes) es un bloque de cinco filas que se lee de arriba abajo como el
// cálculo: embolses × aprovechamiento = racimos; racimos × ratio = cajas. Columnas = fincas + total.
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const VERDE = "#166534";
const BORDE = "#b9c9be";

const DATOS = [
  { id: "embolses", titulo: "Embolses", ayuda: "Embolses de la semana (real si ya pasó, proyectado si no)", color: "#0891b2" },
  { id: "aprov", titulo: "Aprovechamiento", ayuda: "Cosechado ÷ (cosechado + repique + recusado) de la cinta que cumple 12 semanas en esta semana", color: "#7c3aed", derivado: true },
  { id: "racimos", titulo: "Racimos", ayuda: "Racimos cosechados", color: "#d97706" },
  { id: "ratio", titulo: "Ratio", ayuda: "Cajas por racimo (cajas ÷ racimos)", color: "#64748b", derivado: true },
  { id: "cajas", titulo: "Cajas", ayuda: "Racimos × ratio", color: VERDE, resultado: true },
];

const num = (n, d = 0) => Number(n ?? 0).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d });
const mesDe = (fecha) => new Date(new Date(`${fecha}T00:00:00Z`).getTime() + 3 * 86400000).getUTCMonth(); // mes del jueves
const razon = (a, b) => (b > 0 ? a / b : null);
const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);
const ratioTxt = (v) => (v === null || v === undefined ? "—" : num(v, 4));

// Acumula, por finca y periodo, lo que hace falta para mostrar las cinco cifras (el ratio y el aprovechamiento salen de cocientes de sumas).
function acumular(resultado, periodo, ocultas) {
  const nombres = new Map();
  const celdas = new Map(); // `${uuid}|${clave}` -> { embolses, racimos, cajas, an, ad, estimado }
  for (const f of resultado.filas) {
    if (ocultas.has(f.fincaUuid)) continue;
    nombres.set(f.fincaUuid, f.fincaNombre);
    const clave = periodo === "semana" ? f.semanaCodigo : mesDe(f.fechaInicio);
    const k = `${f.fincaUuid}|${clave}`;
    const c = celdas.get(k) || { embolses: 0, racimos: 0, cajas: 0, an: 0, ad: 0, real: 0, filas: 0 };
    c.embolses += f.embolses || 0;
    c.racimos += f.racimos || 0;
    c.cajas += f.cajas || 0;
    c.an += f.aprovechamientoNum || 0;
    c.ad += f.aprovechamientoDen || 0;
    c.filas += 1;
    if (f.aprovechamientoCintaReal) c.real += 1;
    celdas.set(k, c);
  }
  const fincas = [...nombres.entries()].map(([uuid, nombre]) => ({ uuid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const suma = (lista) => lista.reduce((t, c) => ({ embolses: t.embolses + c.embolses, racimos: t.racimos + c.racimos, cajas: t.cajas + c.cajas, an: t.an + c.an, ad: t.ad + c.ad, real: t.real + c.real, filas: t.filas + c.filas }), { embolses: 0, racimos: 0, cajas: 0, an: 0, ad: 0, real: 0, filas: 0 });
  return { fincas, celdas, suma };
}

// Valor de una de las cinco cifras en una celda ya acumulada.
function valorDe(dato, c) {
  if (!c) return null;
  if (dato === "aprov") return razon(c.an, c.ad);
  if (dato === "ratio") return razon(c.cajas, c.racimos);
  return c[dato];
}
const texto = (dato, v) => (v === null || v === undefined ? "—" : dato === "aprov" ? pct(v) : dato === "ratio" ? ratioTxt(v) : num(v));
// El aprovechamiento es «estimado» cuando ninguna cinta de la celda tiene movimientos reales (se usó el % aplicado de la finca).
const esEstimado = (dato, c) => dato === "aprov" && c && c.real === 0;

export default function TablaJuntos({ resultado, periodo, ocultas, onGraficas }) {
  const { fincas, celdas, suma } = useMemo(() => acumular(resultado, periodo, ocultas), [resultado, periodo, ocultas]);
  const periodos = periodo === "semana" ? resultado.porSemana.map((s) => ({ clave: s.semanaCodigo, titulo: s.semanaCodigo, real: s.real })) : MESES.map((m, i) => ({ clave: i, titulo: m }));
  const fila = (clave) => fincas.map((f) => celdas.get(`${f.uuid}|${clave}`));
  const totalPeriodo = (clave) => suma(fila(clave).filter(Boolean));
  const totalFinca = (uuid) => suma(periodos.map((p) => celdas.get(`${uuid}|${p.clave}`)).filter(Boolean));
  const totalGeneral = suma([...celdas.values()]);

  const W1 = periodo === "semana" ? 92 : 64; // ancho de la columna de periodo
  const W2 = 128; // ancho de la columna del dato
  const encabezado = { background: VERDE, color: "#fff" };
  const sombra = "2px 0 0 #cfdcd3";

  const celdaNumero = (dato, c, extra = {}) => {
    const v = valorDe(dato, c);
    const estimado = esEstimado(dato, c);
    const def = DATOS.find((d) => d.id === dato);
    return {
      contenido: texto(dato, v),
      style: {
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        padding: "0.2rem 0.65rem",
        color: def.derivado ? "#5b6b61" : "#1f2937",
        fontSize: def.derivado ? "0.78rem" : "0.84rem",
        fontWeight: def.resultado ? 700 : 500,
        fontStyle: estimado ? "italic" : undefined,
        ...extra,
      },
      title: estimado ? "Sin movimientos reales en esta cinta: se usa el % de aprovechamiento aplicado a la finca" : undefined,
    };
  };

  return (
    <div>
      <p className="small text-secondary mb-2">
        Cada semana se lee de arriba abajo: <strong>embolses × aprovechamiento = racimos</strong>, y <strong>racimos × ratio = cajas</strong>. En cursiva, un aprovechamiento sin dato real todavía
        (usa el % aplicado a la finca).
      </p>
      <div className="table-responsive border rounded-3" style={{ maxHeight: "68vh" }}>
        <table className="table table-sm align-middle mb-0" style={{ whiteSpace: "nowrap", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
            <tr>
              <th style={{ position: "sticky", left: 0, zIndex: 4, minWidth: W1, width: W1, ...encabezado, padding: "0.45rem 0.6rem" }}>{periodo === "semana" ? "Semana" : "Mes"}</th>
              <th style={{ position: "sticky", left: W1, zIndex: 4, minWidth: W2, width: W2, ...encabezado, padding: "0.45rem 0.6rem", boxShadow: sombra }}>Dato</th>
              {fincas.map((f) => (
                <th
                  key={f.uuid}
                  role="button"
                  title="Clic para ver las gráficas de esta finca"
                  className="text-end"
                  style={{ ...encabezado, minWidth: 96, padding: "0.45rem 0.65rem", cursor: "pointer", fontWeight: 600 }}
                  onClick={() => onGraficas({ uuids: [f.uuid], titulo: `Gráficas · ${f.nombre}` })}
                >
                  {f.nombre}
                </th>
              ))}
              <th
                role="button"
                title="Clic para ver las gráficas del total de las fincas visibles"
                className="text-end"
                style={{ background: "#14532d", color: "#fff", minWidth: 104, padding: "0.45rem 0.65rem", cursor: "pointer", fontWeight: 700 }}
                onClick={() => onGraficas({ uuids: fincas.map((f) => f.uuid), titulo: "Gráficas · Total de las fincas visibles" })}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((pr, bi) => {
              const fondo = bi % 2 === 0 ? "#ffffff" : "#f4f8f5"; // bandas alternas por bloque
              const tot = totalPeriodo(pr.clave);
              return (
                <Fragment key={pr.clave}>
                  {DATOS.map((d, di) => {
                    const bordeBloque = di === 0 ? { borderTop: `2px solid ${BORDE}` } : { borderTop: "1px solid #e5ece7" };
                    const fondoFila = d.resultado ? "#e6f4ea" : fondo;
                    return (
                      <tr key={d.id}>
                        {di === 0 && (
                          <td
                            rowSpan={DATOS.length}
                            style={{ position: "sticky", left: 0, zIndex: 2, background: fondo, minWidth: W1, width: W1, verticalAlign: "top", padding: "0.4rem 0.6rem", borderTop: `2px solid ${BORDE}`, color: "#14532d" }}
                          >
                            <div className="fw-bold" style={{ fontSize: "0.88rem" }}>
                              {pr.titulo}
                            </div>
                            {pr.real && (
                              <span className="badge rounded-pill" style={{ background: "#dcfce7", color: "#166534", fontWeight: 600, fontSize: "0.65rem" }} title="Semana ya transcurrida: usa el dato real">
                                Real
                              </span>
                            )}
                          </td>
                        )}
                        <td
                          title={d.ayuda}
                          style={{
                            position: "sticky",
                            left: W1,
                            zIndex: 2,
                            background: fondoFila,
                            minWidth: W2,
                            width: W2,
                            padding: "0.2rem 0.6rem",
                            boxShadow: sombra,
                            fontSize: d.derivado ? "0.76rem" : "0.82rem",
                            fontWeight: d.resultado ? 700 : 500,
                            color: d.derivado ? "#5b6b61" : "#1f2937",
                            ...bordeBloque,
                          }}
                        >
                          <span className="d-inline-block rounded-circle me-2" style={{ width: 8, height: 8, background: d.color, verticalAlign: "middle" }} />
                          {d.titulo}
                        </td>
                        {fincas.map((f) => {
                          const c = celdaNumero(d.id, celdas.get(`${f.uuid}|${pr.clave}`), { background: fondoFila, ...bordeBloque });
                          return (
                            <td key={f.uuid} style={c.style} title={c.title}>
                              {c.contenido}
                            </td>
                          );
                        })}
                        {(() => {
                          const c = celdaNumero(d.id, tot, { background: d.resultado ? "#cfe9d6" : "#eaf3ed", fontWeight: 700, ...bordeBloque });
                          return (
                            <td style={c.style} title={c.title}>
                              {c.contenido}
                            </td>
                          );
                        })()}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot style={{ position: "sticky", bottom: 0, zIndex: 3 }}>
            {DATOS.map((d, di) => (
              <tr key={d.id}>
                {di === 0 && (
                  <td rowSpan={DATOS.length} style={{ position: "sticky", left: 0, zIndex: 4, ...encabezado, minWidth: W1, width: W1, padding: "0.4rem 0.6rem", fontWeight: 700, verticalAlign: "middle" }}>
                    Total
                  </td>
                )}
                <td style={{ position: "sticky", left: W1, zIndex: 4, background: "#d1ecdc", minWidth: W2, width: W2, padding: "0.2rem 0.6rem", boxShadow: sombra, fontSize: "0.8rem", fontWeight: 600, color: "#14532d", borderTop: di === 0 ? `2px solid ${VERDE}` : "1px solid #b7d8c3" }}>
                  <span className="d-inline-block rounded-circle me-2" style={{ width: 8, height: 8, background: d.color, verticalAlign: "middle" }} />
                  {d.titulo}
                </td>
                {fincas.map((f) => {
                  const c = celdaNumero(d.id, totalFinca(f.uuid), { background: "#d1ecdc", fontWeight: 700, color: "#14532d", borderTop: di === 0 ? `2px solid ${VERDE}` : "1px solid #b7d8c3" });
                  return (
                    <td key={f.uuid} style={c.style} title={c.title}>
                      {c.contenido}
                    </td>
                  );
                })}
                {(() => {
                  const c = celdaNumero(d.id, totalGeneral, { background: "#14532d", color: "#fff", fontWeight: 700, borderTop: di === 0 ? `2px solid ${VERDE}` : "1px solid #2f6b46" });
                  return <td style={c.style}>{c.contenido}</td>;
                })()}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Excel con la misma disposición: cinco filas por semana (o mes) y los totales al final.
export async function exportarJuntos({ resultado, periodo, ocultas, nombreEscenario }) {
  const { fincas, celdas, suma } = acumular(resultado, periodo, ocultas);
  const periodos = periodo === "semana" ? resultado.porSemana.map((s) => ({ clave: s.semanaCodigo, titulo: s.real ? `${s.semanaCodigo} *` : s.semanaCodigo })) : MESES.map((m, i) => ({ clave: i, titulo: m }));
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(periodo === "semana" ? "Por semana y finca" : "Por mes y finca");
  hoja.addRow([`Proyección ${resultado.meta.anio}${nombreEscenario ? ` · ${nombreEscenario}` : ""} · Embolses, aprovechamiento, racimos, ratio y cajas`]).font = { bold: true, size: 12 };
  hoja.addRow(["Embolses × aprovechamiento = racimos; racimos × ratio = cajas." + (periodo === "semana" ? " * Semana ya transcurrida: dato real." : "")]).font = { italic: true, color: { argb: "FF6B7280" } };
  hoja.addRow([]);
  const enc = hoja.addRow([periodo === "semana" ? "Semana" : "Mes", "Dato", ...fincas.map((f) => f.nombre), "Total"]);
  enc.font = { bold: true, color: { argb: "FFFFFFFF" } };
  enc.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } }));
  const redondeo = (v, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);
  const agregarBloque = (titulo, porFinca, total, destacar = false) => {
    DATOS.forEach((d, di) => {
      const val = (c) => {
        const v = valorDe(d.id, c);
        return d.id === "ratio" ? redondeo(v, 4) : d.id === "aprov" ? redondeo(v, 4) : redondeo(v, 0);
      };
      const fila = hoja.addRow([di === 0 ? titulo : "", d.titulo, ...porFinca.map(val), val(total)]);
      fila.eachCell({ includeEmpty: false }, (cell, n) => {
        if (n <= 2) return;
        cell.numFmt = d.id === "aprov" ? "0.0%" : d.id === "ratio" ? "0.0000" : "#,##0";
      });
      if (destacar) fila.font = { bold: true };
      if (d.id === "cajas") fila.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4EA" } }));
      if (di === 0) fila.eachCell((cell) => (cell.border = { top: { style: "thin", color: { argb: "FF9CA3AF" } } }));
    });
  };
  for (const pr of periodos) {
    const por = fincas.map((f) => celdas.get(`${f.uuid}|${pr.clave}`));
    agregarBloque(pr.titulo, por, suma(por.filter(Boolean)));
  }
  const porFinca = fincas.map((f) => suma(periodos.map((p) => celdas.get(`${f.uuid}|${p.clave}`)).filter(Boolean)));
  agregarBloque("Total", porFinca, suma([...celdas.values()]), true);
  hoja.getColumn(1).width = 14;
  hoja.getColumn(2).width = 17;
  for (let i = 3; i <= fincas.length + 3; i += 1) hoja.getColumn(i).width = 14;
  hoja.views = [{ state: "frozen", xSplit: 2, ySplit: enc.number }];

  const blob = new Blob([await libro.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `proyeccion-${resultado.meta.anio}-${periodo === "semana" ? "semana" : "mes"}-finca-juntos.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
