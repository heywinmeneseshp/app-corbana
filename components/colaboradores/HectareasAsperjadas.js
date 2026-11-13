"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiDownload } from "react-icons/fi";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ExcelJS from "exceljs";
import { apiFetch } from "@/lib/api";

// Hectáreas asperjadas por colaborador (pilotos de dron y asistentes): cada participante de un comprobante de aspersión suma sus
// hectáreas aplicadas (se les paga por hectárea). Sin comprobantes anulados.
// `vista`: "tabla" (historial por día, para el pago) o "graficos" (por colaborador, por cargo y por día).
const hoy = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const inicioMes = () => `${hoy().slice(0, 8)}01`;
const ha = (n) => Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fechaLarga = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const VERDE = "#16a34a";

function agrupar(lista, claveDe, base) {
  const m = new Map();
  for (const d of lista) {
    const k = claveDe(d);
    const x = m.get(k) || { ...base(d), hectareas: 0, aplicaciones: 0, filas: [] };
    x.hectareas += d.hectareas;
    x.aplicaciones += 1;
    x.filas.push(d);
    m.set(k, x);
  }
  return [...m.values()];
}

export default function HectareasAsperjadas({ vista = "tabla" }) {
  const [filtros, setFiltros] = useState({ desde: inicioMes(), hasta: hoy(), colaborador: "", cargo: "", soloEmitidos: false });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abiertos, setAbiertos] = useState(new Set());
  const [modo, setModo] = useState("pago"); // "pago" (formato de pago, por colaborador) | "dias" (resumen por día)
  const [rolPago, setRolPago] = useState("PILOTO");

  useEffect(() => {
    let activo = true;
    const qs = new URLSearchParams();
    if (filtros.desde) qs.set("desde", filtros.desde);
    if (filtros.hasta) qs.set("hasta", filtros.hasta);
    if (filtros.soloEmitidos) qs.set("soloEmitidos", "true");
    apiFetch(`/comprobantes-aspersion/reporte-hectareas?${qs}`)
      .then((d) => activo && (setDatos(d), setError("")))
      .catch((err) => activo && setError(err.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [filtros.desde, filtros.hasta, filtros.soloEmitidos]);

  const detalle = useMemo(
    () => (datos?.detalle || []).filter((d) => (!filtros.colaborador || d.colaborador.uuid === filtros.colaborador) && (!filtros.cargo || d.cargo === filtros.cargo)),
    [datos, filtros.colaborador, filtros.cargo],
  );
  const opcionesColaborador = useMemo(() => {
    const m = new Map((datos?.detalle || []).map((d) => [d.colaborador.uuid, d.colaborador.nombre]));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [datos]);
  const opcionesCargo = useMemo(() => [...new Set((datos?.detalle || []).map((d) => d.cargo))].sort((a, b) => a.localeCompare(b, "es")), [datos]);

  const porColaborador = useMemo(
    () => agrupar(detalle, (d) => d.colaborador.uuid, (d) => ({ colaborador: d.colaborador.nombre, cargo: d.cargo })).sort((a, b) => b.hectareas - a.hectareas),
    [detalle],
  );
  const porCargo = useMemo(() => agrupar(detalle, (d) => d.cargo, (d) => ({ cargo: d.cargo })).sort((a, b) => b.hectareas - a.hectareas), [detalle]);
  const porDiaColaborador = useMemo(
    () =>
      agrupar(detalle, (d) => `${d.fecha}|${d.colaborador.uuid}`, (d) => ({ id: `${d.fecha}|${d.colaborador.uuid}`, fecha: d.fecha, colaborador: d.colaborador.nombre, cargo: d.cargo })).sort(
        (a, b) => (a.fecha === b.fecha ? a.colaborador.localeCompare(b.colaborador, "es") : a.fecha < b.fecha ? 1 : -1),
      ),
    [detalle],
  );
  const porDia = useMemo(
    () =>
      agrupar(detalle, (d) => d.fecha, (d) => ({ fecha: d.fecha }))
        .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
        .map((x) => ({ ...x, hectareas: Math.round(x.hectareas * 100) / 100, dia: x.fecha.slice(5) })),
    [detalle],
  );
  const total = detalle.reduce((s, d) => s + d.hectareas, 0);

  const cambiar = (campo, valor) => {
    // Las fechas y «solo emitidos» vuelven a pedir el reporte; colaborador y cargo filtran lo ya cargado.
    if (["desde", "hasta", "soloEmitidos"].includes(campo)) setCargando(true);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  };
  const alternar = (id) =>
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Formato de pago: por colaborador, sus filas (día y finca) y su total. Es lo mismo que se ve en pantalla y sale en el Excel.
  const bloquesPago = (rol) => {
    const porPersona = new Map();
    for (const d of detalle.filter((x) => x.rol === rol)) {
      const x = porPersona.get(d.colaborador.uuid) || { nombre: d.colaborador.nombre, filas: [], suma: 0 };
      x.filas.push(d);
      x.suma += d.hectareas;
      porPersona.set(d.colaborador.uuid, x);
    }
    return [...porPersona.values()]
      .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"))
      .map((x) => ({ ...x, filas: [...x.filas].sort((a, b) => (a.fecha === b.fecha ? a.finca.localeCompare(b.finca, "es") : a.fecha < b.fecha ? -1 : 1)) }));
  };
  const fmtFechaCorta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

  // Excel de pago: una pestaña para los pilotos y otra para los asistentes, agrupado por colaborador con su «TOTAL HAS ASPERJADAS».
  async function exportar() {
    const wb = new ExcelJS.Workbook();
    const borde = { style: "thin", color: { argb: "FF9CA3AF" } };
    const bordes = { top: borde, left: borde, bottom: borde, right: borde };
    const COLS = [
      ["FECHA", 13],
      ["SEMANA", 9],
      ["FINCA", 22],
      ["CODIGO FINCA", 14],
      ["CÓDIGO TRABAJADOR", 15],
      ["NOMBRE DEL TRABAJADOR", 40],
      ["C.C.", 14],
      ["HA FINCAS", 12],
    ];
    const hoja = (nombre, rol) => {
      const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = COLS.map(([header, width]) => ({ header, width }));
      const enc = ws.getRow(1);
      enc.height = 30;
      enc.eachCell((c) => {
        c.font = { bold: true, size: 12 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = bordes;
      });
      for (const persona of bloquesPago(rol)) {
        const suma = persona.suma;
        for (const d of persona.filas) {
          const fila = ws.addRow([fmtFechaCorta(d.fecha), d.semana ?? "", d.finca.toUpperCase(), d.fincaCodigo, "", persona.nombre.toUpperCase(), d.documento, Math.round(d.hectareas * 100) / 100]);
          fila.eachCell((c, n) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
            c.border = bordes;
            c.alignment = { horizontal: n === 6 ? "left" : "center", vertical: "middle" };
          });
          fila.getCell(8).numFmt = "#,##0.00";
        }
        const tot = ws.addRow(["", "", "", "", "", "", "TOTAL HAS ASPERJADAS:", Math.round(suma * 100) / 100]);
        ws.mergeCells(tot.number, 1, tot.number, 7);
        tot.getCell(1).value = "TOTAL HAS ASPERJADAS:";
        tot.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
        tot.eachCell((c) => {
          c.font = { bold: true };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA9D08E" } };
          c.border = bordes;
        });
        tot.getCell(8).alignment = { horizontal: "center" };
        tot.getCell(8).numFmt = "#,##0.00";
      }
    };
    hoja("Pilotos", "PILOTO");
    hoja("Asistentes", "ASISTENTE");
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Hectareas-asperjadas-${filtros.desde}-a-${filtros.hasta}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium">Desde</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium">Hasta</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} />
          </div>
          <div className="col-12 col-md">
            <label className="form-label small fw-medium">Colaborador</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.colaborador} onChange={(e) => cambiar("colaborador", e.target.value)}>
              <option value="">Todos</option>
              {opcionesColaborador.map(([uuid, nombre]) => (
                <option key={uuid} value={uuid}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md">
            <label className="form-label small fw-medium">Cargo</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.cargo} onChange={(e) => cambiar("cargo", e.target.value)}>
              <option value="">Todos</option>
              {opcionesCargo.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-auto">
            <div className="form-check mb-1">
              <input type="checkbox" className="form-check-input" id="ha-solo-emitidos" checked={filtros.soloEmitidos} onChange={(e) => cambiar("soloEmitidos", e.target.checked)} />
              <label className="form-check-label small" htmlFor="ha-solo-emitidos" title="Solo comprobantes aprobados (emitidos), sin los borradores">
                Solo emitidos
              </label>
            </div>
          </div>
          {vista === "tabla" && (
            <div className="col-12 col-md-auto">
              <button type="button" className="btn btn-outline-success btn-sm rounded-3 d-flex align-items-center gap-1" disabled={!detalle.length} onClick={exportar}>
                <FiDownload /> Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {cargando ? (
        <p className="text-secondary small">Cargando...</p>
      ) : !detalle.length ? (
        <p className="text-secondary small">
          No hay hectáreas asperjadas en este periodo. Se cuentan las aplicaciones con dron donde se eligió el piloto (y sus asistentes) del listado de colaboradores.
        </p>
      ) : vista === "tabla" ? (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <div className="btn-group btn-group-sm" role="group">
              {[
                ["pago", "Formato de pago"],
                ["dias", "Resumen por día"],
              ].map(([id, etiqueta]) => (
                <button key={id} type="button" className={`btn ${modo === id ? "btn-success" : "btn-outline-secondary"}`} onClick={() => setModo(id)}>
                  {etiqueta}
                </button>
              ))}
            </div>
            {modo === "pago" && (
              <div className="btn-group btn-group-sm" role="group">
                {[
                  ["PILOTO", "Pilotos"],
                  ["ASISTENTE", "Asistentes"],
                ].map(([id, etiqueta]) => (
                  <button key={id} type="button" className={`btn ${rolPago === id ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setRolPago(id)}>
                    {etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>

          {modo === "pago" ? (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle text-center" style={{ fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#ffff00" }}>
                      {["FECHA", "SEMANA", "FINCA", "CÓDIGO FINCA", "CÓDIGO TRABAJADOR", "NOMBRE DEL TRABAJADOR", "C.C.", "HA FINCAS"].map((h) => (
                        <th key={h} className="fw-bold" style={{ backgroundColor: "#ffff00" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bloquesPago(rolPago).length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-secondary py-3">
                          No hay {rolPago === "PILOTO" ? "pilotos" : "asistentes"} con hectáreas en este periodo.
                        </td>
                      </tr>
                    )}
                    {bloquesPago(rolPago).map((persona) => (
                      <Fragment key={persona.nombre}>
                        {persona.filas.map((d, i) => (
                          <tr key={`${persona.nombre}-${i}`} style={{ backgroundColor: "#e7e6e6" }}>
                            <td className="text-nowrap">{fmtFechaCorta(d.fecha)}</td>
                            <td>{d.semana ?? ""}</td>
                            <td>{d.finca.toUpperCase()}</td>
                            <td>{d.fincaCodigo}</td>
                            <td />
                            <td className="text-start">{persona.nombre.toUpperCase()}</td>
                            <td>{d.documento}</td>
                            <td>{ha(d.hectareas)}</td>
                          </tr>
                        ))}
                        <tr className="fw-bold" style={{ backgroundColor: "#a9d08e" }}>
                          <td colSpan={7} className="text-end">
                            TOTAL HAS ASPERJADAS:
                          </td>
                          <td>{ha(persona.suma)}</td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
          {/* Totales del periodo por colaborador (base para el pago). */}
          <div className="d-flex flex-wrap gap-2 mb-3">
            <div className="rounded-3 px-3 py-2" style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div className="small text-secondary">Total del periodo</div>
              <div className="fw-bold" style={{ color: "#166534" }}>
                {ha(total)} ha
              </div>
            </div>
            {porColaborador.map((c) => (
              <div key={c.colaborador + c.cargo} className="rounded-3 px-3 py-2 bg-white" style={{ border: "1px solid #e2e8f0" }}>
                <div className="small fw-semibold">{c.colaborador}</div>
                <div className="small text-secondary">
                  {c.cargo} · {c.aplicaciones} aplicación(es)
                </div>
                <div className="fw-bold">{ha(c.hectareas)} ha</div>
              </div>
            ))}
          </div>

          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.78rem" }}>
                <thead className="table-light">
                  <tr className="text-secondary">
                    <th className="fw-medium" style={{ width: 28 }} />
                    <th className="fw-medium">Fecha</th>
                    <th className="fw-medium">Colaborador</th>
                    <th className="fw-medium">Cargo</th>
                    <th className="fw-medium text-center">Aplicaciones</th>
                    <th className="fw-medium text-end">Hectáreas</th>
                  </tr>
                </thead>
                <tbody>
                  {porDiaColaborador.map((g) => {
                    const abierto = abiertos.has(g.id);
                    return (
                      <Fragment key={g.id}>
                        <tr style={{ cursor: "pointer" }} onClick={() => alternar(g.id)} title="Ver las aplicaciones de ese día">
                          <td className="text-secondary">{abierto ? <FiChevronDown /> : <FiChevronRight />}</td>
                          <td className="text-nowrap">{fechaLarga(g.fecha)}</td>
                          <td className="fw-medium">{g.colaborador}</td>
                          <td className="text-secondary">{g.cargo}</td>
                          <td className="text-center">{g.aplicaciones}</td>
                          <td className="text-end fw-semibold">{ha(g.hectareas)}</td>
                        </tr>
                        {abierto &&
                          g.filas.map((d, i) => (
                            <tr key={`${g.id}-${i}`} style={{ backgroundColor: "#f8fafc" }}>
                              <td />
                              <td colSpan={2} className="text-secondary ps-4">
                                {d.rol === "PILOTO" ? "Piloto" : "Asistente"} · {d.finca}
                              </td>
                              <td className="text-secondary">
                                {d.aspersion} · {d.comprobante}
                                {d.estado === "BORRADOR" && <span className="badge rounded-pill ms-2" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>Borrador</span>}
                              </td>
                              <td />
                              <td className="text-end text-secondary">{ha(d.hectareas)}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <td colSpan={4} className="fw-semibold">
                      Total
                    </td>
                    <td className="text-center fw-semibold">{detalle.length}</td>
                    <td className="text-end fw-bold">{ha(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
            </>
          )}
        </>
      ) : (
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
              <div className="fw-semibold small mb-2">Hectáreas por colaborador</div>
              <ResponsiveContainer width="100%" height={Math.max(220, porColaborador.length * 34)}>
                <BarChart data={porColaborador.map((c) => ({ nombre: c.colaborador, hectareas: Math.round(c.hectareas * 100) / 100 }))} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${ha(v)} ha`, "Hectáreas"]} />
                  <Bar dataKey="hectareas" fill={VERDE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
              <div className="fw-semibold small mb-2">Hectáreas por cargo</div>
              <ResponsiveContainer width="100%" height={Math.max(220, porCargo.length * 44)}>
                <BarChart data={porCargo.map((c) => ({ cargo: c.cargo, hectareas: Math.round(c.hectareas * 100) / 100 }))} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="cargo" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${ha(v)} ha`, "Hectáreas"]} />
                  <Bar dataKey="hectareas" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4 p-3">
              <div className="fw-semibold small mb-2">Hectáreas asperjadas por día (suma de todos los participantes)</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={porDia} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${ha(v)} ha`, "Hectáreas"]} labelFormatter={(_, p) => (p?.[0]?.payload?.fecha ? fechaLarga(p[0].payload.fecha) : "")} />
                  <Line type="monotone" dataKey="hectareas" stroke={VERDE} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
