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
import TagPicker from "@/components/TagPicker";

const PLANTILLA_HEADERS = [
  "nombre",
  "codigo",
  "descripcion",
  "unidadMedida",
  "costoCompra",
  "precioVenta",
  "manejaInventario",
  "stockMinimo",
  "stockMaximo",
  "dosisPorHectarea",
  "dosisUnidad",
  "ingredientesActivos",
  "almacenes",
  "estado",
];
const PLANTILLA_EJEMPLO = [
  "Bravonil 720 SC",
  "",
  "Fungicida de contacto",
  "L",
  "45000",
  "0",
  "si",
  "5",
  "50",
  "4",
  "L",
  "Clorotalonil",
  "CORBANA",
  "activo",
];

function descargarPlantilla() {
  const worksheet = XLSX.utils.aoa_to_sheet([PLANTILLA_HEADERS, PLANTILLA_EJEMPLO]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_insumos_sanidad_vegetal.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

// Exporta el listado actual (ya filtrado) — no la plantilla de cargue
// masivo, que es solo un ejemplo de formato.
function descargarExcel(items) {
  const filas = items.map((i) => ({
    codigo: i.codigo || "",
    nombre: i.nombre,
    unidadMedida: i.unidadMedida?.simbolo || "",
    costoCompra: i.costoCompra ?? "",
    precioVenta: i.precioVenta ?? "",
    ingredientesActivos: (i.ingredientesActivos || []).map((ia) => ia.nombre).join(", "),
    estado: i.estado ? "activo" : "inactivo",
  }));
  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Insumos");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "insumos_sanidad_vegetal.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

// Valor centinela para la opción "Sin ingrediente activo" del filtro —
// distinto de "" (que significa "Todos") y de cualquier uuid real.
const SIN_INGREDIENTE_ACTIVO = "__sin__";

function emptyForm() {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    unidadMedidaUuid: "",
    costoCompra: "0",
    precioVenta: "0",
    manejaInventario: true,
    stockMinimo: "0",
    stockMaximo: "",
    dosisPorHectarea: "",
    dosisUnidadUuid: "",
    estado: true,
    almacenes: [], // [{uuid, label, sublabel}] — ver TagPicker
    ingredientesActivos: [], // idem, opcional
  };
}

// Insumos (Sanidad Vegetal) — mismo recurso Articulo que Inventarios, pero
// SIEMPRE caen en la categoría fija "Sanidad Vegetal" (la resuelve/crea el
// backend, ver ingredienteActivoInsumo.service.js) — por eso este
// formulario no tiene selector de categoría. Pueden además amarrarse
// (opcional) a los ingredientes activos que los componen.
export default function InsumosSanidadVegetalPage() {
  const [items, setItems] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [almacenesDisponibles, setAlmacenesDisponibles] = useState([]);
  const [ingredientesActivosDisponibles, setIngredientesActivosDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [ingredienteActivoUuid, setIngredienteActivoUuid] = useState("");
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false);

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

  // Papelera de insumos eliminados — solo Administrador (backend también lo
  // exige). Reutiliza la misma tabla: al activarse cambia la fuente de
  // datos y las acciones de la última columna (Restaurar en vez de
  // Editar/Eliminar).
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
      const { items: rows } = await apiFetch("/ingredientes-activos/insumos/eliminados?limit=100");
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

  async function handleRestore(insumo) {
    setRestaurandoUuid(insumo.uuid);
    try {
      await apiFetch(`/ingredientes-activos/insumos/${insumo.uuid}/restore`, { method: "POST" });
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
      const { items: rows } = await apiFetch(`/ingredientes-activos/insumos?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [uni, alm, ia] = await Promise.all([
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/ingredientes-activos?limit=100&estado=true"),
      ]);
      setUnidades(uni.items || []);
      setAlmacenesDisponibles(alm.items || []);
      setIngredientesActivosDisponibles(ia.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCombos();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemsFiltrados = items.filter((i) => {
    if (ingredienteActivoUuid === SIN_INGREDIENTE_ACTIVO) return (i.ingredientesActivos || []).length === 0;
    if (ingredienteActivoUuid) return (i.ingredientesActivos || []).some((ia) => ia.uuid === ingredienteActivoUuid);
    return true;
  });

  function toggleSeleccionado(uuid) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }

  const todosSeleccionados = itemsFiltrados.length > 0 && itemsFiltrados.every((i) => seleccionados.has(i.uuid));

  function toggleSeleccionarTodos() {
    setSeleccionados((prev) => {
      if (todosSeleccionados) return new Set();
      return new Set(itemsFiltrados.map((i) => i.uuid));
    });
  }

  // Sin endpoint de borrado en lote para este recurso (volumen bajo, no
  // amerita uno nuevo) — reusa el DELETE individual ya existente, una
  // llamada por insumo seleccionado.
  async function handleDeleteMasivo() {
    const cantidad = seleccionados.size;
    if (cantidad === 0) return;
    if (!confirm(`¿Eliminar ${cantidad} insumo(s) seleccionados?`)) return;
    setEliminandoMasivo(true);
    setError("");
    try {
      for (const uuid of seleccionados) {
        await apiFetch(`/ingredientes-activos/insumos/${uuid}`, { method: "DELETE" });
      }
      setSeleccionados(new Set());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminandoMasivo(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(insumo) {
    setEditing(insumo);
    setForm({
      codigo: insumo.codigo || "",
      nombre: insumo.nombre,
      descripcion: insumo.descripcion || "",
      unidadMedidaUuid: insumo.unidadMedida?.uuid || "",
      costoCompra: String(insumo.costoCompra ?? 0),
      precioVenta: String(insumo.precioVenta ?? 0),
      manejaInventario: insumo.manejaInventario,
      stockMinimo: String(insumo.stockMinimo ?? 0),
      stockMaximo: insumo.stockMaximo != null ? String(insumo.stockMaximo) : "",
      dosisPorHectarea: insumo.dosisPorHectarea != null ? String(insumo.dosisPorHectarea) : "",
      dosisUnidadUuid: insumo.dosisUnidad?.uuid || "",
      estado: insumo.estado,
      almacenes: (insumo.almacenes || []).map((a) => ({ uuid: a.uuid, label: a.nombre, sublabel: a.codigo })),
      ingredientesActivos: (insumo.ingredientesActivos || []).map((i) => ({ uuid: i.uuid, label: i.nombre })),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    // Si se registró la Dosis por hectárea, la unidad es obligatoria —
    // pedido explícito: un número de dosis sin unidad no sirve para nada
    // (Mezclas/Aspersiones no pueden calcular "Dosis real"/"% sobre
    // dosis" sin ella). Mismo criterio ya exigido en el backend.
    if (form.dosisPorHectarea !== "" && !form.dosisUnidadUuid) {
      setFormError("Si registras la Dosis por hectárea, también debes indicar su unidad.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        codigo: form.codigo || null,
        descripcion: form.descripcion || null,
        unidadMedidaUuid: form.unidadMedidaUuid || null,
        costoCompra: Number(form.costoCompra),
        precioVenta: Number(form.precioVenta),
        stockMinimo: form.stockMinimo === "" ? null : Number(form.stockMinimo),
        stockMaximo: form.stockMaximo === "" ? null : Number(form.stockMaximo),
        dosisPorHectarea: form.dosisPorHectarea === "" ? null : Number(form.dosisPorHectarea),
        dosisUnidadUuid: form.dosisUnidadUuid || null,
        almacenUuids: form.almacenes.map((a) => a.uuid),
        ingredientesActivoUuids: form.ingredientesActivos.map((i) => i.uuid),
      };
      delete body.almacenes;
      delete body.ingredientesActivos;
      if (editing) {
        await apiFetch(`/ingredientes-activos/insumos/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/ingredientes-activos/insumos", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(insumo) {
    if (!confirm(`¿Eliminar el insumo "${insumo.nombre}"?`)) return;
    try {
      await apiFetch(`/ingredientes-activos/insumos/${insumo.uuid}`, { method: "DELETE" });
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
      const resultado = await apiUpload("/ingredientes-activos/insumos/bulk-upload", cargueArchivo);
      setCargueResultado(resultado);
      load();
    } catch (err) {
      setCargueError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <RequirePermission code="menu.sanidad_vegetal.insumos">
      <div className="p-3 p-md-4">
        <ul className="nav nav-pills gap-1 mb-3">
          <li className="nav-item">
            <Link href="/sanidad-vegetal/mezclas" className="nav-link btn-sm py-1 px-3">
              Mezclas
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos/insumos" className="nav-link btn-sm py-1 px-3 active">
              Insumos
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos" className="nav-link btn-sm py-1 px-3">
              Ingredientes Activos
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/frac" className="nav-link btn-sm py-1 px-3">
              FRAC
            </Link>
          </li>
        </ul>

        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h4 mb-1">Insumos</h1>
            <p className="text-secondary mb-0">
              Artículos de inventario tipo insumo usados en Sanidad Vegetal — siempre quedan en la categoría{" "}
              &quot;Sanidad Vegetal&quot; y pueden amarrarse (opcional) a los ingredientes activos que los componen.
            </p>
          </div>
          <div className="d-flex gap-2">
            {esAdmin && (
              <button
                type="button"
                className={`btn btn-sm rounded-3 d-flex align-items-center gap-2 ${verEliminados ? "btn-secondary" : "btn-outline-secondary"}`}
                onClick={toggleEliminados}
                title="Ver insumos eliminados (solo Administrador)"
              >
                {verEliminados ? <FiX /> : <FiArchive />} {verEliminados ? "Cerrar eliminados" : "Eliminados"}
              </button>
            )}
            {!verEliminados && (
              <button
                type="button"
                className="btn btn-sm btn-link text-secondary text-decoration-none d-flex align-items-center gap-2"
                onClick={() => descargarExcel(itemsFiltrados)}
                title="Descargar el listado actual en Excel"
              >
                <FiDownload /> Descargar Excel
              </button>
            )}
            {!verEliminados && hasPermission("inventario.articulos.crear") && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-secondary text-decoration-none d-flex align-items-center gap-2"
                  onClick={openCargueModal}
                  title="Cargar varios insumos desde un archivo Excel/CSV"
                >
                  <FiUploadCloud /> Cargue masivo
                </button>
                <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                  <FiPlus /> Nuevo insumo
                </button>
              </>
            )}
          </div>
        </div>

        {!verEliminados && seleccionados.size > 0 && hasPermission("inventario.articulos.eliminar") && (
          <div className="d-flex align-items-center gap-3 mb-3 p-2 px-3 rounded-3" style={{ backgroundColor: "#fef2f2" }}>
            <span className="small fw-medium">{seleccionados.size} insumo(s) seleccionados</span>
            <button
              type="button"
              className="btn btn-sm btn-danger rounded-3 d-flex align-items-center gap-2"
              disabled={eliminandoMasivo}
              onClick={handleDeleteMasivo}
            >
              <FiTrash2 /> {eliminandoMasivo ? "Eliminando..." : "Eliminar seleccionados"}
            </button>
            <button type="button" className="btn btn-sm btn-link text-secondary" onClick={() => setSeleccionados(new Set())}>
              Cancelar
            </button>
          </div>
        )}

        {verEliminados ? (
          <div className="alert alert-secondary py-2 small mb-3">
            Mostrando insumos eliminados — solo visibles para el Administrador. Siguen en la base de datos, sin
            aparecer en el listado normal, hasta que se restauren.
          </div>
        ) : (
        <div className="card border-0 rounded-2 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label small mb-1">Buscar por nombre o código</label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  list="insumos-sugerencias"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                />
                <datalist id="insumos-sugerencias">
                  {items.map((i) => (
                    <option key={i.uuid} value={i.nombre} />
                  ))}
                  {items
                    .filter((i) => i.codigo)
                    .map((i) => (
                      <option key={`${i.uuid}-cod`} value={i.codigo} />
                    ))}
                </datalist>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small mb-1">Ingrediente activo</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={ingredienteActivoUuid}
                  onChange={(e) => setIngredienteActivoUuid(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value={SIN_INGREDIENTE_ACTIVO}>Sin ingrediente activo</option>
                  {ingredientesActivosDisponibles.map((ia) => (
                    <option key={ia.uuid} value={ia.uuid}>
                      {ia.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        )}

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-2 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  {!verEliminados && (
                    <th style={{ width: "2.5rem" }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={todosSeleccionados}
                        onChange={toggleSeleccionarTodos}
                        title="Seleccionar todos"
                      />
                    </th>
                  )}
                  <th className="fw-medium">Código</th>
                  <th className="fw-medium">Nombre</th>
                  <th className="fw-medium">Ingredientes activos</th>
                  <th className="fw-medium">Dosis por hectárea</th>
                  {verEliminados && <th className="fw-medium">Eliminado</th>}
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(verEliminados ? eliminadosLoading : loading) && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!verEliminados && !loading && itemsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      No hay insumos registrados todavía.
                    </td>
                  </tr>
                )}
                {verEliminados && !eliminadosLoading && eliminados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      No hay insumos eliminados.
                    </td>
                  </tr>
                )}
                {!verEliminados &&
                  !loading &&
                  itemsFiltrados.map((i) => (
                    <tr key={i.uuid}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={seleccionados.has(i.uuid)}
                          onChange={() => toggleSeleccionado(i.uuid)}
                        />
                      </td>
                      <td className="small fw-medium">{i.codigo || "—"}</td>
                      <td className="small">{i.nombre}</td>
                      <td className="small text-secondary">
                        {(i.ingredientesActivos || []).length > 0
                          ? i.ingredientesActivos.map((ia) => ia.nombre).join(", ")
                          : "—"}
                      </td>
                      <td className="small text-secondary">
                        {i.dosisPorHectarea != null
                          ? `${Number(i.dosisPorHectarea).toFixed(3)} ${i.dosisUnidad?.simbolo || ""}/ha`
                          : "—"}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("inventario.articulos.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Editar"
                              onClick={() => openEdit(i)}
                            >
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.articulos.eliminar") && (
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
                      <td className="small fw-medium">{i.codigo || "—"}</td>
                      <td className="small">{i.nombre}</td>
                      <td className="small text-secondary">
                        {(i.ingredientesActivos || []).length > 0
                          ? i.ingredientesActivos.map((ia) => ia.nombre).join(", ")
                          : "—"}
                      </td>
                      <td className="small text-secondary">
                        {i.dosisPorHectarea != null
                          ? `${Number(i.dosisPorHectarea).toFixed(3)} ${i.dosisUnidad?.simbolo || ""}/ha`
                          : "—"}
                      </td>
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
          <ModalShell title={editing ? "Editar insumo" : "Nuevo insumo"} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">Código</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={20}
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  />
                </div>
                <div className="col-8">
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
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Descripción</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={1000}
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Unidad de medida</label>
                <select
                  className="form-select rounded-3"
                  value={form.unidadMedidaUuid}
                  onChange={(e) => setForm((f) => ({ ...f, unidadMedidaUuid: e.target.value }))}
                >
                  <option value="">Sin unidad</option>
                  {unidades.map((u) => (
                    <option key={u.uuid} value={u.uuid}>
                      {u.nombre} ({u.simbolo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Costo de compra</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={form.costoCompra}
                    onChange={(e) => setForm((f) => ({ ...f, costoCompra: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Precio de venta</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={form.precioVenta}
                    onChange={(e) => setForm((f) => ({ ...f, precioVenta: e.target.value }))}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Stock mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={form.stockMinimo}
                    onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Stock máximo</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={form.stockMaximo}
                    onChange={(e) => setForm((f) => ({ ...f, stockMaximo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3 align-items-end">
                <div className="col-6">
                  <label className="form-label small fw-medium">Dosis por hectárea</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className="form-control rounded-3"
                    placeholder="Ej. 4"
                    value={form.dosisPorHectarea}
                    onChange={(e) => setForm((f) => ({ ...f, dosisPorHectarea: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Unidad</label>
                  <select
                    className="form-select rounded-3"
                    value={form.dosisUnidadUuid}
                    onChange={(e) => setForm((f) => ({ ...f, dosisUnidadUuid: e.target.value }))}
                  >
                    <option value="">Sin unidad</option>
                    {unidades.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.nombre} ({u.simbolo})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="form-text small mb-0">Opcional — solo de referencia (ej. &quot;4 L/ha&quot;).</p>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Ingredientes activos</label>
                <TagPicker
                  items={ingredientesActivosDisponibles.map((i) => ({ uuid: i.uuid, label: i.nombre }))}
                  selected={form.ingredientesActivos}
                  onChange={(ingredientesActivos) => setForm((f) => ({ ...f, ingredientesActivos }))}
                  placeholder="Buscar ingrediente activo para agregar..."
                />
                <p className="form-text small mb-0">Opcional — puede quedar sin ninguno asignado.</p>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Almacenes</label>
                <TagPicker
                  items={almacenesDisponibles.map((a) => ({ uuid: a.uuid, label: a.nombre, sublabel: a.codigo }))}
                  selected={form.almacenes}
                  onChange={(almacenes) => setForm((f) => ({ ...f, almacenes }))}
                  placeholder="Buscar almacén para agregar..."
                />
                <p className="form-text small mb-0">
                  Sin ningún almacén seleccionado, el insumo es visible/seleccionable en todos.
                </p>
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="insumo-maneja-inv"
                  checked={form.manejaInventario}
                  onChange={(e) => setForm((f) => ({ ...f, manejaInventario: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="insumo-maneja-inv">
                  Maneja inventario (afecta existencias/kárdex)
                </label>
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="insumo-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="insumo-estado">
                  Activo
                </label>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setModalOpen(false)}>
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
          <ModalShell title="Cargue masivo de insumos" onClose={() => setCargueModalOpen(false)}>
            <p className="small text-secondary mb-3">
              Sube un archivo .xlsx o .csv con las columnas <strong>nombre</strong> (obligatoria), <strong>codigo</strong>,{" "}
              <strong>descripcion</strong>, <strong>unidadMedida</strong> (código), <strong>costoCompra</strong>,{" "}
              <strong>precioVenta</strong>, <strong>manejaInventario</strong> (si/no), <strong>stockMinimo</strong>,{" "}
              <strong>stockMaximo</strong>, <strong>dosisPorHectarea</strong>, <strong>dosisUnidad</strong> (código),{" "}
              <strong>ingredientesActivos</strong> (nombres separados por coma, opcional),{" "}
              <strong>almacenes</strong> (código o nombre, separados por coma, opcional — sin ninguno queda visible
              en todos) y <strong>estado</strong> (activo/inactivo). Siempre caen en la categoría &quot;Sanidad
              Vegetal&quot;. Si un nombre ya existe (aunque esté en otra categoría), se actualiza y se mueve acá en
              vez de duplicarse.
            </p>

            <button
              type="button"
              className="btn btn-sm btn-link text-secondary text-decoration-none d-flex align-items-center gap-2 mb-3"
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
                Cargue terminado — creados: {cargueResultado.insumosCreados}, actualizados:{" "}
                {cargueResultado.insumosActualizados}
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
              <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setCargueModalOpen(false)}>
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
