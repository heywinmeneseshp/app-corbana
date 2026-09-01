"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const TIPOS = ["INSUMO", "REPUESTO", "ELABORADO", "GENERAL"];

function emptyForm() {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    tipo: "GENERAL",
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

export default function ProductosInventarioPage() {
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100", ...(search ? { search } : {}) });
      const { items: rows } = await apiFetch(`/inventarios/productos?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    load();
    loadCombos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(producto) {
    setEditing(producto);
    setForm({
      codigo: producto.codigo || "",
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      tipo: producto.tipo,
      categoriaUuid: producto.categoria?.uuid || "",
      unidadMedidaUuid: producto.unidadMedida?.uuid || "",
      costoCompra: String(producto.costoCompra ?? 0),
      precioVenta: String(producto.precioVenta ?? 0),
      manejaInventario: producto.manejaInventario,
      stockMinimo: String(producto.stockMinimo ?? 0),
      stockMaximo: producto.stockMaximo != null ? String(producto.stockMaximo) : "",
      estado: producto.estado,
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
        await apiFetch(`/inventarios/productos/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/inventarios/productos", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(producto) {
    if (!confirm(`¿Eliminar el producto "${producto.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/productos/${producto.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.productos">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Productos de Inventario</h1>
            <p className="text-secondary mb-0">Insumos, repuestos y productos elaborados que maneja el inventario.</p>
          </div>
          {hasPermission("inventario.productos.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nuevo producto
            </button>
          )}
        </div>

        <div className="mb-3">
          <input
            type="text"
            className="form-control rounded-3"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Costo</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-4">
                      No hay productos registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((p) => (
                    <tr key={p.uuid}>
                      <td className="small text-secondary">{p.codigo || "—"}</td>
                      <td className="fw-medium">{p.nombre}</td>
                      <td className="small text-secondary">{p.tipo}</td>
                      <td className="small text-secondary">{p.categoria?.nombre || "—"}</td>
                      <td className="small text-secondary">{p.unidadMedida?.simbolo || "—"}</td>
                      <td className="small">{Number(p.costoCompra || 0).toFixed(2)}</td>
                      <td className="small">{Number(p.precioVenta || 0).toFixed(2)}</td>
                      <td>
                        {p.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("inventario.productos.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(p)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.productos.eliminar") && (
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(p)}>
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <ModalShell title={editing ? "Editar producto" : "Nuevo producto"} onClose={() => setModalOpen(false)}>
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
                <div className="col-4">
                  <label className="form-label small fw-medium">Tipo</label>
                  <select
                    className="form-select rounded-3"
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Categoría</label>
                  <select
                    className="form-select rounded-3"
                    value={form.categoriaUuid}
                    onChange={(e) => setForm((f) => ({ ...f, categoriaUuid: e.target.value }))}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.uuid} value={c.uuid}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
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
                  id="producto-maneja-inv"
                  checked={form.manejaInventario}
                  onChange={(e) => setForm((f) => ({ ...f, manejaInventario: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="producto-maneja-inv">
                  Maneja inventario (afecta existencias/kárdex)
                </label>
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="producto-inv-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="producto-inv-estado">
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
