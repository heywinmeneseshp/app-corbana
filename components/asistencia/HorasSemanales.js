"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiDownload, FiSettings } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { SelectorUbicacion, aParametros } from "./ubicaciones";

const hoyBogota = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const restarDias = (fecha, n) => new Date(new Date(`${fecha}T12:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10);
const horas = (min) => (min ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}` : "—");
const horasDecimal = (min) => Math.round((min / 60) * 100) / 100;
const hh = (min) => (min === null || min === undefined ? "—" : horas(Math.round(min)));

const COLOR_SITIO = "#166534";
const COLOR_TRANSITO = "#7c3aed";
const COLOR_NOVEDAD = "#b45309";

// Promedios por colaborador a partir de sus semanas. Solo cuentan las semanas completas (ya terminadas), con horas y sin novedades
// (vacaciones, incapacidades, permisos…): una semana con novedad no representa su ritmo normal, así que se excluye y se informa aparte.
function calcular(x, semanas, hoy) {
  const detalle = semanas.map((s) => {
    const sitio = x.semanas[s.codigo] || 0;
    const transito = x.transitoSemanas?.[s.codigo] || 0;
    const novedad = x.novedadesSemanas?.[s.codigo] || 0;
    const enCurso = Boolean(s.hasta && s.hasta >= hoy);
    const conDatos = sitio + transito > 0;
    const valida = !enCurso && conDatos && novedad === 0;
    return { codigo: s.codigo, desde: s.desde, hasta: s.hasta, sitio, transito, total: sitio + transito, novedad, enCurso, conDatos, valida };
  });
  const validas = detalle.filter((d) => d.valida);
  const n = validas.length;
  const suma = (k) => validas.reduce((t, d) => t + d[k], 0);
  return {
    detalle,
    n,
    promSitio: n ? suma("sitio") / n : null,
    promTransito: n ? suma("transito") / n : null,
    promTotal: n ? suma("total") / n : null,
    semanasNovedad: detalle.filter((d) => d.novedad > 0).length,
  };
}

function Tarjeta({ titulo, valor, detalle, color, ayuda }) {
  return (
    <div className="card border-0 rounded-3 h-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)", borderLeft: `4px solid ${color || "#cbd5e1"}` }} title={ayuda}>
      <div className="card-body py-2 px-3">
        <div className="text-secondary" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {titulo}
        </div>
        <div className="fw-bold" style={{ fontSize: "1.35rem", color: color || undefined }}>
          {valor}
        </div>
        {detalle && <div className="text-secondary" style={{ fontSize: "0.72rem" }}>{detalle}</div>}
      </div>
    </div>
  );
}

// Barra del promedio total contra la meta: la parte verde es el sitio y la morada el tránsito; la línea marca la meta.
function BarraMeta({ sitio, transito, meta }) {
  const maxMin = Math.max(meta * 60 * 1.25, sitio + transito);
  const pct = (m) => `${(m / maxMin) * 100}%`;
  return (
    <div className="position-relative rounded-pill overflow-hidden" style={{ height: 10, background: "#e5e7eb", minWidth: 110 }}>
      <div className="position-absolute top-0 start-0 h-100" style={{ width: pct(sitio), background: COLOR_SITIO }} />
      <div className="position-absolute top-0 h-100" style={{ left: pct(sitio), width: pct(transito), background: COLOR_TRANSITO }} />
      <div className="position-absolute top-0 h-100" style={{ left: pct(meta * 60), width: 2, background: "#111827" }} title={`Meta: ${meta} h`} />
    </div>
  );
}

// Informe de horas por colaborador: promedio semanal trabajado en sitio, en tránsito y la suma de ambos contra una meta configurable.
export default function HorasSemanales({ fincas, lugares = [], veTodo = true, modulo = null }) {
  const vacios = () => ({ ubicacion: "", search: "", desde: restarDias(hoyBogota(), 55), hasta: hoyBogota() });
  const [filtros, setFiltros] = useState(vacios);
  const [aplicados, setAplicados] = useState(filtros);
  const [datos, setDatos] = useState({ semanas: [], items: [], metaHoras: 44 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaForm, setMetaForm] = useState("");
  const [guardandoMeta, setGuardandoMeta] = useState(false);
  const admin = (getCurrentUser()?.roles || []).includes("Administrador");

  useEffect(() => {
    const t = setTimeout(() => setAplicados((a) => (JSON.stringify(a) === JSON.stringify(filtros) ? a : filtros)), 300);
    return () => clearTimeout(t);
  }, [filtros]);

  useEffect(() => {
    let activo = true;
    const { ubicacion, ...resto } = aplicados;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...resto, ...aParametros(ubicacion) })) if (v) qs.set(k, v);
    if (modulo) qs.set("modulo", modulo);
    apiFetch(`/asistencia/horas-semanales?${qs}`)
      .then((d) => activo && (setDatos(d), setError("")))
      .catch((err) => activo && setError(err.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [aplicados, modulo]);

  const cambiar = (k, v) => {
    setCargando(true);
    setFiltros((f) => ({ ...f, [k]: v }));
  };
  const { semanas = [], items = [], metaHoras = 44 } = datos;
  const metaMin = metaHoras * 60;
  const hoy = hoyBogota();
  const semanasReales = useMemo(() => semanas.filter((s) => s.desde), [semanas]);

  const filas = useMemo(
    () =>
      items
        .map((x) => ({ x, c: calcular(x, semanasReales, hoy) }))
        .sort((a, b) => (b.c.promTotal ?? -1) - (a.c.promTotal ?? -1) || a.x.colaborador.nombre.localeCompare(b.x.colaborador.nombre, "es")),
    [items, semanasReales, hoy],
  );

  const resumen = useMemo(() => {
    const con = filas.filter((f) => f.c.n > 0);
    const prom = (k) => (con.length ? con.reduce((t, f) => t + f.c[k], 0) / con.length : null);
    const novedades = {};
    let diasNovedad = 0;
    for (const { x } of filas) {
      diasNovedad += x.novedades || 0;
      for (const [tipo, n] of Object.entries(x.novedadTipos || {})) novedades[tipo] = (novedades[tipo] || 0) + n;
    }
    return {
      colaboradores: con.length,
      promSitio: prom("promSitio"),
      promTransito: prom("promTransito"),
      promTotal: prom("promTotal"),
      cumplen: con.filter((f) => f.c.promTotal >= metaMin).length,
      conNovedad: filas.filter((f) => f.c.semanasNovedad > 0).length,
      semanasExcluidas: filas.reduce((t, f) => t + f.c.semanasNovedad, 0),
      diasNovedad,
      novedades,
    };
  }, [filas, metaMin]);

  const colorTotal = (min) => (min === null ? undefined : min >= metaMin ? COLOR_SITIO : min >= metaMin * 0.9 ? COLOR_NOVEDAD : "#b91c1c");
  const alternar = (uuid) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(uuid)) n.delete(uuid);
      else n.add(uuid);
      return n;
    });

  async function guardarMeta() {
    setGuardandoMeta(true);
    try {
      const r = await apiFetch("/asistencia/horas-semanales/meta", { method: "PUT", body: JSON.stringify({ horas: Number(metaForm) }) });
      setDatos((d) => ({ ...d, metaHoras: r.metaHoras }));
      setEditandoMeta(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoMeta(false);
    }
  }

  async function exportar() {
    const ExcelJS = (await import("exceljs")).default;
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Promedio por semana");
    hoja.columns = [
      { header: "Colaborador", key: "nombre", width: 32 },
      { header: "Identificación", key: "documento", width: 16 },
      { header: "Cargo", key: "cargo", width: 22 },
      { header: "Prom. en sitio (h/sem)", key: "sitio", width: 20 },
      { header: "Prom. en tránsito (h/sem)", key: "transito", width: 22 },
      { header: "Prom. total (h/sem)", key: "total", width: 18 },
      { header: `Meta (${metaHoras} h)`, key: "meta", width: 14 },
      { header: "Semanas promediadas", key: "n", width: 18 },
      { header: "Semanas con novedad (excluidas)", key: "excluidas", width: 28 },
      { header: "Días con novedad", key: "dias", width: 16 },
      { header: "Jornadas incompletas", key: "incompletas", width: 18 },
    ];
    hoja.getRow(1).font = { bold: true };
    for (const { x, c } of filas) {
      hoja.addRow({
        nombre: x.colaborador.nombre,
        documento: x.colaborador.documento || "",
        cargo: x.colaborador.cargo || "",
        sitio: c.promSitio === null ? "" : horasDecimal(c.promSitio),
        transito: c.promTransito === null ? "" : horasDecimal(c.promTransito),
        total: c.promTotal === null ? "" : horasDecimal(c.promTotal),
        meta: c.promTotal === null ? "" : c.promTotal >= metaMin ? "Cumple" : "No cumple",
        n: c.n,
        excluidas: c.semanasNovedad,
        dias: x.novedades,
        incompletas: x.incompletas,
      });
    }
    const det = libro.addWorksheet("Detalle semanal");
    det.columns = [
      { header: "Colaborador", key: "nombre", width: 32 },
      { header: "Semana", key: "semana", width: 12 },
      { header: "En sitio (h)", key: "sitio", width: 14 },
      { header: "En tránsito (h)", key: "transito", width: 16 },
      { header: "Total (h)", key: "total", width: 12 },
      { header: "Días con novedad", key: "novedad", width: 16 },
      { header: "Estado", key: "estado", width: 22 },
    ];
    det.getRow(1).font = { bold: true };
    for (const { x, c } of filas)
      for (const d of c.detalle) {
        if (!d.conDatos && !d.novedad) continue;
        det.addRow({
          nombre: x.colaborador.nombre,
          semana: d.codigo,
          sitio: horasDecimal(d.sitio),
          transito: horasDecimal(d.transito),
          total: horasDecimal(d.total),
          novedad: d.novedad || "",
          estado: d.valida ? "Promediada" : d.novedad ? "Excluida por novedad" : d.enCurso ? "Semana en curso" : "Sin horas",
        });
      }
    const blob = new Blob([await libro.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `promedio-horas-semana-${aplicados.desde}-a-${aplicados.hasta}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const cols = 9;
  return (
    <>
      <div className="card border-0 rounded-2 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Ubicación</label>
              <SelectorUbicacion fincas={fincas} lugares={lugares} value={filtros.ubicacion} onChange={(v) => cambiar("ubicacion", v)} />
            </div>
            {veTodo && (
              <div className="col-6 col-md">
                <label className="form-label small fw-medium">Colaborador</label>
                <input type="search" className="form-control form-control-sm rounded-3" placeholder="Nombre o identificación" value={filtros.search} onChange={(e) => cambiar("search", e.target.value)} />
              </div>
            )}
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Desde</label>
              <input type="date" className="form-control form-control-sm rounded-3" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} />
            </div>
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Hasta</label>
              <input type="date" className="form-control form-control-sm rounded-3" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} />
            </div>
            <div className="col-12 col-md-auto d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" disabled={!items.length} onClick={exportar}>
                <FiDownload /> Excel
              </button>
            </div>
          </div>
          <div className="small text-secondary mt-2">
            El rango se ajusta a semanas completas. Solo se promedian las semanas terminadas, con horas y <strong>sin novedades</strong> (vacaciones, incapacidades, permisos…); las demás se cuentan aparte. Total = sitio + tránsito.
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="row g-2 mb-3">
        <div className="col-6 col-lg">
          <Tarjeta titulo="Promedio total / semana" valor={hh(resumen.promTotal)} color={colorTotal(resumen.promTotal)} detalle={`Sitio + tránsito · ${resumen.colaboradores} colaboradores`} ayuda="Promedio de los promedios de cada colaborador" />
        </div>
        <div className="col-6 col-lg">
          <Tarjeta titulo="En sitio / semana" valor={hh(resumen.promSitio)} color={COLOR_SITIO} detalle="Tiempo dentro de fincas y lugares" />
        </div>
        <div className="col-6 col-lg">
          <Tarjeta titulo="En tránsito / semana" valor={hh(resumen.promTransito)} color={COLOR_TRANSITO} detalle="Entre la salida de un sitio y la entrada al siguiente" />
        </div>
        <div className="col-6 col-lg">
          <Tarjeta
            titulo="Cumplen la meta"
            valor={`${resumen.cumplen} de ${resumen.colaboradores}`}
            color={resumen.colaboradores && resumen.cumplen === resumen.colaboradores ? COLOR_SITIO : "#334155"}
            detalle={
              <span className="d-inline-flex align-items-center gap-1">
                Meta {editandoMeta ? (
                  <>
                    <input type="number" min="1" max="168" step="0.5" className="form-control form-control-sm py-0" style={{ width: 64 }} value={metaForm} onChange={(e) => setMetaForm(e.target.value)} />
                    <button type="button" className="btn btn-link btn-sm p-0" disabled={guardandoMeta} onClick={guardarMeta}>Guardar</button>
                    <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={() => setEditandoMeta(false)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    {metaHoras} h / semana
                    {admin && (
                      <button type="button" className="btn btn-link btn-sm p-0 text-secondary" title="Configurar la meta" onClick={() => (setMetaForm(String(metaHoras)), setEditandoMeta(true))}>
                        <FiSettings size={12} />
                      </button>
                    )}
                  </>
                )}
              </span>
            }
          />
        </div>
        <div className="col-12 col-lg">
          <Tarjeta
            titulo="Con novedades"
            valor={`${resumen.conNovedad} colab.`}
            color={COLOR_NOVEDAD}
            detalle={
              resumen.semanasExcluidas
                ? `${resumen.semanasExcluidas} semanas excluidas · ${resumen.diasNovedad} días${Object.keys(resumen.novedades).length ? ` (${Object.entries(resumen.novedades).map(([t, n]) => `${t.toLowerCase().replaceAll("_", " ")} ${n}`).join(", ")})` : ""}`
                : "Ninguna semana excluida"
            }
          />
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.78rem" }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: 28 }} />
                <th className="fw-medium">Colaborador</th>
                <th className="fw-medium">Cargo</th>
                <th className="fw-medium text-center" style={{ color: COLOR_SITIO }}>Prom. sitio</th>
                <th className="fw-medium text-center" style={{ color: COLOR_TRANSITO }}>Prom. tránsito</th>
                <th className="fw-medium" style={{ minWidth: 170 }}>Prom. total vs meta ({metaHoras} h)</th>
                <th className="fw-medium text-center" title="Semanas incluidas en el promedio">Semanas</th>
                <th className="fw-medium text-center" title="Semanas excluidas por tener vacaciones, incapacidad, permiso…" style={{ color: COLOR_NOVEDAD }}>Con novedad</th>
                <th className="fw-medium text-center" title="Jornadas sin entrada o sin salida: no suman horas">Incompletas</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={cols} className="text-center text-secondary py-4">Cargando...</td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="text-center text-secondary py-4">No hay jornadas en este rango.</td>
                </tr>
              ) : (
                filas.map(({ x, c }) => {
                  const abierto = abiertos.has(x.colaborador.uuid);
                  return (
                    <Fragment key={x.colaborador.uuid}>
                      <tr style={{ cursor: "pointer" }} onClick={() => alternar(x.colaborador.uuid)}>
                        <td className="text-secondary">{abierto ? <FiChevronDown /> : <FiChevronRight />}</td>
                        <td className="fw-medium text-nowrap">{x.colaborador.nombre}</td>
                        <td className="text-secondary">{x.colaborador.cargo || "—"}</td>
                        <td className="text-center">{hh(c.promSitio)}</td>
                        <td className="text-center" style={{ color: c.promTransito ? COLOR_TRANSITO : undefined }}>{hh(c.promTransito)}</td>
                        <td>
                          {c.promTotal === null ? (
                            <span className="text-secondary" title="Sin semanas completas y sin novedades en el rango">—</span>
                          ) : (
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-semibold text-nowrap" style={{ color: colorTotal(c.promTotal), minWidth: 42 }}>{hh(c.promTotal)}</span>
                              <div className="flex-grow-1">
                                <BarraMeta sitio={c.promSitio} transito={c.promTransito} meta={metaHoras} />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="text-center">{c.n || "—"}</td>
                        <td className="text-center" style={{ color: c.semanasNovedad ? COLOR_NOVEDAD : undefined }}>
                          {c.semanasNovedad ? (
                            <span title={Object.entries(x.novedadTipos || {}).map(([t, n]) => `${t.toLowerCase().replaceAll("_", " ")}: ${n} día(s)`).join("\n")}>
                              {c.semanasNovedad} <span className="text-secondary">({x.novedades} d)</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-center" style={{ color: x.incompletas ? COLOR_NOVEDAD : undefined }}>{x.incompletas || "—"}</td>
                      </tr>
                      {abierto && (
                        <tr className="table-light">
                          <td />
                          <td colSpan={cols - 1} className="py-2">
                            <table className="table table-sm mb-0" style={{ fontSize: "0.74rem", maxWidth: 640 }}>
                              <thead>
                                <tr className="text-secondary">
                                  <th>Semana</th>
                                  <th className="text-center">En sitio</th>
                                  <th className="text-center">En tránsito</th>
                                  <th className="text-center">Total</th>
                                  <th>Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.detalle.filter((d) => d.conDatos || d.novedad).map((d) => (
                                  <tr key={d.codigo} style={{ opacity: d.valida ? 1 : 0.75 }}>
                                    <td className="text-nowrap" title={d.desde ? `${d.desde} a ${d.hasta}` : undefined}>{d.codigo}</td>
                                    <td className="text-center">{horas(d.sitio)}</td>
                                    <td className="text-center" style={{ color: d.transito ? COLOR_TRANSITO : undefined }}>{horas(d.transito)}</td>
                                    <td className="text-center fw-semibold" style={{ color: d.valida ? colorTotal(d.total) : undefined }}>{horas(d.total)}</td>
                                    <td style={{ color: d.novedad ? COLOR_NOVEDAD : undefined }}>
                                      {d.valida ? "Promediada" : d.novedad ? `Excluida: ${d.novedad} día(s) con novedad` : d.enCurso ? "Semana en curso" : "Sin horas"}
                                    </td>
                                  </tr>
                                ))}
                                {!c.detalle.some((d) => d.conDatos || d.novedad) && (
                                  <tr><td colSpan={5} className="text-secondary">Sin horas en el rango.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
