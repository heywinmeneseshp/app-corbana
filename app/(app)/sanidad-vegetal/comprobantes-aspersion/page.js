"use client";

import InfoModulo from "@/components/InfoModulo";
import { useEffect, useState } from "react";
import { FiEye, FiDownload, FiEdit2, FiRotateCcw, FiSearch, FiFileText, FiXCircle, FiMail } from "react-icons/fi";
import JSZip from "jszip";
import { apiFetch, apiFetchBlob, apiFetchFormData } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import DetalleComprobanteModal from "@/components/aspersion/DetalleComprobanteModal";
import PilotoAsistentes from "@/components/aspersion/PilotoAsistentes";
import RecorridoKml from "@/components/aspersion/RecorridoKml";
import { descargarComprobanteAspersionPdf, verComprobanteAspersionPdf, generarComprobanteAspersionPdfBlob } from "@/lib/comprobanteAspersionExport";

const MEDIO_LABEL = { AVION: "Avión", DRON: "Dron" };

function fmtFecha(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

const num = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: 2 }));

function EstadoBadge({ estado }) {
  const estilos = {
    EMITIDO: { fondo: "#d1fae5", color: "#047857", texto: "Emitido" },
    BORRADOR: { fondo: "#fef3c7", color: "#b45309", texto: "Borrador" },
    ANULADO: { fondo: "#fee2e2", color: "#b91c1c", texto: "Anulado" },
  };
  const e = estilos[estado] || estilos.BORRADOR;
  return (
    <span className="badge rounded-pill small" style={{ backgroundColor: e.fondo, color: e.color }}>
      {e.texto}
    </span>
  );
}

export default function ComprobantesAspersionPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fincas, setFincas] = useState([]);

  // `filtros` es lo que se escribe; `aplicados` lo que realmente se consulta
  // (se aplican con el botón Filtrar o con Enter).
  const [filtros, setFiltros] = useState({ search: "", estado: "", fincaUuid: "" });
  const [aplicados, setAplicados] = useState({ search: "", estado: "", fincaUuid: "" });

  const [edicion, setEdicion] = useState(null);
  // Anulación: { comprobante, motivo, error }.
  const [anulacion, setAnulacion] = useState(null);
  // Detalle al hacer clic en la fila: { comprobante, cargando }.
  const [detalleModal, setDetalleModal] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [procesandoUuid, setProcesandoUuid] = useState("");

  const puedeEditar = hasPermission("sanidad_vegetal.comprobantes_aspersion.editar");
  const puedeEmitir = hasPermission("sanidad_vegetal.comprobantes_aspersion.emitir");
  // Anular reemplazó al borrado; el mismo permiso permite regenerar el borrador.
  const puedeAnular = hasPermission("sanidad_vegetal.comprobantes_aspersion.anular");

  async function load(f = aplicados, p = page) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(p), limit: "20" });
      if (f.search) qs.set("search", f.search);
      if (f.estado) qs.set("estado", f.estado);
      if (f.fincaUuid) qs.set("fincaUuid", f.fincaUuid);
      const { items: rows, meta: m } = await apiFetch(`/comprobantes-aspersion?${qs}`);
      setItems(rows);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiFetch("/fincas?limit=100&soloOperativas=true")
      .then((r) => setFincas(r.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function aplicarFiltros(e) {
    e?.preventDefault();
    setAplicados(filtros);
    if (page === 1) load(filtros, 1);
    else setPage(1);
  }

  function limpiarFiltros() {
    const vacios = { search: "", estado: "", fincaUuid: "" };
    setFiltros(vacios);
    setAplicados(vacios);
    if (page === 1) load(vacios, 1);
    else setPage(1);
  }

  // El listado NO trae los insumos de la mezcla (por rendimiento): para el
  // PDF y la edición se pide el detalle completo del comprobante.
  async function obtenerDetalle(c) {
    try {
      return await apiFetch(`/comprobantes-aspersion/${c.uuid}`);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  async function abrirDetalle(c) {
    setDetalleModal({ comprobante: c, cargando: true });
    const detalle = await obtenerDetalle(c);
    if (detalle) setDetalleModal((m) => (m && m.comprobante.uuid === c.uuid ? { comprobante: detalle, cargando: false } : m));
    else setDetalleModal(null);
  }

  async function verPdf(c) {
    const detalle = await obtenerDetalle(c);
    if (detalle) verComprobanteAspersionPdf(detalle);
  }

  async function descargarPdf(c) {
    const detalle = await obtenerDetalle(c);
    if (detalle) descargarComprobanteAspersionPdf(detalle);
  }

  async function abrirEdicionConDetalle(c, opciones = {}) {
    const detalle = await obtenerDetalle(c);
    if (detalle) abrirEdicion(detalle, opciones);
  }

  function abrirEdicion(c, { volverADetalle = false } = {}) {
    setEdicion({
      comprobante: c,
      volverADetalle,
      piloto: c.piloto || "",
      // Con dron: piloto del listado de colaboradores y asistentes.
      pilotoColaboradorUuid: c.pilotoColaborador?.uuid || "",
      asistentesUuids: (c.participantes || []).filter((p) => p.rol === "ASISTENTE").map((p) => p.colaborador.uuid),
      medio: c.medio || c.aspersion?.medio || "",
      hectareasAplicadas: c.hectareasAplicadas !== null && c.hectareasAplicadas !== undefined ? String(Number(c.hectareasAplicadas)) : "",
      galonesTotales: c.galonesTotales !== null && c.galonesTotales !== undefined ? String(Number(c.galonesTotales)) : "",
      observaciones: c.observaciones || "",
      aeronave: c.aeronave || "",
      volumenAplicacionHa: c.volumenAplicacionHa != null ? String(Number(c.volumenAplicacionHa)) : "",
      temperaturaInicial: c.temperaturaInicial != null ? String(Number(c.temperaturaInicial)) : "",
      temperaturaFinal: c.temperaturaFinal != null ? String(Number(c.temperaturaFinal)) : "",
      velocidadViento: c.velocidadViento != null ? String(Number(c.velocidadViento)) : "",
      humedadRelativaFinal: c.humedadRelativaFinal != null ? String(Number(c.humedadRelativaFinal)) : "",
      horaInicio: c.horaInicio || "",
      horaFinal: c.horaFinal || "",
      error: "",
    });
  }

  // La edición solo guarda el borrador: se aprueba (emite) desde el detalle del comprobante (clic en la fila).
  async function guardarEdicion() {
    const m = edicion;
    setGuardando(true);
    try {
      // Los datos de la ejecución (hectáreas, galones, aeronave, clima y horario) no se editan en el borrador.
      const body = {
        piloto: m.piloto.trim() || null,
        ...(m.medio === "DRON" ? { pilotoColaboradorUuid: m.pilotoColaboradorUuid || null, asistentesUuids: m.asistentesUuids } : {}),
        medio: m.medio || null,
        observaciones: m.observaciones.trim() || null,
      };
      const actualizado = await apiFetch(`/comprobantes-aspersion/${m.comprobante.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      setItems((prev) => prev.map((it) => (it.uuid === actualizado.uuid ? actualizado : it)));
      setEdicion(null);
      // Si se llegó a la edición desde «Aprobar» en el detalle (faltaban datos), se vuelve al detalle para aprobarlo.
      if (m.volverADetalle) abrirDetalle(actualizado);
    } catch (err) {
      setEdicion({ ...m, error: err.message });
    } finally {
      setGuardando(false);
    }
  }

  // Devuelve true si quedó emitido (aprobado).
  async function emitir(c) {
    const faltan = [
      !c.piloto && "el piloto",
      c.medio === "DRON" && !c.pilotoColaborador && c.piloto && "el piloto del listado de colaboradores (con dron)",
      !(Number(c.hectareasAplicadas) > 0) && "las hectáreas aplicadas",
      !c.kmlNombre && "el recorrido (archivo KML o KMZ)",
    ].filter(Boolean);
    if (faltan.length) {
      // Faltan datos obligatorios: se explica cuáles y se abre la edición para completarlos.
      alert(`No se puede aprobar el comprobante ${c.numero} porque falta ${faltan.join(", ")}.

Se abrirá la edición para completarlo.`);
      setDetalleModal(null);
      abrirEdicionConDetalle(c, { volverADetalle: true });
      return false;
    }
    if (!confirm(`¿Aprobar (emitir) el comprobante ${c.numero}? Después ya no se podrá editar.`)) return false;
    setProcesandoUuid(c.uuid);
    try {
      const actualizado = await apiFetch(`/comprobantes-aspersion/${c.uuid}/emitir`, { method: "POST", body: JSON.stringify({}) });
      setItems((prev) => prev.map((it) => (it.uuid === actualizado.uuid ? actualizado : it)));
      return true;
    } catch (err) {
      setError(err.message);
      alert(err.message);
      return false;
    } finally {
      setProcesandoUuid("");
    }
  }

  // Aprobar desde el modal de detalle: emite y vuelve a cargar el detalle (queda en Emitido).
  // Enviar por correo (solo emitido): el PDF con el mapa del recorrido y el KMZ (el KML guardado, comprimido) a los destinatarios
  // configurados para la finca.
  async function enviarCorreo(c) {
    if (!confirm(`¿Enviar el comprobante ${c.numero} por correo a los destinatarios de la finca?`)) return;
    setProcesandoUuid(c.uuid);
    try {
      const detalle = await obtenerDetalle(c);
      if (!detalle) return;
      const { blob, nombre } = await generarComprobanteAspersionPdfBlob(detalle);
      const fd = new FormData();
      fd.append("pdf", blob, nombre);
      if (detalle.kmlNombre) {
        const kml = await apiFetchBlob(`/comprobantes-aspersion/${detalle.uuid}/kml`);
        const zip = new JSZip();
        zip.file("doc.kml", kml);
        const kmz = await zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.google-earth.kmz" });
        fd.append("kmz", kmz, `Recorrido-${detalle.numero}.kmz`);
      }
      const actualizado = await apiFetchFormData(`/comprobantes-aspersion/${c.uuid}/correo`, fd);
      setItems((prev) => prev.map((it) => (it.uuid === actualizado.uuid ? { ...it, correoEnviadoEn: actualizado.correoEnviadoEn } : it)));
      setDetalleModal((d) => (d?.comprobante?.uuid === actualizado.uuid ? { comprobante: actualizado, cargando: false } : d));
      alert(`Comprobante ${c.numero} enviado${detalle.kmlNombre ? " con el PDF y el KMZ del recorrido" : ""}.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesandoUuid("");
    }
  }

  async function aprobarDesdeDetalle(c) {
    if (await emitir(c)) {
      const detalle = await obtenerDetalle(c);
      if (detalle) setDetalleModal({ comprobante: detalle, cargando: false });
    }
  }

  // Anular reemplaza al borrado: el comprobante queda como histórico (con el
  // motivo y quién lo anuló) y su aspersión queda sin documento vigente, así
  // que desde ahí se puede regenerar un borrador.
  function abrirAnulacion(c) {
    setAnulacion({ comprobante: c, motivo: "", error: "" });
  }

  async function confirmarAnulacion() {
    const m = anulacion;
    if (!m) return;
    setAnulando(true);
    try {
      const actualizado = await apiFetch(`/comprobantes-aspersion/${m.comprobante.uuid}/anular`, {
        method: "POST",
        body: JSON.stringify({ motivo: m.motivo.trim() }),
      });
      setItems((prev) => prev.map((it) => (it.uuid === actualizado.uuid ? actualizado : it)));
      // Si estaba abierto el detalle de ese comprobante, se refresca con la anulación.
      setDetalleModal((d) => (d?.comprobante?.uuid === actualizado.uuid ? { comprobante: actualizado, cargando: false } : d));
      setAnulacion(null);
    } catch (err) {
      setAnulacion({ ...m, error: err.message });
    } finally {
      setAnulando(false);
    }
  }

  // Crea un borrador nuevo con los datos del anulado (la aspersión no se vuelve
  // a ejecutar). El anulado se conserva para auditoría.
  async function regenerar(c) {
    if (
      !confirm(
        `¿Regenerar un borrador desde ${c.numero}? Se copiarán los datos de la aplicación y el comprobante anulado se conserva como histórico.`,
      )
    ) {
      return;
    }
    setProcesandoUuid(c.uuid);
    try {
      const nuevo = await apiFetch(`/comprobantes-aspersion/${c.uuid}/regenerar`, { method: "POST", body: JSON.stringify({}) });
      await load();
      setDetalleModal({ comprobante: nuevo, cargando: false });
    } catch (err) {
      setError(err.message);
      alert(err.message);
    } finally {
      setProcesandoUuid("");
    }
  }

  return (
    <RequirePermission code="menu.sanidad_vegetal.comprobantes_aspersion">
      <div className="p-3 p-md-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h1 className="fw-bold h4 mb-1 d-flex align-items-center gap-2">
              <FiFileText /> Comprobante de aspersiones <InfoModulo titulo={"Comprobante de aspersiones"} secciones={[{"titulo": "Para qué sirve", "texto": "Se genera en borrador al ejecutar una aspersión. Complétalo y emítelo."}, {"titulo": "Qué incluye el PDF", "items": ["La mezcla y las hectáreas.", "El piloto.", "Los galones.", "Quién ejecutó la aspersión."]}]} />
            </h1>
            <p className="text-secondary small mb-0">
              Se genera en borrador al ejecutar una aspersión. Complétalo y emítelo; el PDF muestra la mezcla, las hectáreas, el
              piloto, los galones y quién ejecutó.
            </p>
          </div>
        </div>

        <div className="card border-0 rounded-2 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <form className="card-body p-3 row g-2 align-items-end" onSubmit={aplicarFiltros}>
            <div className="col-12 col-md-4">
              <label className="form-label small mb-1">Buscar</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">
                  <FiSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="N.°, piloto, finca o mezcla"
                  value={filtros.search}
                  onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Finca</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.fincaUuid}
                onChange={(e) => setFiltros((f) => ({ ...f, fincaUuid: e.target.value }))}
              >
                <option value="">Todas</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1">Estado</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.estado}
                onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDO">Emitido</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div className="col-12 col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-brand btn-sm rounded-3">
                Filtrar
              </button>
              {(aplicados.search || aplicados.estado || aplicados.fincaUuid || filtros.search || filtros.estado || filtros.fincaUuid) && (
                <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={limpiarFiltros}>
                  Limpiar
                </button>
              )}
            </div>
          </form>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {/* Misma vista que la tabla de Programación de Aspersiones. */}
        <div className="card border-0 rounded-2 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.72rem" }}>
              <thead>
                <tr className="table-light text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium text-nowrap">Semana</th>
                  <th className="fw-medium text-nowrap">Ejecutada</th>
                  <th className="fw-medium">Finca</th>
                  <th className="fw-medium">Mezcla</th>
                  <th className="fw-medium text-nowrap">Vehículo</th>
                  <th className="fw-medium">Número</th>
                  <th className="fw-medium">Aspersión</th>
                  <th className="fw-medium text-nowrap">Ha aplicadas</th>
                  <th className="fw-medium">Galones</th>
                  <th className="fw-medium">Estado</th>
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={11} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-secondary py-3 small">
                      No hay comprobantes. Se crean automáticamente al ejecutar una aspersión.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((c) => {
                    const borrador = c.estado === "BORRADOR";
                    const anulado = c.estado === "ANULADO";
                    const ocupado = procesandoUuid === c.uuid;
                    return (
                      <tr
                        key={c.uuid}
                        style={{ cursor: "pointer", opacity: anulado ? 0.7 : 1 }}
                        title="Ver el detalle de la aspersión"
                        onClick={() => abrirDetalle(c)}
                      >
                        <td className="fw-medium text-nowrap">{c.aspersion?.semana?.codigo || "—"}</td>
                        <td className="text-nowrap">{fmtFecha(c.ejecutadoEn)}</td>
                        <td>{c.aspersion?.finca?.nombre || "—"}</td>
                        <td className="text-secondary" style={{ lineHeight: 1.25 }}>{c.aspersion?.mezcla?.nombre || c.aspersion?.mezcla?.codigo || "—"}</td>
                        <td className="text-secondary text-nowrap">{MEDIO_LABEL[c.medio] || "—"}</td>
                        <td className="text-secondary">{c.numero}</td>
                        <td className="text-secondary">{c.aspersion?.numero || "—"}</td>
                        <td className="text-secondary">{c.hectareasAplicadas != null ? Number(c.hectareasAplicadas).toFixed(2) : "—"}</td>
                        <td className="text-secondary text-nowrap">{num(c.galonesTotales)}</td>
                        <td>
                          <EstadoBadge estado={c.estado} />
                        </td>
                        <td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                          <div className="d-flex justify-content-end gap-1 flex-nowrap">
                          <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex text-secondary" title="Ver PDF" onClick={() => verPdf(c)}>
                            <FiEye size={15} />
                          </button>
                          <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex text-secondary" title="Descargar PDF" onClick={() => descargarPdf(c)}>
                            <FiDownload size={15} />
                          </button>
                          {c.estado === "EMITIDO" && puedeEmitir && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: c.correoEnviadoEn ? "#16a34a" : "#64748b" }}
                              title={c.correoEnviadoEn ? `Enviado el ${new Date(c.correoEnviadoEn).toLocaleString("es-CO")} — enviar de nuevo` : "Enviar por correo (PDF + KMZ)"}
                              disabled={procesandoUuid === c.uuid}
                              onClick={() => enviarCorreo(c)}
                            >
                              <FiMail size={15} />
                            </button>
                          )}
                          {borrador && puedeEditar && (
                            <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex text-secondary" title="Editar" onClick={() => abrirEdicionConDetalle(c)}>
                              <FiEdit2 size={15} />
                            </button>
                          )}
                          {!anulado && puedeAnular && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#dc2626" }}
                              title="Anular comprobante"
                              disabled={ocupado}
                              onClick={() => abrirAnulacion(c)}
                            >
                              <FiXCircle size={15} />
                            </button>
                          )}
                          {anulado && c.puedeRegenerar && puedeAnular && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#166534" }}
                              title="Regenerar borrador desde este comprobante anulado"
                              disabled={ocupado}
                              onClick={() => regenerar(c)}
                            >
                              <FiRotateCcw size={15} />
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
          <span className="small text-secondary">
            Página {meta.page} de {meta.totalPages} ({meta.total} comprobante(s))
          </span>
          {meta.totalPages > 1 && (
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>

        {detalleModal && (
          <DetalleComprobanteModal
            comprobante={detalleModal.comprobante}
            cargando={detalleModal.cargando}
            onClose={() => setDetalleModal(null)}
            onAprobar={puedeEmitir ? aprobarDesdeDetalle : undefined}
            aprobando={procesandoUuid === detalleModal.comprobante.uuid}
            onEnviar={puedeEmitir ? enviarCorreo : undefined}
            enviando={procesandoUuid === detalleModal.comprobante.uuid}
          />
        )}

        {edicion && (
          <ModalShell title={`Editar comprobante ${edicion.comprobante.numero}`} onClose={() => setEdicion(null)} width="34rem">
            <div className="rounded-3 p-2 mb-3 small" style={{ backgroundColor: "#f0fdf4" }}>
              <div>
                <strong>{edicion.comprobante.aspersion?.finca?.nombre}</strong> ·{" "}
                {edicion.comprobante.aspersion?.mezcla?.nombre || edicion.comprobante.aspersion?.mezcla?.codigo}
              </div>
              <div className="text-secondary">
                {num(edicion.comprobante.hectareasProgramadas)} ha programadas · aspersión {edicion.comprobante.aspersion?.numero}
              </div>
              <div className="text-secondary mt-1">
                Insumos: {(edicion.comprobante.insumos || []).map((i) => i.nombre).join(" · ") || "—"}
              </div>
            </div>
            {edicion.error && <div className="alert alert-danger py-2 small">{edicion.error}</div>}
            <div className="row g-2">
              <div className="col-4">
                <label className="form-label small fw-medium mb-1">Aplicado con</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={edicion.medio}
                  onChange={(e) => setEdicion((m) => ({ ...m, medio: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="AVION">Avión</option>
                  <option value="DRON">Dron</option>
                </select>
              </div>
              <div className="col-12">
                <PilotoAsistentes medio={edicion.medio} valor={edicion} onChange={(patch) => setEdicion((m) => ({ ...m, ...patch }))} />
              </div>
              <div className="col-12">
                {/* El KML se guarda apenas se sube (no espera al botón Guardar). */}
                <RecorridoKml comprobante={edicion.comprobante} editable onCambio={(act) => setEdicion((m) => ({ ...m, comprobante: act }))} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Hectáreas aplicadas *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.hectareasAplicadas}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, hectareasAplicadas: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Galones totales</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.galonesTotales}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, galonesTotales: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium mb-1">Aeronave</label>
                <input
                  type="text"
                  maxLength={150}
                  className="form-control form-control-sm rounded-3"
                  value={edicion.aeronave}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, aeronave: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Volumen de aplicación por hectárea (gal/ha)</label>
                <input
                  type="number"
                  step="0.01" min="0"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.volumenAplicacionHa}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, volumenAplicacionHa: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Velocidad del viento (km/h)</label>
                <input
                  type="number"
                  step="0.1" min="0"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.velocidadViento}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, velocidadViento: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Temperatura inicial (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.temperaturaInicial}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, temperaturaInicial: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Temperatura final (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.temperaturaFinal}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, temperaturaFinal: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium mb-1">Humedad relativa final (%)</label>
                <input
                  type="number"
                  step="0.1" min="0" max="100"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.humedadRelativaFinal}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, humedadRelativaFinal: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Hora inicio</label>
                <input
                  type="time"
                  
                  className="form-control form-control-sm rounded-3"
                  value={edicion.horaInicio}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, horaInicio: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Hora final</label>
                <input
                  type="time"
                  
                  className="form-control form-control-sm rounded-3"
                  value={edicion.horaFinal}
                  disabled
                  title="Dato de la ejecución: no se edita en el borrador"
                  onChange={(e) => setEdicion((m) => ({ ...m, horaFinal: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium mb-1">Observaciones</label>
                <textarea
                  className="form-control form-control-sm rounded-3"
                  rows={2}
                  maxLength={1000}
                  value={edicion.observaciones}
                  onChange={(e) => setEdicion((m) => ({ ...m, observaciones: e.target.value }))}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setEdicion(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={guardando} onClick={() => guardarEdicion()}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </ModalShell>
        )}

        {anulacion && (
          <ModalShell title={`Anular comprobante ${anulacion.comprobante.numero}`} onClose={() => setAnulacion(null)} width="32rem">
            <p className="small text-secondary mb-2">
              El comprobante no se borra: queda registrado como <strong>anulado</strong> con el motivo y quién lo hizo. La
              aspersión seguirá ejecutada y desde ese registro podrás <strong>regenerar un borrador</strong> con los mismos datos.
            </p>
            <label className="form-label small fw-medium mb-1">Motivo de la anulación *</label>
            <textarea
              className="form-control form-control-sm rounded-3"
              rows={3}
              maxLength={500}
              autoFocus
              value={anulacion.motivo}
              onChange={(e) => setAnulacion((m) => ({ ...m, motivo: e.target.value }))}
            />
            <div className="form-text">Mínimo 5 caracteres. Queda guardado en el comprobante.</div>
            {anulacion.error && <div className="alert alert-danger py-2 small mt-2">{anulacion.error}</div>}
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setAnulacion(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger rounded-3"
                disabled={anulando || anulacion.motivo.trim().length < 5}
                onClick={() => confirmarAnulacion()}
              >
                {anulando ? "Anulando..." : "Anular comprobante"}
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
