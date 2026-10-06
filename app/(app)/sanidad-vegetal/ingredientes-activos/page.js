"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { FiPlus, FiEdit2, FiTrash2, FiUploadCloud, FiDownload, FiArchive, FiRotateCcw, FiX } from "react-icons/fi";
import { apiFetch, apiUpload } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyForm() {
  return { nombre: "", descripcion: "", estado: true };
}

const PLANTILLA_HEADERS = ["nombre", "descripcion", "estado"];
const PLANTILLA_EJEMPLO = ["Mancozeb", "Fungicida de contacto", "activo"];

function descargarPlantilla() {
  const worksheet = XLSX.utils.aoa_to_sheet([PLANTILLA_HEADERS, PLANTILLA_EJEMPLO]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_ingredientes_activos.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

// Exporta el listado actual (ya filtrado por el buscador) — no la plantilla
// de cargue masivo, que es solo un ejemplo de formato.
function descargarExcel(items) {
  const filas = items.map((i) => ({
    nombre: i.nombre,
    descripcion: i.descripcion || "",
    estado: i.estado ? "activo" : "inactivo",
  }));
  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ingredientes activos");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ingredientes_activos.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export default function IngredientesActivosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const inputCargueRef = useRef(null);
  const [cargueModalOpen, setCargueModalOpen] = useState(false);
  const [cargueArchivo, setCargueArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargueError, setCargueError] = useState("");
  const [cargueResultado, setCargueResultado] = useState(null);

  // Papelera de ingredientes activos eliminados — solo Administrador
  // (backend también lo exige). Reutiliza la misma tabla: al activarse
  // cambia la fuente de datos y las acciones de la última columna
  // (Restaurar en vez de Editar/Eliminar).
  const [esAdmin, setEsAdmin] = useState(false);
  const [verEliminados, setVerEliminados] = useState(false);
  const [eliminados, setEliminados] = useState([]);
  const [eliminadosLoading, setEliminadosLoading] = useState(false);
  const [restaurandoUuid, setRestaurandoUuid] = useState(null);

  useEffect(() => {
    setEsAdmin(esAdministrador());
  }, []);

  async function loadEliminados() {
    setEliminadosLoading(true);
    setError("");
    try {
      const { items: rows } = await apiFetch("/ingredientes-activos/eliminados?limit=100");
      setEliminados(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminadosLoading(false);
    }
  }

  function toggleEliminados() {
    const next = !verEliminados;
    setVerEliminados(next);
    if (next) loadEliminados();
  }

  async function handleRestore(ingrediente) {
    setRestaurandoUuid(ingrediente.uuid);
    try {
      await apiFetch(`/ingredientes-activos/${ingrediente.uuid}/restore`, { method: "POST" });
      loadEliminados();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestaurandoUuid(null);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100", ...(search ? { search } : {}) });
      const { items: rows } = await apiFetch(`/ingredientes-activos?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(ingrediente) {
    setEditing(ingrediente);
    setForm({
      nombre: ingrediente.nombre,
      descripcion: ingrediente.descripcion || "",
      estado: ingrediente.estado,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = { ...form, descripcion: form.descripcion || null };
      if (editing) {
        await apiFetch(`/ingredientes-activos/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/ingredientes-activos", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ingrediente) {
    if (!confirm(`¿Eliminar el ingrediente activo "${ingrediente.nombre}"?`)) return;
    try {
      await apiFetch(`/ingredientes-activos/${ingrediente.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openCargueModal() {
    setCargueArchivo(null);
    setCargueError("");
    setCargueResultado(null);
    setCargueModalOpen(true);
  }

  function handleElegirArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCargueArchivo(file);
    setCargueError("");
    setCargueResultado(null);
  }

  async function handleSubirCargue() {
    if (!cargueArchivo) return;
    setCargando(true);
    setCargueError("");
    try {
      const resultado = await apiUpload("/ingredientes-activos/bulk-upload", cargueArchivo);
      setCargueResultado(resultado);
      load();
    } catch (err) {
      setCargueError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <RequirePermission code="menu.sanidad_vegetal.ingredientes_activos">
      <div className="p-4 p-md-5">
        <ul className="nav nav-pills mb-3">
          <li className="nav-item">
            <Link href="/sanidad-vegetal/mezclas" className="nav-link rounded-3">
              Mezclas
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos/insumos" className="nav-link rounded-3">
              Insumos
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos" className="nav-link rounded-3 active">
              Ingredientes Activos
            </Link>
          </li>
        </ul>
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Ingredientes Activos</h1>
            <p className="text-secondary mb-0">
              Maestro de referencia de los ingredientes activos que componen los agroquímicos usados en las aspersiones.
            </p>
          </div>
          <div className="d-flex gap-2">
            {esAdmin && (
              <button
                type="button"
                className={`btn btn-sm rounded-3 d-flex align-items-center gap-2 ${verEliminados ? "btn-secondary" : "btn-outline-secondary"}`}
                onClick={toggleEliminados}
                title="Ver ingredientes activos eliminados (solo Administrador)"
              >
                {verEliminados ? <FiX /> : <FiArchive />} {verEliminados ? "Cerrar eliminados" : "Eliminados"}
              </button>
            )}
            {!verEliminados && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
                onClick={() => descargarExcel(items)}
                title="Descargar el listado actual en Excel"
              >
                <FiDownload /> Descargar Excel
              </button>
            )}
            {!verEliminados && hasPermission("ingrediente_activo.crear") && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
                  onClick={openCargueModal}
                  title="Cargar varios ingredientes activos desde un archivo Excel/CSV"
                >
                  <FiUploadCloud /> Cargue masivo
                </button>
                <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                  <FiPlus /> Nuevo ingrediente activo
                </button>
              </>
            )}
          </div>
        </div>

        {verEliminados ? (
          <div className="alert alert-secondary py-2 small mb-3">
            Mostrando ingredientes activos eliminados — solo visibles para el Administrador. Siguen en la base de
            datos, sin aparecer en el listado normal, hasta que se restauren.
          </div>
        ) : (
        <div className="card border-0 rounded-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label small mb-1">Buscar por nombre</label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  list="ingredientes-activos-sugerencias"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                />
                <datalist id="ingredientes-activos-sugerencias">
                  {items.map((i) => (
                    <option key={i.uuid} value={i.nombre} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>
        )}

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium">Nombre</th>
                  <th className="fw-medium">Descripción</th>
                  {verEliminados && <th className="fw-medium">Eliminado</th>}
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(verEliminados ? eliminadosLoading : loading) && (
                  <tr>
                    <td colSpan={verEliminados ? 4 : 3} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!verEliminados && !loading && items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-secondary py-3 small">
                      No hay ingredientes activos registrados todavía.
                    </td>
                  </tr>
                )}
                {verEliminados && !eliminadosLoading && eliminados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-3 small">
                      No hay ingredientes activos eliminados.
                    </td>
                  </tr>
                )}
                {!verEliminados &&
                  !loading &&
                  items.map((i) => (
                    <tr key={i.uuid}>
                      <td className="small fw-medium">{i.nombre}</td>
                      <td className="small text-secondary">{i.descripcion || "—"}</td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("ingrediente_activo.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Editar"
                              onClick={() => openEdit(i)}
                            >
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("ingrediente_activo.eliminar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#dc2626" }}
                              title="Eliminar"
                              onClick={() => handleDelete(i)}
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {verEliminados &&
                  !eliminadosLoading &&
                  eliminados.map((i) => (
                    <tr key={i.uuid}>
                      <td className="small fw-medium">{i.nombre}</td>
                      <td className="small text-secondary">{i.descripcion || "—"}</td>
                      <td className="small text-secondary">
                        {i.deletedAt ? new Date(i.deletedAt).toLocaleString("es-CO") : "—"}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex"
                            style={{ color: "#16a34a" }}
                            title="Restaurar"
                            disabled={restaurandoUuid === i.uuid}
                            onClick={() => handleRestore(i)}
                          >
                            <FiRotateCcw />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <ModalShell title={editing ? "Editar ingrediente activo" : "Nuevo ingrediente activo"} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  required
                  maxLength={150}
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Descripción</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={255}
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="ingrediente-activo-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="ingrediente-activo-estado">
                  Activo
                </label>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {cargueModalOpen && (
          <ModalShell title="Cargue masivo de ingredientes activos" onClose={() => setCargueModalOpen(false)}>
            <p className="small text-secondary mb-3">
              Sube un archivo .xlsx o .csv con las columnas <strong>nombre</strong> (obligatoria), <strong>descripcion</strong> y{" "}
              <strong>estado</strong> (activo/inactivo). Si un nombre ya existe, se actualiza en vez de duplicarse.
            </p>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2 mb-3"
              onClick={descargarPlantilla}
            >
              <FiDownload /> Descargar plantilla de ejemplo (.xlsx)
            </button>

            <input
              ref={inputCargueRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="form-control rounded-3 mb-3"
              onChange={handleElegirArchivo}
            />

            {cargueError && <div className="alert alert-danger py-2 small">{cargueError}</div>}

            {cargueResultado && (
              <div className="alert alert-success py-2 small">
                Cargue terminado — creados: {cargueResultado.ingredientesCreados}, actualizados:{" "}
                {cargueResultado.ingredientesActualizados}
                {cargueResultado.errores?.length > 0 && (
                  <>
                    <div className="mt-2 fw-medium" style={{ color: "#b45309" }}>
                      {cargueResultado.errores.length} fila(s) con error:
                    </div>
                    <ul className="mb-0 ps-3">
                      {cargueResultado.errores.map((err, idx) => (
                        <li key={idx}>
                          Fila {err.fila}: {err.mensaje}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setCargueModalOpen(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-brand btn-sm rounded-3"
                disabled={!cargueArchivo || cargando}
                onClick={handleSubirCargue}
              >
                {cargando ? "Subiendo..." : "Subir archivo"}
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
