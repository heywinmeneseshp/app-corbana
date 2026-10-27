"use client";

import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiSend, FiUsers, FiFileText, FiLayers, FiCalendar, FiMapPin, FiHash, FiSliders, FiTag, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { apiFetch, apiFetchFormData, apiFetchTodos } from "@/lib/api";
import { esAdministrador } from "@/lib/laborEstados";
import DestinatariosInformeModal from "@/components/reportes/DestinatariosInformeModal";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";
import TablaMovimientosSemana, { FILAS_CONCEPTO } from "@/components/reportes/TablaMovimientosSemana";
import ModalShell from "@/components/ModalShell";
import { generarInformeSemanalPdf, nombrePdfInforme } from "@/lib/informeSemanalPdf";

const n0 = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: 0 }));
const n2 = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (v) => (v === null || v === undefined ? "—" : `${Number(v).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

// Fondo de una fila de indicadores: Total cortados en gris claro con línea verde arriba (fila de total); Cajas y Ratio con verde muy suave.
const fondoFila = (op) =>
  op.total ? FILA_TOTAL : op.fuerte ? { backgroundColor: "#f0fdf4" } : undefined;

// Estilo de las filas de total (Total cortados, total de repicados).
const FILA_TOTAL = { backgroundColor: "#f1f5f9", color: "#0f172a", borderTop: "2px solid #14532d" };

// Punto con el color de la cinta (al pasar el mouse: color y consecutivo).
function PuntoCinta({ color, consecutivo }) {
  return (
    <span
      className="d-inline-block rounded-circle me-2 align-middle"
      title={`Cinta ${color} ${consecutivo}`}
      style={{ width: 10, height: 10, backgroundColor: COLOR_HEX[color] || "#94a3b8", border: color === "Blanco" ? "1px solid #94a3b8" : "none" }}
    />
  );
}

// Barra horizontal de proporción (para % de cortados por edad y para recobro/aprovechamiento).
function Barra({ valor, max = 100, color = "#16a34a" }) {
  const ancho = Math.max(0, Math.min(100, (Number(valor) / max) * 100));
  return (
    <div className="rounded-pill" style={{ height: 6, background: "#e2e8f0", overflow: "hidden" }}>
      <div className="rounded-pill" style={{ width: `${ancho}%`, height: "100%", background: color }} />
    </div>
  );
}

// Título de sección con ícono en círculo verde claro.
function TituloSeccion({ icono, children, extra = null }) {
  return (
    <h3 className="h6 fw-semibold mb-2 d-flex align-items-center gap-2 flex-wrap" style={{ color: "#0f172a" }}>
      <span className="rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 26, height: 26, background: "#ecfdf5", color: "#059669" }}>
        {icono}
      </span>
      {children}
      {extra}
    </h3>
  );
}

// Tabla con borde redondeado y encabezado verde de la marca. El fondo va en cada <th>: Bootstrap pinta las celdas, no el <thead>.
// `titulo`: en vez de los nombres de las columnas, una sola fila de encabezado con ese título a todo el ancho.
// `llenar`: la tabla ocupa todo el alto de su contenedor (las filas se reparten el espacio), para alinear columnas vecinas.
function Tabla({ columnas, titulo = null, subtitulo = null, llenar = false, children }) {
  return (
    <div className={`table-responsive rounded-4 border overflow-hidden ${llenar ? "h-100" : ""}`} style={{ borderColor: "#e2e8f0" }}>
      <table className="table table-hover table-sm mb-0 align-middle small tabla-informe" style={llenar ? { height: "100%" } : undefined}>
        <thead>
          {subtitulo && (
            <tr>
              <th colSpan={columnas.length} className="fw-semibold py-2 text-center" style={{ backgroundColor: "#14532d", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                {subtitulo}
              </th>
            </tr>
          )}
          {titulo ? (
            <tr>
              <th colSpan={columnas.length} className="fw-semibold py-2 text-center" style={{ backgroundColor: "#14532d", color: "#fff", borderBottom: "none" }}>
                {titulo}
              </th>
            </tr>
          ) : (
          <tr>
            {columnas.map(([titulo]) => (
              <th
                key={titulo}
                className="small fw-semibold py-2 text-center"
                style={{ backgroundColor: "#14532d", color: "#fff", borderBottom: "none" }}
              >
                {titulo}
              </th>
            ))}
          </tr>
          )}
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function filasIndicadoresDe(ind) {
  return [
    ["Racimos procesados", n0(ind.racimosProcesados)],
    ["Racimos recusados", n0(ind.racimosRecusados)],
    ["Total cortados", n0(ind.totalCortados), true],
    ["Hectáreas en producción", n2(ind.hectareasProduccion)],
    ["Embolses por hectárea", n2(ind.embolsesPorHectarea)],
    ["Cajas producidas 20 kg", n0(ind.cajas), true],
    ["Cajas por hectárea", n2(ind.cajasPorHectarea)],
    ["Ratio", ind.ratio === null ? "—" : Number(ind.ratio).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), true],
    ["Peso neto racimo", "Sin dato"],
    ["Peso vástago", "Sin dato"],
    ["Peso bruto racimo", "Sin dato"],
    ["Merma", "Sin dato"],
  ];
}

// Agrega al libro una hoja con el informe de una finca (mismo contenido que se ve en pantalla).
function agregarHojaInforme(wb, data, movimientos, nombreHoja = null) {
  const ws = wb.addWorksheet(nombreHoja || `${data.semana.codigo} ${data.finca.nombre}`.slice(0, 30));
  const verde = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
  const titulo = (t) => {
    const r = ws.addRow([t]);
    r.getCell(1).font = { bold: true, size: 12, color: { argb: "FF14532D" } };
  };
  const cabecera = (cols) => {
    const r = ws.addRow(cols);
    r.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = verde;
    });
  };
  titulo(`Informe ${data.semana.codigo} — ${data.finca.nombre}`);
  ws.addRow(["Año", data.semana.anio, "Semana", data.semana.numeroSemana, "Código finca", data.finca.codigo]);
  ws.addRow([]);
  cabecera(["Indicador", "Valor"]);
  filasIndicadoresDe(data.indicadores).forEach(([l, v]) => ws.addRow([l, v]));
  ws.addRow([]);
  titulo(`Repicados ${data.semana.codigo}`);
  cabecera(["Cinta", "Edad", "Motivo", "Cantidad"]);
  data.repicados.forEach((r) => ws.addRow([`${r.semana} (${r.color})`, r.edad, r.motivo, r.cantidad]));
  ws.addRow(["Total", "", "", data.totalRepicados]).font = { bold: true };
  ws.addRow([]);
  titulo(`Cortados ${data.semana.codigo} por edad`);
  cabecera(["Cinta", "Edad", "Cortados", "%"]);
  data.cortadosPorEdad.forEach((c) => {
    ws.addRow([`${c.semana} (${c.color})`, c.edad, c.cantidad, c.porcentaje / 100]).getCell(4).numFmt = "0.00%";
  });
  ws.addRow([]);
  if (data.infocinta) {
    titulo(`Cinta barrida — ${data.infocinta.color} ${data.infocinta.consecutivo}, edad ${data.infocinta.edad}`);
    const i = data.infocinta;
    [
      ["Color de la cinta", `${i.color} ${i.consecutivo}`],
      ["Edad", i.edad],
      ["Semana de embolse", i.semana],
      ["Embolsado", i.embolsado],
      ["Repicado", i.repicado],
      ["Recusado", i.recusado],
      ["Procesado", i.procesado],
      ["Racimos perdidos", i.perdidos],
      ["Recobro", i.recobro === null ? "" : i.recobro / 100],
      ["Aprovechamiento", i.aprovechamiento === null ? "" : i.aprovechamiento / 100],
    ].forEach((r) => {
      const row = ws.addRow(r);
      if (r[0] === "Recobro" || r[0] === "Aprovechamiento") row.getCell(2).numFmt = "0.00%";
    });
    ws.addRow([]);
  }
  titulo(`Ajustes ${data.semana.codigo}`);
  cabecera(["Edad", "Tipo", "Motivo", "Cantidad"]);
  if (data.ajustes.length === 0) ws.addRow(["Sin ajustes"]);
  data.ajustes.forEach((a) => ws.addRow([a.edad, a.tipo, a.motivo, a.cantidad]));
  ws.addRow([]);
  if (movimientos) {
    titulo(`Saldo y movimientos ${data.semana.codigo}`);
    const cols = movimientos.cohortes;
    cabecera(["Concepto / Lote", ...cols.map((c) => `${c.semanaCodigo} ${c.color} (edad ${c.edadSemanas})`)]);
    ws.addRow(["Saldo inicial", ...cols.map((c) => c.saldoInicial)]).font = { bold: true };
    for (const f of FILAS_CONCEPTO) ws.addRow([f.label, ...cols.map((c) => f.sign * c[f.key])]);
    ws.addRow(["Saldo final", ...cols.map((c) => c.saldoFinal)]).font = { bold: true };
    for (const lote of movimientos.lotes || []) {
      if (!cols.some((c) => (lote.saldoFinal[c.semanaUuid] || 0) !== 0)) continue;
      ws.addRow([`    ${lote.codigo} — ${lote.nombre}`, ...cols.map((c) => lote.saldoFinal[c.semanaUuid] || 0)]);
    }
  }
  ws.getColumn(1).width = 26;
  for (let c = 2; c <= 16; c++) ws.getColumn(c).width = 16;
}

// Informe semanal de producción de una finca (mismo contenido que el informe que se llevaba en hoja de cálculo). Datos de
// GET /dashboard/informe-semanal.
export default function InformeSemanal() {
  const [fincas, setFincas] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [semanaUuid, setSemanaUuid] = useState("");
  const [data, setData] = useState(null);
  // Saldo y Movimientos de la misma finca y semana (misma tabla que Reportes → Saldo y Movimientos).
  const [movimientos, setMovimientos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [aviso, setAviso] = useState(null);
  const [verDestinatarios, setVerDestinatarios] = useState(false);
  const [esAdmin] = useState(() => esAdministrador());

  useEffect(() => {
    Promise.all([apiFetch("/fincas?limit=100"), apiFetchTodos("/semanas?limit=100")])
      .then(([f, s]) => {
        const propias = (f.items || []).filter((x) => !x.esExterna && x.estado !== false);
        setFincas(propias);
        const hoy = new Date().toISOString().slice(0, 10);
        setSemanas((s.items || []).filter((x) => String(x.fechaInicio).slice(0, 10) <= hoy).sort((a, b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio))));
        if (propias.length) setFincaUuid(propias[0].uuid);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!fincaUuid) return;
    let vivo = true;
    setLoading(true);
    setError("");
    setMovimientos(null);
    const qs = new URLSearchParams({ fincaUuid });
    if (semanaUuid) qs.set("semanaUuid", semanaUuid);
    apiFetch(`/dashboard/informe-semanal?${qs}`)
      .then((r) => {
        if (!vivo) return;
        setData(r);
        const qm = new URLSearchParams({ fincaUuid, semanaRegistroUuid: r.semana.uuid, anio: String(r.semana.anio), cantidadSemanas: "13" });
        return apiFetch(`/racimo-movimientos/reporte-movimientos-semana?${qm}`).then((m) => vivo && setMovimientos(m));
      })
      .catch((err) => vivo && setError(err.message))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
  }, [fincaUuid, semanaUuid]);

  const ind = data?.indicadores;
  const filasIndicadores = ind ? filasIndicadoresDe(ind) : [];

  // Arma el Excel del informe (el mismo se descarga o se adjunta al correo).
  async function construirExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    agregarHojaInforme(wb, data, movimientos);
    const buffer = await wb.xlsx.writeBuffer();
    return { blob: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombre: `informe-${data.semana.codigo}-${data.finca.nombre}.xlsx` };
  }

  async function exportarExcel() {
    const { blob, nombre } = await construirExcel();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Envío de TODAS las fincas: un correo por finca, cada uno con su propio Excel (mismo envío que «Enviar finca»). Con una semana elegida
  // se usa esa para todas; si no, cada finca va con su propia última semana cerrada. Si una finca falla, se sigue con las demás.
  async function enviarTodas() {
    if (!confirm(`¿Enviar ${fincas.length} correos, uno por finca${semanaUuid ? ` (semana ${data?.semana?.codigo})` : " (última semana cerrada de cada una)"}, a los destinatarios configurados?`)) return;
    setEnviando(true);
    setAviso(null);
    const ok = [];
    const fallidas = [];
    const sinDestinatarios = [];
    for (let i = 0; i < fincas.length; i++) {
      const f = fincas[i];
      setProgreso(`Enviando ${i + 1} de ${fincas.length}: ${f.nombre}`);
      try {
        const qs = new URLSearchParams({ fincaUuid: f.uuid });
        if (semanaUuid) qs.set("semanaUuid", semanaUuid);
        const inf = await apiFetch(`/dashboard/informe-semanal?${qs}`);
        const qm = new URLSearchParams({ fincaUuid: f.uuid, semanaRegistroUuid: inf.semana.uuid, anio: String(inf.semana.anio), cantidadSemanas: "13" });
        const mov = await apiFetch(`/racimo-movimientos/reporte-movimientos-semana?${qm}`).catch(() => null);
        const pdf = generarInformeSemanalPdf(inf, mov).output("blob");
        const fd = new FormData();
        fd.append("fincaUuid", f.uuid);
        fd.append("semanaUuid", inf.semana.uuid);
        fd.append("pdf", pdf, nombrePdfInforme(inf));
        const r = await apiFetchFormData("/dashboard/informe-semanal/enviar", fd);
        if (r.omitido) sinDestinatarios.push(f.nombre);
        else ok.push(`${f.nombre} (${r.destinatarios.length})`);
      } catch (err) {
        fallidas.push(`${f.nombre}: ${err.message}`);
        // Sin destinatarios configurados fallarían todas igual: se corta ahí.
        if (/destinatarios configurados/i.test(err.message)) break;
      }
    }
    setEnviando(false);
    setProgreso("");
    setAviso({
      tipo: fallidas.length === 0 ? "success" : ok.length === 0 ? "danger" : "warning",
      texto:
        `${ok.length} correo(s) enviado(s)${ok.length ? `: ${ok.join(", ")}` : ""}.` +
        (sinDestinatarios.length ? ` Sin destinatarios con la finca asignada: ${sinDestinatarios.join(", ")}.` : "") +
        (fallidas.length ? ` No se enviaron: ${fallidas.join(" · ")}` : ""),
    });
  }

  // Envío manual por correo a los destinatarios configurados (nunca automático).
  async function enviarInforme() {
    if (!confirm(`¿Enviar por correo el informe ${data.semana.codigo} de ${data.finca.nombre} a los destinatarios configurados?`)) return;
    setEnviando(true);
    setAviso(null);
    try {
      const fd = new FormData();
      fd.append("fincaUuid", data.finca.uuid);
      fd.append("semanaUuid", data.semana.uuid);
      fd.append("pdf", generarInformeSemanalPdf(data, movimientos).output("blob"), nombrePdfInforme(data));
      const r = await apiFetchFormData("/dashboard/informe-semanal/enviar", fd);
      setAviso(
        r.omitido
          ? { tipo: "warning", texto: `No se envió: ninguno de los destinatarios tiene asignada ${data.finca.nombre}.` }
          : { tipo: "success", texto: `Informe enviado a ${r.destinatarios.length} destinatario(s): ${r.destinatarios.join(", ")}.` },
      );
    } catch (err) {
      setAviso({ tipo: "danger", texto: err.message });
    } finally {
      setEnviando(false);
    }
  }

  const cinta = data?.infocinta;
  const [verDetalleRepicados, setVerDetalleRepicados] = useState(false);
  // Repicados por motivo (de mayor a menor) para el resumen; el detalle por edad queda plegado.
  const repicadosPorMotivo = useMemo(() => {
    const m = new Map();
    for (const r of data?.repicados || []) m.set(r.motivo, (m.get(r.motivo) || 0) + r.cantidad);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const maxCortados = Math.max(1, ...(data?.cortadosPorEdad || []).map((c) => c.porcentaje));

  return (
    <div className="rounded-4 border shadow-sm p-3 p-lg-4 mb-3" style={{ background: "#ffffff" }}>
      {/* Encabezado: título y filtros */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white"
            style={{ width: 38, height: 38, background: "linear-gradient(135deg,#16a34a,#0d9488)" }}
          >
            <FiFileText size={18} />
          </div>
          <div>
            <h2 className="h6 fw-bold mb-0" style={{ color: "#0f172a" }}>
              Informe de la semana
            </h2>
            <p className="text-secondary small mb-0">Producción, cortes, cinta barrida y saldos de la finca</p>
          </div>
        </div>
        {/* Barra a todo el ancho: filtros a la izquierda, acciones a la derecha */}
        <div className="d-flex flex-wrap gap-2 align-items-end w-100 pt-2" style={{ borderTop: "1px solid #f1f5f9" }}>
          <div style={{ flex: "1 1 200px", maxWidth: 320 }}>
            <label className="form-label small fw-medium text-secondary mb-1">Finca</label>
            <select
              className="form-select form-select-sm rounded-3 shadow-sm"
              style={{ width: "100%", borderColor: "#e2e8f0" }}
              value={fincaUuid}
              onChange={(e) => {
                // Al cambiar de finca se vuelve a su propia última semana cerrada.
                setFincaUuid(e.target.value);
                setSemanaUuid("");
              }}
            >
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small fw-medium text-secondary mb-1">Semana</label>
            <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center p-0"
              style={{ width: 31, height: 31, borderColor: "#e2e8f0" }}
              disabled={!data?.semanaAnterior || loading}
              onClick={() => setSemanaUuid(data.semanaAnterior.uuid)}
              title={data?.semanaAnterior ? `Semana anterior (${data.semanaAnterior.codigo})` : "Sin semana anterior"}
            >
              <FiChevronLeft />
            </button>
            <select className="form-select form-select-sm rounded-3 shadow-sm" style={{ width: 210, borderColor: "#e2e8f0" }} value={semanaUuid} onChange={(e) => setSemanaUuid(e.target.value)}>
              <option value="">
                {!semanaUuid && data?.semana ? data.semana.codigo : "Última cerrada"}
              </option>
              {semanas.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.codigo}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center p-0"
              style={{ width: 31, height: 31, borderColor: "#e2e8f0" }}
              disabled={!data?.semanaSiguiente || loading}
              onClick={() => setSemanaUuid(data.semanaSiguiente.uuid)}
              title={data?.semanaSiguiente ? `Semana siguiente (${data.semanaSiguiente.codigo})` : "Es la última semana cerrada"}
            >
              <FiChevronRight />
            </button>
            </div>
          </div>
          <div className="ms-auto d-flex flex-wrap gap-2 align-items-center">
          <button type="button" className="btn btn-sm btn-light rounded-pill px-3 shadow-sm fw-medium text-success" style={{ borderColor: "#e2e8f0" }} onClick={exportarExcel} disabled={!data}>
            <FiDownload className="me-1" /> Excel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-light rounded-pill px-3 shadow-sm fw-medium text-danger"
            style={{ borderColor: "#e2e8f0" }}
            onClick={() => generarInformeSemanalPdf(data, movimientos).save(nombrePdfInforme(data))}
            disabled={!data}
          >
            <FiDownload className="me-1" /> PDF
          </button>
          <button
            type="button"
            className="btn btn-sm btn-brand rounded-pill px-3 shadow-sm fw-medium"
            onClick={enviarInforme}
            disabled={!data || enviando || loading}
            title="Enviar por correo el informe de esta finca"
          >
            <FiSend className="me-1" /> Enviar finca
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-success rounded-pill px-3 shadow-sm fw-medium"
            onClick={enviarTodas}
            disabled={!data || enviando || loading || fincas.length === 0}
            title="Enviar un correo por cada finca, cada uno con su informe"
          >
            <FiSend className="me-1" /> Enviar todas
          </button>
          {esAdmin && (
            <button
              type="button"
              className="btn btn-sm btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center p-0"
              style={{ width: 31, height: 31, borderColor: "#e2e8f0" }}
              onClick={() => setVerDestinatarios(true)}
              title="Destinatarios del informe"
            >
              <FiUsers />
            </button>
          )}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small rounded-3" role="alert">
          {error}
        </div>
      )}
      {aviso && (
        <div className={`alert alert-${aviso.tipo} py-2 small rounded-3 d-flex justify-content-between align-items-start gap-2`} role="alert">
          <span>{aviso.texto}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setAviso(null)} aria-label="Cerrar" />
        </div>
      )}
      {enviando && (
        <div className="alert alert-light border py-2 small rounded-3 d-flex align-items-center gap-2" role="status">
          <div className="spinner-border spinner-border-sm text-success" role="status"></div>
          {progreso || "Enviando..."}
        </div>
      )}
      {verDestinatarios && <DestinatariosInformeModal onClose={() => setVerDestinatarios(false)} />}

      {loading && !data && (
        <div className="d-flex justify-content-center align-items-center py-5 text-secondary">
          <div className="spinner-border spinner-border-sm me-2" role="status"></div>
          <span className="small">Cargando informe...</span>
        </div>
      )}

      {data && (
        <div style={{ opacity: loading ? 0.5 : 1 }}>
          {/* Insignias: año, semana, IBM y finca */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
              <FiCalendar className="me-1" style={{ marginTop: -2 }} /> Año {data.semana.anio}
            </span>
            <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
              <FiHash className="me-1" style={{ marginTop: -2 }} /> Semana {data.semana.numeroSemana}
            </span>
            <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
              <FiTag className="me-1" style={{ marginTop: -2 }} /> IBM {data.finca.codigo}
            </span>
            <span className="badge rounded-pill text-bg-success px-3 py-2 ms-auto">
              <FiMapPin className="me-1" style={{ marginTop: -2 }} /> {data.finca.nombre} · {data.semana.codigo}
            </span>
          </div>

          {/* Indicadores de la semana (izquierda) y cortes y cinta barrida (derecha) */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-6">
            <Tabla llenar columnas={[["Indicador"], [data.semana.codigo, "end"]]} titulo={`Indicadores de la semana ${data.semana.codigo} — ${data.finca.nombre}`}>
              {[
                ["Racimos procesados", "racimosProcesados", n0],
                ["Racimos recusados", "racimosRecusados", n0],
                ["Total cortados", "totalCortados", n0, { fuerte: true, total: true }],
                ["Hectáreas en producción", "hectareasProduccion", n2],
                ["Embolses", "embolses", n0],
                ["Embolses por hectárea", "embolsesPorHectarea", n2],
                ["Cajas producidas 20 kg", "cajas", n0, { fuerte: true }],
                ["Cajas por hectárea", "cajasPorHectarea", n2],
                ["Ratio", "ratio", (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })), { fuerte: true }],
              ].map(([etiqueta, clave, fmt, op = {}]) => (
                <tr key={clave}>
                  {/* El fondo va en las celdas (Bootstrap pinta cada <td> y taparía el de la fila). Total cortados con un tono propio. */}
                  <td className={op.fuerte ? "fw-semibold" : ""} style={fondoFila(op)}>
                    {etiqueta}
                  </td>
                  <td className={`text-end ${op.fuerte ? "fw-bold" : "fw-medium"}`} style={fondoFila(op)}>
                    {fmt(ind[clave])}
                  </td>
                </tr>
              ))}
              {["Peso neto racimo", "Peso vástago", "Peso bruto racimo", "Merma"].map((l) => (
                <tr key={l}>
                  <td className="text-secondary">{l}</td>
                  <td className="text-end text-secondary fst-italic">
                    Sin dato en el sistema
                  </td>
                </tr>
              ))}
            </Tabla>
            </div>

            {/* Cortados por edad y cinta barrida */}
            <div className="col-12 col-lg-6 d-flex flex-column gap-3">
              <div>
              <Tabla columnas={[["Cinta"], ["Edad", "center"], ["Cortados", "end"], ["%", "end"]]} subtitulo="Cortados por edad">
                {data.cortadosPorEdad.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-3">
                      Sin cortes
                    </td>
                  </tr>
                )}
                {data.cortadosPorEdad.map((c) => (
                  <tr key={c.edad}>
                    <td className="text-nowrap">
                      <span
                        className="d-inline-block rounded-circle me-2 align-middle"
                        style={{
                          width: 10,
                          height: 10,
                          backgroundColor: COLOR_HEX[c.color] || "#94a3b8",
                          border: c.color === "Blanco" ? "1px solid #94a3b8" : "none",
                        }}
                        title={`Cinta ${c.color} ${c.consecutivo}`}
                      />
                      {c.semana}
                    </td>
                    <td className="text-center">{c.edad}</td>
                    <td className="text-end fw-medium">{n0(c.cantidad)}</td>
                    <td className="text-end text-secondary" style={{ minWidth: 110 }}>
                      {pct(c.porcentaje)}
                      <Barra valor={c.porcentaje} max={maxCortados} />
                    </td>
                  </tr>
                ))}
              </Tabla>
              </div>
              <div className="flex-grow-1">
              {cinta ? (
                <Tabla
                  llenar
                  columnas={[["Concepto"], ["Valor", "end"]]}
                  titulo={
                    <span className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                      Cinta barrida
                      <span
                        className="badge rounded-pill fw-semibold"
                        style={{
                          backgroundColor: COLOR_HEX[cinta.color] || "#94a3b8",
                          color: COLOR_TEXT[cinta.color] || "#111827",
                          border: "1px solid rgba(255,255,255,0.6)",
                        }}
                      >
                        {cinta.semana}
                      </span>
                    </span>
                  }
                >
                  {[
                    [
                      "Semana de embolse",
                      <span key="sem" className="d-inline-flex align-items-center gap-2">
                        <span
                          className="d-inline-block rounded-circle"
                          title={`Cinta ${cinta.color} ${cinta.consecutivo}`}
                          style={{ width: 10, height: 10, backgroundColor: COLOR_HEX[cinta.color] || "#94a3b8", border: cinta.color === "Blanco" ? "1px solid #94a3b8" : "none" }}
                        />
                        {cinta.semana}
                      </span>,
                    ],
                    ["Embolsado", n0(cinta.embolsado)],
                    ["Repicado", n0(cinta.repicado)],
                    ["Recusado", n0(cinta.recusado)],
                    ["Procesado", n0(cinta.procesado)],
                    ["Racimos perdidos", n0(cinta.perdidos)],
                    ["Recobro", pct(cinta.recobro)],
                    ["Aprovechamiento", pct(cinta.aprovechamiento)],
                  ].map(([l, v]) => (
                    <tr key={l}>
                      <td className="text-secondary">{l}</td>
                      <td
                        className={`text-end fw-medium ${l === "Racimos perdidos" && cinta.perdidos !== 0 ? "text-danger" : ""} ${
                          l === "Recobro" || l === "Aprovechamiento" ? "text-success fw-bold" : ""
                        }`}
                        style={l === "Recobro" || l === "Aprovechamiento" ? { minWidth: 110 } : undefined}
                      >
                        {v}
                        {l === "Recobro" && <Barra valor={cinta.recobro || 0} />}
                        {l === "Aprovechamiento" && <Barra valor={cinta.aprovechamiento || 0} color="#0d9488" />}
                      </td>
                    </tr>
                  ))}
                </Tabla>
              ) : (
                <p className="small text-secondary mb-0">Cinta barrida: sin cinta de 12 semanas.</p>
              )}
            </div>

              </div>
          </div>

          <div className="row g-3 mb-4">
            {/* Repicados: tabla por motivo (como el resto del informe) y detalle por edad plegado. Sin ajustes ocupa todo el ancho. */}
            <div className={data.ajustes.length > 0 ? "col-12 col-lg-6" : "col-12"}>
              {data.repicados.length === 0 ? (
                <Tabla columnas={[["Motivo"]]} titulo={`Repicados ${data.semana.codigo}`}>
                  <tr>
                    <td className="text-center text-secondary py-3">Sin repicados en la semana.</td>
                  </tr>
                </Tabla>
              ) : (
                <>
                  <Tabla
                    columnas={[["Motivo"], ["Cantidad"], ["%"]]}
                    titulo={
                      <span className="d-flex align-items-center justify-content-center gap-2">
                        Repicados {data.semana.codigo}
                        <span className="badge rounded-pill" style={{ background: "rgba(255,255,255,0.18)", fontWeight: 600 }}>
                          {n0(data.totalRepicados)} en total
                        </span>
                      </span>
                    }
                  >
                    {repicadosPorMotivo.map(([motivo, cantidad]) => {
                      const porcentaje = (cantidad / data.totalRepicados) * 100;
                      return (
                        <tr key={motivo}>
                          <td>{motivo}</td>
                          <td className="text-end fw-medium" style={{ width: 110 }}>
                            {n0(cantidad)}
                          </td>
                          <td className="text-end text-secondary" style={{ width: "35%", minWidth: 130 }}>
                            {pct(porcentaje)}
                            <Barra valor={cantidad} max={repicadosPorMotivo[0][1]} />
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="fw-bold" style={FILA_TOTAL}>
                        Total
                      </td>
                      <td className="text-end fw-bold" style={FILA_TOTAL}>
                        {n0(data.totalRepicados)}
                      </td>
                      <td className="text-end fw-bold" style={FILA_TOTAL}>
                        100%
                      </td>
                    </tr>
                  </Tabla>
                  <button type="button" className="btn btn-link btn-sm p-0 mt-2 text-decoration-none" onClick={() => setVerDetalleRepicados(true)}>
                    Ver detalle por edad
                  </button>
                  {verDetalleRepicados && (
                    <ModalShell title={`Repicados ${data.semana.codigo} por edad — ${data.finca.nombre}`} onClose={() => setVerDetalleRepicados(false)} size="lg">
                      <Tabla columnas={[["Cinta"], ["Edad", "center"], ["Motivo"], ["Cantidad", "end"]]}>
                        {data.repicados.map((r, i) => (
                          <tr key={i}>
                            <td className="text-nowrap">
                              <PuntoCinta color={r.color} consecutivo={r.consecutivo} />
                              {r.semana}
                            </td>
                            <td className="text-center">{r.edad}</td>
                            <td>{r.motivo}</td>
                            <td className="text-end fw-medium">{n0(r.cantidad)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} className="fw-bold" style={FILA_TOTAL}>
                            Total
                          </td>
                          <td className="text-end fw-bold" style={FILA_TOTAL}>
                            {n0(data.totalRepicados)}
                          </td>
                        </tr>
                      </Tabla>
                      <div className="d-flex justify-content-end mt-3">
                        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setVerDetalleRepicados(false)}>
                          Cerrar
                        </button>
                      </div>
                    </ModalShell>
                  )}
                </>
              )}
            </div>

            {/* Ajustes: solo si la semana tiene */}
            {data.ajustes.length > 0 && (
            <div className="col-12 col-lg-6">
            <TituloSeccion icono={<FiSliders size={14} />}>Ajustes</TituloSeccion>
            {data.ajustes.length === 0 ? (
              <p className="small text-secondary mb-0">Sin ajustes en la semana.</p>
            ) : (
              <Tabla columnas={[["Edad", "center"], ["Tipo"], ["Motivo"], ["Cantidad", "end"]]}>
                {data.ajustes.map((a, i) => (
                  <tr key={i}>
                    <td className="text-center">{a.edad}</td>
                    <td>{a.tipo}</td>
                    <td>{a.motivo || "—"}</td>
                    <td className="text-end fw-medium">{n0(a.cantidad)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </div>
            )}
          </div>

          {/* Saldo y movimientos */}
          <TituloSeccion icono={<FiLayers size={14} />}>Saldo y movimientos {data.semana.codigo}</TituloSeccion>
          {movimientos ? (
            <TablaMovimientosSemana data={movimientos} expandidos={["saldoFinal"]} />
          ) : (
            <div className="d-flex align-items-center py-3 text-secondary small">
              <div className="spinner-border spinner-border-sm me-2" role="status"></div> Cargando saldos...
            </div>
          )}
        </div>
      )}
      {/* Aire dentro de las tablas del informe: que los textos no queden pegados al borde. */}
      <style jsx global>{`
        .tabla-informe > :not(caption) > * > * {
          padding: 0.5rem 0.9rem;
        }
        .tabla-informe > thead > tr > th {
          padding-top: 0.6rem;
          padding-bottom: 0.6rem;
        }
      `}</style>
    </div>
  );
}
