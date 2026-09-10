"use client";

import { useEffect, useRef, useState } from "react";
import {
  FiSend,
  FiClock,
  FiEye,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
  FiAlertCircle,
  FiPaperclip,
  FiUsers,
  FiUser,
  FiAtSign,
  FiUploadCloud,
  FiFileText,
  FiSearch,
} from "react-icons/fi";
import { apiFetch, apiFetchFormData } from "@/lib/api";
import RequireAdmin from "@/components/RequireAdmin";
import ModalShell from "@/components/ModalShell";
import SelectAddPicker from "@/components/SelectAddPicker";

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_ADJUNTOS = 5;
const MAX_ADJUNTO_MB = 8;
const MAX_MENSAJE = 5000;

export default function ComunicadosPage() {
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [rolesDisponibles, setRolesDisponibles] = useState([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [rolesSeleccionados, setRolesSeleccionados] = useState([]);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);
  const [correoInput, setCorreoInput] = useState("");
  const [correosManuales, setCorreosManuales] = useState([]);
  const [correoError, setCorreoError] = useState("");
  const [adjuntos, setAdjuntos] = useState([]);
  const [adjuntoError, setAdjuntoError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const fileInputRef = useRef(null);

  const [enviando, setEnviando] = useState(false);
  const [formError, setFormError] = useState("");
  const [resultadoEnvio, setResultadoEnvio] = useState(null);

  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  const [historialError, setHistorialError] = useState("");
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  async function loadCombos() {
    try {
      const [rolesRes, usuariosRes] = await Promise.all([
        apiFetch("/roles?limit=100"),
        apiFetch("/users?limit=100"),
      ]);
      setRolesDisponibles((rolesRes.items || []).map((r) => ({ uuid: r.uuid, label: r.nombre })));
      setUsuariosDisponibles(
        (usuariosRes.items || []).map((u) => ({ uuid: u.uuid, label: `${u.nombre} ${u.apellido}`, sublabel: u.usuario })),
      );
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function loadHistorial() {
    setHistorialLoading(true);
    setHistorialError("");
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "20" });
      if (busquedaHistorial.trim()) qs.set("search", busquedaHistorial.trim());
      const { items, meta: m } = await apiFetch(`/comunicados?${qs}`);
      setHistorial(items);
      setMeta(m);
    } catch (err) {
      setHistorialError(err.message);
    } finally {
      setHistorialLoading(false);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    loadHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function buscarHistorial() {
    if (page === 1) loadHistorial();
    else setPage(1);
  }

  function agregarCorreo() {
    const v = correoInput.trim().toLowerCase();
    if (!v) return;
    if (!emailValido(v)) {
      setCorreoError(`"${v}" no parece un correo válido.`);
      return;
    }
    if (correosManuales.includes(v)) {
      setCorreoInput("");
      return;
    }
    setCorreosManuales((c) => [...c, v]);
    setCorreoInput("");
    setCorreoError("");
  }

  function quitarCorreo(v) {
    setCorreosManuales((c) => c.filter((x) => x !== v));
  }

  function agregarArchivos(fileList) {
    setAdjuntoError("");
    const nuevos = Array.from(fileList || []);
    if (nuevos.length === 0) return;

    const combinados = [...adjuntos];
    for (const f of nuevos) {
      if (combinados.some((a) => a.name === f.name && a.size === f.size)) continue;
      if (f.size > MAX_ADJUNTO_MB * 1024 * 1024) {
        setAdjuntoError(`"${f.name}" pesa más de ${MAX_ADJUNTO_MB} MB — no se agregó.`);
        continue;
      }
      combinados.push(f);
    }
    if (combinados.length > MAX_ADJUNTOS) {
      setAdjuntoError(`Máximo ${MAX_ADJUNTOS} adjuntos por comunicado.`);
      combinados.length = MAX_ADJUNTOS;
    }
    setAdjuntos(combinados);
  }

  function quitarArchivo(idx) {
    setAdjuntos((a) => a.filter((_, i) => i !== idx));
  }

  const totalDestinatariosSeleccionados = rolesSeleccionados.length + usuariosSeleccionados.length + correosManuales.length;
  const formularioListo = asunto.trim() && mensaje.trim() && totalDestinatariosSeleccionados > 0;

  async function handleEnviar(e) {
    e.preventDefault();
    setFormError("");
    setResultadoEnvio(null);

    if (totalDestinatariosSeleccionados === 0) {
      setFormError("Selecciona al menos un rol, usuario o correo manual.");
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("asunto", asunto);
      formData.append("mensaje", mensaje);
      formData.append("correos", JSON.stringify(correosManuales));
      formData.append("rolesUuids", JSON.stringify(rolesSeleccionados.map((r) => r.uuid)));
      formData.append("usuariosUuids", JSON.stringify(usuariosSeleccionados.map((u) => u.uuid)));
      for (const archivo of adjuntos) formData.append("adjuntos", archivo);

      const enviado = await apiFetchFormData("/comunicados", formData);
      setResultadoEnvio(enviado);
      setAsunto("");
      setMensaje("");
      setRolesSeleccionados([]);
      setUsuariosSeleccionados([]);
      setCorreosManuales([]);
      setAdjuntos([]);
      setPage(1);
      loadHistorial();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function abrirDetalle(comunicado) {
    setDetalleOpen(true);
    setDetalleLoading(true);
    try {
      const data = await apiFetch(`/comunicados/${comunicado.uuid}`);
      setDetalle(data);
    } catch (err) {
      setHistorialError(err.message);
    } finally {
      setDetalleLoading(false);
    }
  }

  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex align-items-center gap-3">
          <div
            className="rounded-4 d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: "3rem", height: "3rem", backgroundColor: "var(--brand-100)" }}
          >
            <FiSend size={20} style={{ color: "var(--brand-800)" }} />
          </div>
          <div>
            <h1 className="fw-bold h3 mb-1">Comunicados</h1>
            <p className="text-secondary mb-0">
              Mandale un correo a roles completos, usuarios puntuales o direcciones sueltas — con adjuntos si hace falta.
            </p>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm rounded-4 p-4">
              <form onSubmit={handleEnviar}>
                <div className="mb-3">
                  <label className="form-label small fw-medium">
                    Asunto <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    placeholder="Ej. Mantenimiento programado del sistema"
                    required
                    maxLength={200}
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-baseline">
                    <label className="form-label small fw-medium">
                      Mensaje <span className="text-danger">*</span>
                    </label>
                    <span className="small text-secondary">
                      {mensaje.length}/{MAX_MENSAJE}
                    </span>
                  </div>
                  <textarea
                    className="form-control rounded-3"
                    rows={7}
                    placeholder="Escribí el mensaje que va a recibir cada destinatario..."
                    required
                    maxLength={MAX_MENSAJE}
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                  />
                </div>

                <p className="fw-semibold small text-secondary text-uppercase mb-3" style={{ letterSpacing: "0.03em" }}>
                  Destinatarios
                </p>

                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-6">
                    <div className="rounded-4 p-3 h-100" style={{ backgroundColor: "#f8f9fa" }}>
                      <label className="form-label small fw-medium d-flex align-items-center gap-2 mb-2">
                        <FiUsers style={{ color: "var(--brand-700)" }} /> Roles
                        {rolesSeleccionados.length > 0 && (
                          <span className="badge rounded-pill bg-brand small">{rolesSeleccionados.length}</span>
                        )}
                      </label>
                      <SelectAddPicker
                        items={rolesDisponibles}
                        selected={rolesSeleccionados}
                        onChange={setRolesSeleccionados}
                        placeholder="Selecciona un rol..."
                        variante="suave"
                        compact
                      />
                      <p className="form-text small mb-0 mt-1">Le llega a todos los usuarios de ese rol.</p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="rounded-4 p-3 h-100" style={{ backgroundColor: "#f8f9fa" }}>
                      <label className="form-label small fw-medium d-flex align-items-center gap-2 mb-2">
                        <FiUser style={{ color: "var(--brand-700)" }} /> Usuarios puntuales
                        {usuariosSeleccionados.length > 0 && (
                          <span className="badge rounded-pill bg-brand small">{usuariosSeleccionados.length}</span>
                        )}
                      </label>
                      <SelectAddPicker
                        items={usuariosDisponibles}
                        selected={usuariosSeleccionados}
                        onChange={setUsuariosSeleccionados}
                        placeholder="Selecciona un usuario..."
                        variante="suave"
                        compact
                      />
                      <p className="form-text small mb-0 mt-1">Personas específicas, sin importar su rol.</p>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="rounded-4 p-3" style={{ backgroundColor: "#f8f9fa" }}>
                      <label className="form-label small fw-medium d-flex align-items-center gap-2 mb-2">
                        <FiAtSign style={{ color: "var(--brand-700)" }} /> Correos manuales
                        {correosManuales.length > 0 && (
                          <span className="badge rounded-pill bg-brand small">{correosManuales.length}</span>
                        )}
                      </label>
                      <div className="d-flex gap-2 mb-2">
                        <input
                          type="email"
                          className="form-control form-control-sm rounded-3"
                          placeholder="correo@ejemplo.com"
                          value={correoInput}
                          onChange={(e) => {
                            setCorreoInput(e.target.value);
                            setCorreoError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              agregarCorreo();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary rounded-3 text-nowrap"
                          onClick={agregarCorreo}
                        >
                          Agregar
                        </button>
                      </div>
                      {correoError && <p className="text-danger small mb-2">{correoError}</p>}
                      {correosManuales.length > 0 && (
                        <div className="d-flex flex-wrap gap-2">
                          {correosManuales.map((c) => (
                            <span
                              key={c}
                              className="badge rounded-pill bg-white text-secondary border d-inline-flex align-items-center gap-2 py-1 px-2 small"
                            >
                              {c}
                              <button
                                type="button"
                                className="btn-close"
                                style={{ fontSize: "0.55rem" }}
                                onClick={() => quitarCorreo(c)}
                                aria-label="Quitar"
                              />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="fw-semibold small text-secondary text-uppercase mb-3" style={{ letterSpacing: "0.03em" }}>
                  Adjuntos (opcional)
                </p>

                <div
                  className="rounded-4 p-4 text-center mb-2"
                  style={{
                    border: `2px dashed ${arrastrando ? "var(--brand-700)" : "#d1d5db"}`,
                    backgroundColor: arrastrando ? "var(--brand-50)" : "#fafafa",
                    cursor: "pointer",
                    transition: "background-color .15s, border-color .15s",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setArrastrando(true);
                  }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setArrastrando(false);
                    agregarArchivos(e.dataTransfer.files);
                  }}
                >
                  <FiUploadCloud size={26} className="text-secondary mb-2" />
                  <p className="mb-0 small">
                    Arrastrá archivos acá o <span className="fw-medium text-brand">hacé clic para elegirlos</span>
                  </p>
                  <p className="text-secondary mb-0" style={{ fontSize: "0.75rem" }}>
                    Máximo {MAX_ADJUNTOS} archivos, {MAX_ADJUNTO_MB} MB c/u — PDF, Word, Excel, CSV, imágenes o texto
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                      agregarArchivos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {adjuntoError && <p className="text-danger small mb-2">{adjuntoError}</p>}
                {adjuntos.length > 0 && (
                  <div className="d-flex flex-column gap-1 mb-3">
                    {adjuntos.map((f, idx) => (
                      <div
                        key={`${f.name}-${f.size}`}
                        className="d-flex align-items-center justify-content-between rounded-3 px-3 py-2 small"
                        style={{ backgroundColor: "var(--brand-50)" }}
                      >
                        <span className="d-flex align-items-center gap-2 text-truncate">
                          <FiFileText className="flex-shrink-0" style={{ color: "var(--brand-700)" }} />
                          <span className="text-truncate">{f.name}</span>
                          <span className="text-secondary flex-shrink-0">({formatBytes(f.size)})</span>
                        </span>
                        <button
                          type="button"
                          className="btn-close flex-shrink-0"
                          style={{ fontSize: "0.6rem" }}
                          onClick={() => quitarArchivo(idx)}
                          aria-label="Quitar adjunto"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {resultadoEnvio && (
                  <div className="alert alert-success py-2 small d-flex align-items-start gap-2 mt-3">
                    <FiCheckCircle className="flex-shrink-0 mt-1" />
                    <span>
                      Comunicado enviado: <strong>{resultadoEnvio.enviadosOk}</strong> de{" "}
                      <strong>{resultadoEnvio.totalDestinatarios}</strong> correo(s) entregados correctamente
                      {resultadoEnvio.enviadosError > 0 && (
                        <>
                          {" "}
                          — <strong className="text-danger">{resultadoEnvio.enviadosError}</strong> con error.
                        </>
                      )}
                    </span>
                  </div>
                )}
                {formError && (
                  <div className="alert alert-danger py-2 small d-flex align-items-start gap-2 mt-3">
                    <FiAlertCircle className="flex-shrink-0 mt-1" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="submit"
                    className="btn btn-brand rounded-3 d-flex align-items-center gap-2 px-4"
                    disabled={enviando || !formularioListo}
                  >
                    <FiSend /> {enviando ? "Enviando..." : "Enviar comunicado"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-3" style={{ position: "sticky", top: "1rem" }}>
              <p className="fw-semibold small text-secondary text-uppercase mb-3" style={{ letterSpacing: "0.03em" }}>
                Resumen del envío
              </p>

              <div className="d-flex align-items-center justify-content-center rounded-4 py-3 mb-3" style={{ backgroundColor: "var(--brand-50)" }}>
                <div className="text-center">
                  <div className="fw-bold" style={{ fontSize: "2rem", color: "var(--brand-800)" }}>
                    {totalDestinatariosSeleccionados}
                  </div>
                  <div className="small text-secondary">destinatario(s) seleccionados</div>
                </div>
              </div>

              <ul className="list-unstyled small mb-3 d-flex flex-column gap-2">
                <li className="d-flex align-items-center justify-content-between">
                  <span className="d-flex align-items-center gap-2 text-secondary">
                    <FiUsers size={14} /> Roles
                  </span>
                  <span className="fw-medium">{rolesSeleccionados.length}</span>
                </li>
                <li className="d-flex align-items-center justify-content-between">
                  <span className="d-flex align-items-center gap-2 text-secondary">
                    <FiUser size={14} /> Usuarios puntuales
                  </span>
                  <span className="fw-medium">{usuariosSeleccionados.length}</span>
                </li>
                <li className="d-flex align-items-center justify-content-between">
                  <span className="d-flex align-items-center gap-2 text-secondary">
                    <FiAtSign size={14} /> Correos manuales
                  </span>
                  <span className="fw-medium">{correosManuales.length}</span>
                </li>
                <li className="d-flex align-items-center justify-content-between">
                  <span className="d-flex align-items-center gap-2 text-secondary">
                    <FiPaperclip size={14} /> Adjuntos
                  </span>
                  <span className="fw-medium">{adjuntos.length}</span>
                </li>
              </ul>

              <p className="small text-secondary mb-0" style={{ fontSize: "0.78rem" }}>
                Un rol se expande a todos sus usuarios activos al enviar. Si alguien aparece por más de un lado (rol,
                usuario o correo suelto), recibe un solo correo.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <FiClock className="text-secondary" />
            <h2 className="h6 fw-bold mb-0">Historial</h2>
          </div>
          <div className="d-flex gap-2" style={{ maxWidth: 280, width: "100%" }}>
            <input
              type="text"
              className="form-control form-control-sm rounded-3"
              placeholder="Buscar por asunto..."
              value={busquedaHistorial}
              onChange={(e) => setBusquedaHistorial(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarHistorial()}
            />
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" onClick={buscarHistorial}>
              <FiSearch />
            </button>
          </div>
        </div>

        {historialError && <div className="alert alert-danger py-2 small">{historialError}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium">Fecha</th>
                  <th className="fw-medium">Asunto</th>
                  <th className="fw-medium">Enviado por</th>
                  <th className="fw-medium">Estado</th>
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historialLoading && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!historialLoading && historial.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4 small">
                      Todavía no se ha enviado ningún comunicado.
                    </td>
                  </tr>
                )}
                {!historialLoading &&
                  historial.map((c) => (
                    <tr key={c.uuid} style={{ cursor: "pointer" }} onClick={() => abrirDetalle(c)}>
                      <td className="small text-secondary text-nowrap">{new Date(c.created_at).toLocaleString("es-CO")}</td>
                      <td className="small fw-medium">
                        {c.asunto}
                        {c.adjuntos?.length > 0 && (
                          <span
                            className="text-secondary ms-2 d-inline-flex align-items-center gap-1"
                            title={c.adjuntos.map((a) => a.nombre).join(", ")}
                          >
                            <FiPaperclip size={12} /> {c.adjuntos.length}
                          </span>
                        )}
                      </td>
                      <td className="small text-secondary">{c.creadoPor?.usuario || "—"}</td>
                      <td className="small">
                        {c.enviadosError > 0 ? (
                          <span className="badge rounded-pill small" style={{ backgroundColor: "#fee2e2", color: "#b91c1c" }}>
                            {c.enviadosOk}/{c.totalDestinatarios} — {c.enviadosError} con error
                          </span>
                        ) : (
                          <span className="badge rounded-pill small" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            {c.enviadosOk}/{c.totalDestinatarios} entregados
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                            title="Ver detalle"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirDetalle(c);
                            }}
                          >
                            <FiEye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
          <span className="small text-secondary">
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} comunicado(s))
          </span>
          {meta.totalPages > 1 && (
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <FiChevronLeft /> Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Siguiente <FiChevronRight />
              </button>
            </div>
          )}
        </div>

        {detalleOpen && (
          <ModalShell title="Detalle del comunicado" onClose={() => setDetalleOpen(false)} size="lg">
            {detalleLoading ? (
              <div className="text-center text-secondary py-4 small">Cargando...</div>
            ) : (
              detalle && (
                <div>
                  <p className="fw-semibold mb-1">{detalle.asunto}</p>
                  <p className="text-secondary small" style={{ whiteSpace: "pre-line" }}>
                    {detalle.mensaje}
                  </p>
                  <p className="small text-secondary mb-3">
                    Enviado por <strong>{detalle.creadoPor?.usuario || "—"}</strong> el{" "}
                    {new Date(detalle.created_at).toLocaleString("es-CO")}
                  </p>

                  {detalle.destinatariosResumen && (
                    <div className="mb-3 d-flex flex-column gap-2">
                      {detalle.destinatariosResumen.roles?.length > 0 && (
                        <div className="small d-flex align-items-start gap-2">
                          <FiUsers className="flex-shrink-0 mt-1" style={{ color: "var(--brand-700)" }} />
                          <span>
                            <strong>Roles:</strong> {detalle.destinatariosResumen.roles.map((r) => r.nombre).join(", ")}
                          </span>
                        </div>
                      )}
                      {detalle.destinatariosResumen.usuarios?.length > 0 && (
                        <div className="small d-flex align-items-start gap-2">
                          <FiUser className="flex-shrink-0 mt-1" style={{ color: "var(--brand-700)" }} />
                          <span>
                            <strong>Usuarios:</strong>{" "}
                            {detalle.destinatariosResumen.usuarios.map((u) => u.nombre).join(", ")}
                          </span>
                        </div>
                      )}
                      {detalle.destinatariosResumen.correos?.length > 0 && (
                        <div className="small d-flex align-items-start gap-2">
                          <FiAtSign className="flex-shrink-0 mt-1" style={{ color: "var(--brand-700)" }} />
                          <span>
                            <strong>Correos manuales:</strong> {detalle.destinatariosResumen.correos.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {detalle.adjuntos?.length > 0 && (
                    <div className="mb-3 small">
                      <strong className="d-flex align-items-center gap-1 mb-1">
                        <FiPaperclip /> Adjuntos
                      </strong>
                      <ul className="mb-0 ps-4">
                        {detalle.adjuntos.map((a) => (
                          <li key={a.nombre}>
                            {a.nombre} <span className="text-secondary">({formatBytes(a.tamanioBytes)})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="fw-medium small mb-2">
                    Resultado ({detalle.enviadosOk} de {detalle.totalDestinatarios} entregados)
                  </p>
                  <div className="table-responsive" style={{ maxHeight: "16rem", overflowY: "auto" }}>
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr className="small text-secondary">
                          <th>Correo</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.resultados || []).map((r) => (
                          <tr key={r.email}>
                            <td className="small">
                              {r.nombre ? `${r.nombre} — ` : ""}
                              {r.email}
                            </td>
                            <td className="small">
                              {r.ok ? (
                                <span className="text-success d-inline-flex align-items-center gap-1">
                                  <FiCheckCircle size={13} /> Enviado
                                </span>
                              ) : (
                                <span className="text-danger d-inline-flex align-items-center gap-1" title={r.error}>
                                  <FiX size={13} /> Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
            <div className="d-flex justify-content-end mt-3">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setDetalleOpen(false)}>
                Cerrar
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequireAdmin>
  );
}
