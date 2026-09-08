"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiDownload, FiArchive, FiRotateCcw, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyForm() {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    categoriaUuid: "",
    unidadMedidaUuid: "",
    costoCompra: "0",
    precioVenta: "0",
    manejaInventario: true,
    stockMinimo: "0",
    stockMaximo: "",
    estado: true,
  };
}

export default function ArticulosInventarioPage() {
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [exportando, setExportando] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);

  // Papelera de eliminados — solo Administrador (backend también lo exige).
  // Reutiliza la misma tabla: al activarse cambia la fuente de datos y las
  // acciones de la última columna (Restaurar en vez de Editar/Eliminar).
  const [verEliminados, setVerEliminados] = useState(false);
  const [eliminados, setEliminados] = useState([]);
  const [eliminadosLoading, setEliminadosLoading] = useState(false);
  const [restaurandoUuid, setRestaurandoUuid] = useState(null);
  const [eliminadosPage, setEliminadosPage] = useState(1);
  const [eliminadosMeta, setEliminadosMeta] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });

  useEffect(() => {
    setEsAdmin(esAdministrador());
  }, []);

  async function loadEliminados() {
    setEliminadosLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(eliminadosPage), limit: "100" });
      const { items: rows, meta: m } = await apiFetch(`/inventarios/articulos/eliminados?${qs}`);
      setEliminados(rows);
      setEliminadosMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminadosLoading(false);
    }
  }

  function toggleEliminados() {
    const next = !verEliminados;
    setVerEliminados(next);
    if (next) {
      if (eliminadosPage === 1) loadEliminados();
      else setEliminadosPage(1);
    }
  }

  useEffect(() => {
    if (verEliminados) loadEliminados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eliminadosPage]);

  async function handleRestore(articulo) {
    setRestaurandoUuid(articulo.uuid);
    try {
      await apiFetch(`/inventarios/articulos/${articulo.uuid}/restore`, { method: "POST" });
      loadEliminados();
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
      const qs = new URLSearchParams({ page: String(page), limit: "100", ...(search ? { search } : {}) });
      const { items: rows, meta: m } = await apiFetch(`/inventarios/articulos?${qs}`);
      setItems(rows);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit() {
    if (page === 1) load();
    else setPage(1);
  }

  async function loadCombos() {
    try {
      const [cat, uni] = await Promise.all([
        apiFetch("/inventarios/categorias?limit=100&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
      ]);
      setCategorias(cat.items || []);
      setUnidades(uni.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(articulo) {
    setEditing(articulo);
    setForm({
      codigo: articulo.codigo || "",
      nombre: articulo.nombre,
      descripcion: articulo.descripcion || "",
      categoriaUuid: articulo.categoria?.uuid || "",
      unidadMedidaUuid: articulo.unidadMedida?.uuid || "",
      costoCompra: String(articulo.costoCompra ?? 0),
      precioVenta: String(articulo.precioVenta ?? 0),
      manejaInventario: articulo.manejaInventario,
      stockMinimo: String(articulo.stockMinimo ?? 0),
      stockMaximo: articulo.stockMaximo != null ? String(articulo.stockMaximo) : "",
      estado: articulo.estado,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = {
        ...form,
        codigo: form.codigo || null,
        descripcion: form.descripcion || null,
        categoriaUuid: form.categoriaUuid || null,
        unidadMedidaUuid: form.unidadMedidaUuid || null,
        costoCompra: Number(form.costoCompra),
        precioVenta: Number(form.precioVenta),
        stockMinimo: form.stockMinimo === "" ? null : Number(form.stockMinimo),
        stockMaximo: form.stockMaximo === "" ? null : Number(form.stockMaximo),
      };
      if (editing) {
        await apiFetch(`/inventarios/articulos/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/inventarios/articulos", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const blob = await apiFetchBlob("/inventarios/articulos/exportar");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `articulos-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  }

  async function handleDelete(articulo) {
    if (!confirm(`¿Eliminar el artículo "${articulo.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/articulos/${articulo.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.articulos">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Artículos de Inventario</h1>
            <p className="text-secondary mb-0">Insumos, repuestos y artículos elaborados que maneja el inventario.</p>
          </div>
          <div className="d-flex gap-2">
            {esAdmin && (
              <button
                type="button"
                className={`btn rounded-3 d-flex align-items-center gap-2 ${verEliminados ? "btn-secondary" : "btn-outline-secondary"}`}
                onClick={toggleEliminados}
                title="Ver artículos eliminados (solo Administrador)"
              >
                {verEliminados ? <FiX /> : <FiArchive />} {verEliminados ? "Cerrar eliminados" : "Eliminados"}
              </button>
            )}
            {!verEliminados && hasPermission("inventario.articulos.ver") && (
              <button
                type="button"
                className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
                onClick={handleExportar}
                disabled={exportando}
              >
                <FiDownload /> {exportando ? "Exportando..." : "Exportar"}
              </button>
            )}
            {!verEliminados && hasPermission("inventario.articulos.crear") && (
              <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                <FiPlus /> Nuevo artículo
              </button>
            )}
          </div>
        </div>

        {verEliminados ? (
          <div className="alert alert-secondary py-2 small mb-3">
            Mostrando artículos eliminados — solo visibles para el Administrador. Siguen en la base de datos, sin
            aparecer en el listado normal, hasta que se restauren.
          </div>
        ) : (
          <div className="mb-3">
            <input
              type="text"
              className="form-control rounded-3"
              style={{ maxWidth: 320 }}
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            />
          </div>
        )}

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="small text-secondary" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th className="fw-medium">Código</th>
                  <th className="fw-medium">Nombre</th>
                  <th className="fw-medium">Categoría</th>
                  <th className="fw-medium">Tipo</th>
                  <th className="fw-medium">Unidad</th>
                  <th className="fw-medium">Costo</th>
                  <th className="fw-medium">Precio</th>
                  {verEliminados && <th className="fw-medium">Eliminado</th>}
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(verEliminados ? eliminadosLoading : loading) && (
                  <tr>
                    <td colSpan={verEliminados ? 9 : 8} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!verEliminados && !loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-3 small">
                      No hay artículos registrados todavía.
                    </td>
                  </tr>
                )}
                {verEliminados && !eliminadosLoading && eliminados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-3 small">
                      No hay artículos eliminados.
                    </td>
                  </tr>
                )}
                {!verEliminados &&
                  !loading &&
                  items.map((p) => (
                    <tr key={p.uuid}>
                      <td className="small text-secondary">{p.codigo || "—"}</td>
                      <td className="small fw-medium">{p.nombre}</td>
                      <td className="small text-secondary">{p.categoria?.nombre || "—"}</td>
                      <td className="small text-secondary">{p.categoria?.tipo || "—"}</td>
                      <td className="small text-secondary">{p.unidadMedida?.simbolo || "—"}</td>
                      <td className="small">{Number(p.costoCompra || 0).toFixed(2)}</td>
                      <td className="small">{Number(p.precioVenta || 0).toFixed(2)}</td>
                      <td>
                        <div className="d-flex justify-content-end gap-1 flex-nowrap">
                          {hasPermission("inventario.articulos.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Editar"
                              onClick={() => openEdit(p)}
                            >
                              <FiEdit2 size={15} />
                            </button>
                          )}
                          {esAdmin && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#dc2626" }}
                              title="Eliminar"
                              onClick={() => handleDelete(p)}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {verEliminados &&
                  !eliminadosLoading &&
                  eliminados.map((a) => (
                    <tr key={a.uuid}>
                      <td className="small text-secondary">{a.codigo || "—"}</td>
                      <td className="small fw-medium">{a.nombre}</td>
                      <td className="small text-secondary">{a.categoria?.nombre || "—"}</td>
                      <td className="small text-secondary">{a.categoria?.tipo || "—"}</td>
                      <td className="small text-secondary">{a.unidadMedida?.simbolo || "—"}</td>
                      <td className="small">{Number(a.costoCompra || 0).toFixed(2)}</td>
                      <td className="small">{Number(a.precioVenta || 0).toFixed(2)}</td>
                      <td className="small text-secondary">
                        {a.deletedAt ? new Date(a.deletedAt).toLocaleString("es-CO") : "—"}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-1 flex-nowrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex"
                            style={{ color: "#16a34a" }}
                            title="Restaurar"
                            disabled={restaurandoUuid === a.uuid}
                            onClick={() => handleRestore(a)}
                          >
                            <FiRotateCcw size={15} />
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
            {verEliminados
              ? `Mostrando página ${eliminadosMeta.page} de ${eliminadosMeta.totalPages} (${eliminadosMeta.total} eliminados)`
              : `Mostrando página ${meta.page} de ${meta.totalPages} (${meta.total} artículos)`}
          </span>
          {(verEliminados ? eliminadosMeta.totalPages : meta.totalPages) > 1 && (
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={verEliminados ? eliminadosPage <= 1 : page <= 1}
                onClick={() =>
                  verEliminados
                    ? setEliminadosPage((p) => Math.max(1, p - 1))
                    : setPage((p) => Math.max(1, p - 1))
                }
              >
                <FiChevronLeft /> Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={verEliminados ? eliminadosPage >= eliminadosMeta.totalPages : page >= meta.totalPages}
                onClick={() =>
                  verEliminados
                    ? setEliminadosPage((p) => Math.min(eliminadosMeta.totalPages, p + 1))
                    : setPage((p) => Math.min(meta.totalPages, p + 1))
                }
              >
                Siguiente <FiChevronRight />
              </button>
            </div>
          )}
        </div>

        {modalOpen && (
          <ModalShell title={editing ? "Editar artículo" : "Nuevo artículo"} onClose={() => setModalOpen(false)}>
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

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Categoría</label>
                  <select
                    className="form-select rounded-3"
                    value={form.categoriaUuid}
                    onChange={(e) => setForm((f) => ({ ...f, categoriaUuid: e.target.value }))}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.uuid} value={c.uuid}>
                        {c.nombre} ({c.tipo})
                      </option>
                    ))}
                  </select>
                  <p className="form-text small mb-0">El tipo del artículo es siempre el de su categoría.</p>
                </div>
                <div className="col-6">
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

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="articulo-maneja-inv"
                  checked={form.manejaInventario}
                  onChange={(e) => setForm((f) => ({ ...f, manejaInventario: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="articulo-maneja-inv">
                  Maneja inventario (afecta existencias/kárdex)
                </label>
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="articulo-inv-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="articulo-inv-estado">
                  Activo
                </label>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
