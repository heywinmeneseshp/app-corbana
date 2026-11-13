"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiExternalLink, FiFileText, FiPlus, FiTrash2, FiUpload } from "react-icons/fi";
import { apiFetch, apiFetchBlob, apiFetchFormData, apiFetchTodos } from "@/lib/api";
import { hasPermission } from "@/lib/auth";

const TIPOS_ADJUNTO = [
  { value: "FOTO", label: "Foto de evidencia" },
  { value: "CARTA_AUTORIZACION", label: "Carta de autorización" },
  { value: "INFORME", label: "Informe / anexo" },
];
const ROLES = [
  { value: "ENTRENAMIENTO", label: "En entrenamiento" },
  { value: "ACOMPANANTE", label: "Acompañante" },
];
const fmtN = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es", { maximumFractionDigits: 2 }));
const esImagen = (mime) => String(mime || "").startsWith("image/");

// Servicio de una orden hecho por un tercero: quién lo hizo (proveedor y técnico responsable), fechas, lecturas del equipo al ingreso, quién lo recibió,
// los participantes (p. ej. colaboradores en entrenamiento) y las evidencias (fotos, carta de autorización, informes) que se guardan en Google Drive.
export default function OrdenServicio({ ordenUuid }) {
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [tipoAdjunto, setTipoAdjunto] = useState("FOTO");
  const [hallazgoUuid, setHallazgoUuid] = useState("");
  const [miniaturas, setMiniaturas] = useState({}); // uuid -> url de objeto
  const inputArchivos = useRef(null);
  const puedeEditar = hasPermission("inventario.ordenes.editar");

  const cargar = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/servicio`), apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/checklist`).catch(() => ({ hallazgos: [] }))]);
      setDatos(s);
      setHallazgos(c.hallazgos || []);
      setForm({
        ejecutorTipo: s.ejecutorTipo,
        proveedorUuid: s.proveedor?.uuid || "",
        tecnicoResponsable: s.tecnicoResponsable || "",
        fechaInicio: s.fechaInicio || "",
        recibidoPor: s.recibidoPor || "",
        fechaAceptacion: s.fechaAceptacion || "",
        participantes: s.participantes.map((p) => ({ ...p })),
      });
    } catch (err) {
      setError(err.message);
    }
  }, [ordenUuid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    apiFetchTodos("/inventarios/proveedores?limit=100").then((r) => setProveedores(r.items || [])).catch(() => {});
  }, [cargar]);

  // Miniaturas de las imágenes: se piden con la sesión (el archivo vive en un Drive privado) y se muestran como objeto local.
  useEffect(() => {
    let activo = true;
    const pendientes = (datos?.adjuntos || []).filter((a) => esImagen(a.mime) && !miniaturas[a.uuid]);
    pendientes.forEach((a) =>
      apiFetchBlob(`/inventarios/ordenes-mantenimiento/adjuntos/${a.uuid}/archivo`)
        .then((blob) => activo && setMiniaturas((m) => ({ ...m, [a.uuid]: URL.createObjectURL(blob) })))
        .catch(() => {}),
    );
    return () => {
      activo = false;
    };
  }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    setError("");
    setAviso("");
    setGuardando(true);
    try {
      const cuerpo = { ...form, proveedorUuid: form.proveedorUuid || null, fechaInicio: form.fechaInicio || null, fechaAceptacion: form.fechaAceptacion || null, participantes: form.participantes.filter((p) => p.nombre.trim()) };
      await apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/servicio`, { method: "PUT", body: JSON.stringify(cuerpo) });
      await cargar();
      setAviso("Servicio guardado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function subir(e) {
    const archivos = [...(e.target.files || [])];
    if (archivos.length === 0) return;
    setError("");
    setAviso("");
    setSubiendo(true);
    try {
      const fd = new FormData();
      archivos.forEach((f) => fd.append("archivos", f));
      fd.append("tipo", tipoAdjunto);
      if (hallazgoUuid) fd.append("hallazgoUuid", hallazgoUuid);
      await apiFetchFormData(`/inventarios/ordenes-mantenimiento/${ordenUuid}/adjuntos`, fd);
      await cargar();
      setAviso(`${archivos.length} archivo(s) subido(s) a Google Drive.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
      if (inputArchivos.current) inputArchivos.current.value = "";
    }
  }

  async function abrir(a) {
    try {
      const blob = await apiFetchBlob(`/inventarios/ordenes-mantenimiento/adjuntos/${a.uuid}/archivo`);
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(a) {
    if (!window.confirm(`¿Eliminar «${a.nombre}»? También se borra de Google Drive.`)) return;
    setError("");
    try {
      await apiFetch(`/inventarios/ordenes-mantenimiento/adjuntos/${a.uuid}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!datos || !form) return error ? <div className="alert alert-danger py-2 small">{error}</div> : <p className="small text-secondary">Cargando...</p>;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setPart = (i, patch) => set({ participantes: form.participantes.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const externo = form.ejecutorTipo === "EXTERNO";

  return (
    <div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {aviso && <div className="alert alert-success py-2 small">{aviso}</div>}

      <div className="row g-2 mb-2">
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium mb-1">Quién hace el servicio</label>
          <select className="form-select form-select-sm rounded-1" disabled={!puedeEditar} value={form.ejecutorTipo} onChange={(e) => set({ ejecutorTipo: e.target.value })}>
            <option value="INTERNO">Personal propio</option>
            <option value="EXTERNO">Proveedor externo</option>
          </select>
        </div>
        <div className="col-6 col-md-5">
          <label className="form-label small fw-medium mb-1">Proveedor</label>
          <select className="form-select form-select-sm rounded-1" disabled={!puedeEditar || !externo} value={form.proveedorUuid} onChange={(e) => set({ proveedorUuid: e.target.value })}>
            <option value="">{externo ? "Elige el proveedor" : "—"}</option>
            {proveedores.map((p) => (
              <option key={p.uuid} value={p.uuid}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small fw-medium mb-1">Técnico responsable</label>
          <input className="form-control form-control-sm rounded-1" disabled={!puedeEditar} maxLength={150} value={form.tecnicoResponsable} onChange={(e) => set({ tecnicoResponsable: e.target.value })} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium mb-1">Fecha de inicio</label>
          <input type="date" className="form-control form-control-sm rounded-1" disabled={!puedeEditar} value={form.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium mb-1">Lectura al ingreso</label>
          <div className="form-control form-control-sm rounded-1 bg-light" title="Se toma del equipo al crear la orden">
            {fmtN(datos.lecturaKm)} km · {fmtN(datos.lecturaHoras)} h
          </div>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label small fw-medium mb-1">Recibido por (representante)</label>
          <input className="form-control form-control-sm rounded-1" disabled={!puedeEditar} maxLength={150} value={form.recibidoPor} onChange={(e) => set({ recibidoPor: e.target.value })} />
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label small fw-medium mb-1">Fecha de aceptación</label>
          <input type="date" className="form-control form-control-sm rounded-1" disabled={!puedeEditar} value={form.fechaAceptacion} onChange={(e) => set({ fechaAceptacion: e.target.value })} />
        </div>
      </div>

      <div className="border rounded-1 p-2 mb-2">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <span className="fw-semibold small">Participantes (p. ej. colaboradores en entrenamiento)</span>
          {puedeEditar && (
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={() => set({ participantes: [...form.participantes, { nombre: "", rol: "ENTRENAMIENTO" }] })}>
              <FiPlus /> Agregar
            </button>
          )}
        </div>
        {form.participantes.length === 0 && <div className="small text-secondary">Sin participantes.</div>}
        {form.participantes.map((p, i) => (
          <div key={i} className="d-flex gap-2 mb-1">
            <input className="form-control form-control-sm rounded-1" placeholder="Nombre" disabled={!puedeEditar} maxLength={150} value={p.nombre} onChange={(e) => setPart(i, { nombre: e.target.value })} />
            <select className="form-select form-select-sm rounded-1" style={{ maxWidth: "11rem" }} disabled={!puedeEditar} value={p.rol} onChange={(e) => setPart(i, { rol: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {puedeEditar && (
              <button type="button" className="btn btn-link btn-sm text-danger p-1" title="Quitar" onClick={() => set({ participantes: form.participantes.filter((_, j) => j !== i) })}>
                <FiTrash2 />
              </button>
            )}
          </div>
        ))}
      </div>

      {puedeEditar && (
        <button type="button" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1 mb-3" disabled={guardando} onClick={guardar}>
          <FiCheck /> {guardando ? "Guardando..." : "Guardar servicio"}
        </button>
      )}

      <div className="border rounded-1 p-2">
        <div className="fw-semibold small mb-2">Evidencias y documentos (Google Drive)</div>
        {puedeEditar && (
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={tipoAdjunto} onChange={(e) => setTipoAdjunto(e.target.value)}>
              {TIPOS_ADJUNTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select className="form-select form-select-sm rounded-1" style={{ maxWidth: "22rem" }} value={hallazgoUuid} onChange={(e) => setHallazgoUuid(e.target.value)} title="Opcional: liga las fotos a un hallazgo">
              <option value="">Sin ligar a un hallazgo</option>
              {hallazgos.map((h) => (
                <option key={h.uuid} value={h.uuid}>
                  {h.descripcion.slice(0, 70)}
                </option>
              ))}
            </select>
            <input ref={inputArchivos} type="file" multiple accept="image/*,application/pdf" className="d-none" id="orden-adjuntos" onChange={subir} />
            <label htmlFor="orden-adjuntos" className={`btn btn-outline-secondary btn-sm rounded-1 mb-0 d-inline-flex align-items-center gap-1 ${subiendo ? "disabled" : ""}`}>
              <FiUpload /> {subiendo ? "Subiendo..." : "Subir archivos"}
            </label>
          </div>
        )}
        {datos.adjuntos.length === 0 && <div className="small text-secondary">Aún no hay archivos.</div>}
        <div className="d-flex flex-wrap gap-2">
          {datos.adjuntos.map((a) => (
            <div key={a.uuid} className="border rounded-1 p-1 text-center" style={{ width: 130 }}>
              {esImagen(a.mime) && miniaturas[a.uuid] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={miniaturas[a.uuid]} alt={a.nombre} style={{ width: "100%", height: 80, objectFit: "cover", cursor: "pointer" }} onClick={() => abrir(a)} />
              ) : (
                <div className="d-flex align-items-center justify-content-center text-secondary" style={{ height: 80, cursor: "pointer" }} onClick={() => abrir(a)}>
                  <FiFileText size={30} />
                </div>
              )}
              <div className="text-truncate" style={{ fontSize: "0.7rem" }} title={a.nombre}>
                {a.nombre}
              </div>
              <div className="text-secondary" style={{ fontSize: "0.66rem" }}>
                {TIPOS_ADJUNTO.find((t) => t.value === a.tipo)?.label}
              </div>
              <div className="d-flex justify-content-center gap-1">
                <button type="button" className="btn btn-link btn-sm p-0 text-secondary" title="Abrir" onClick={() => abrir(a)}>
                  <FiExternalLink />
                </button>
                {puedeEditar && (
                  <button type="button" className="btn btn-link btn-sm p-0 text-danger" title="Eliminar" onClick={() => eliminar(a)}>
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
