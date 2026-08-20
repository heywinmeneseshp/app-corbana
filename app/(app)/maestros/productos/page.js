"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiRefreshCw, FiSearch, FiEdit2, FiTrash2, FiSave, FiX, FiBox } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

export default function ProductosPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [productoModal, setProductoModal] = useState(null); // null | {} | producto
  const [syncModal, setSyncModal] = useState(false);

  async function loadProductos() {
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/productos?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      setProductos(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(producto) {
    if (!confirm(`¿Eliminar el producto "${producto.nombre}"?`)) return;
    try {
      await apiFetch(`/productos/${producto.uuid}`, { method: "DELETE" });
      loadProductos();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.maestros.productos">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiBox className="text-primary" /> Productos
          </h1>
          <p className="text-secondary mb-0">Catálogo de productos/fruta, con sus datos de empaque (peso, cajas por palet, etc.).</p>
        </div>

        <div className="d-flex flex-column flex-sm-row gap-2 mb-3">
          <div className="flex-grow-1 position-relative">
            <FiSearch className="position-absolute text-secondary" style={{ top: "0.65rem", left: "0.75rem" }} />
            <input
              type="text"
              className="form-control rounded-3 ps-5"
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadProductos()}
            />
          </div>
          {hasPermission("producto.crear") && (
            <button type="button" className="btn btn-brand rounded-3 text-nowrap d-flex align-items-center gap-1" onClick={() => setProductoModal({})}>
              <FiPlus /> Nuevo Producto
            </button>
          )}
          {hasPermission("producto.crear") && (
            <button
              type="button"
              className="btn btn-outline-secondary rounded-3 text-nowrap d-flex align-items-center gap-1"
              onClick={() => setSyncModal(true)}
            >
              <FiRefreshCw /> Sincronización con Logística
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Producto</th>
                  <th className="text-end">Peso neto (kg)</th>
                  <th className="text-end">Peso bruto (kg)</th>
                  <th className="text-end">Cajas × palet</th>
                  <th className="text-end">Cajas × minipalet</th>
                  <th className="text-end">Cant. palets</th>
                  <th className="text-end">Cant. minipalets</th>
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
                {!loading && productos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-4">
                      No hay productos registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  productos.map((p) => (
                    <tr key={p.uuid}>
                      <td>
                        <p className="fw-medium mb-0">{p.nombre}</p>
                        {p.codigo && <p className="small text-secondary mb-0">Código: {p.codigo}</p>}
                      </td>
                      <td className="text-end">{p.pesoNeto ?? "—"}</td>
                      <td className="text-end">{p.pesoBruto ?? "—"}</td>
                      <td className="text-end">{p.cajasPorPalet ?? "—"}</td>
                      <td className="text-end">{p.cajasPorMinipalet ?? "—"}</td>
                      <td className="text-end">{p.cantidadPalets ?? "—"}</td>
                      <td className="text-end">{p.cantidadMinipalets ?? "—"}</td>
                      <td>
                        {p.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("producto.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                              onClick={() => setProductoModal(p)}
                            >
                              <FiEdit2 /> Editar
                            </button>
                          )}
                          {hasPermission("producto.eliminar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                              onClick={() => handleDelete(p)}
                            >
                              <FiTrash2 /> Eliminar
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

        {productoModal && (
          <ProductoModal
            producto={productoModal.uuid ? productoModal : null}
            onClose={() => setProductoModal(null)}
            onSaved={() => {
              setProductoModal(null);
              loadProductos();
            }}
          />
        )}

        {syncModal && <SyncModal onClose={() => setSyncModal(false)} onSynced={loadProductos} />}
      </div>
    </RequirePermission>
  );
}

// ─── Modal: crear/editar producto ───
function ProductoModal({ producto, onClose, onSaved }) {
  const [nombre, setNombre] = useState(producto?.nombre || "");
  const [pesoNeto, setPesoNeto] = useState(producto?.pesoNeto ?? "");
  const [pesoBruto, setPesoBruto] = useState(producto?.pesoBruto ?? "");
  const [cajasPorPalet, setCajasPorPalet] = useState(producto?.cajasPorPalet ?? "");
  const [cajasPorMinipalet, setCajasPorMinipalet] = useState(producto?.cajasPorMinipalet ?? "");
  const [cantidadPalets, setCantidadPalets] = useState(producto?.cantidadPalets ?? "");
  const [cantidadMinipalets, setCantidadMinipalets] = useState(producto?.cantidadMinipalets ?? "");
  const [estado, setEstado] = useState(producto ? producto.estado : true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const numOrNull = (v) => (v === "" ? null : Number(v));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        nombre,
        pesoNeto: numOrNull(pesoNeto),
        pesoBruto: numOrNull(pesoBruto),
        cajasPorPalet: numOrNull(cajasPorPalet),
        cajasPorMinipalet: numOrNull(cajasPorMinipalet),
        cantidadPalets: numOrNull(cantidadPalets),
        cantidadMinipalets: numOrNull(cantidadMinipalets),
        estado,
      };
      await apiFetch(producto ? `/productos/${producto.uuid}` : "/productos", {
        method: producto ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={producto ? "Editar Producto" : "Nuevo Producto"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">Nombre</label>
          <input
            type="text"
            required
            className="form-control rounded-3"
            placeholder="Ej: Banano Premium"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label small fw-medium">Peso neto por caja (kg)</label>
            <input type="number" min={0} step="0.01" className="form-control rounded-3" value={pesoNeto} onChange={(e) => setPesoNeto(e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium">Peso bruto por caja (kg)</label>
            <input type="number" min={0} step="0.01" className="form-control rounded-3" value={pesoBruto} onChange={(e) => setPesoBruto(e.target.value)} />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label small fw-medium">Cajas por palet</label>
            <input type="number" min={0} className="form-control rounded-3" value={cajasPorPalet} onChange={(e) => setCajasPorPalet(e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium">Cajas por minipalet</label>
            <input type="number" min={0} className="form-control rounded-3" value={cajasPorMinipalet} onChange={(e) => setCajasPorMinipalet(e.target.value)} />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label small fw-medium">Cantidad de palets</label>
            <input type="number" min={0} className="form-control rounded-3" value={cantidadPalets} onChange={(e) => setCantidadPalets(e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium">Cantidad de minipalets</label>
            <input type="number" min={0} className="form-control rounded-3" value={cantidadMinipalets} onChange={(e) => setCantidadMinipalets(e.target.value)} />
          </div>
        </div>

        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="productoEstado"
            checked={estado}
            onChange={(e) => setEstado(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="productoEstado">
            Activo
          </label>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
            <FiX /> Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1">
            <FiSave /> {saving ? "Guardando..." : "Guardar Producto"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: elegir combos de Logística a sincronizar ───
function SyncModal({ onClose, onSynced }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    apiFetch("/productos/banarica-combos")
      .then((data) => {
        setItems(data.items);
        setSelected(new Set(data.items.map((i) => i.consecutivo)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (consecutivo) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(consecutivo)) next.delete(consecutivo);
      else next.add(consecutivo);
      return next;
    });
  };

  const handleSync = async () => {
    if (selected.size === 0) {
      setError("Selecciona al menos un producto.");
      return;
    }
    setError("");
    setSyncing(true);
    try {
      const resultado = await apiFetch("/productos/sync-banarica", {
        method: "POST",
        body: JSON.stringify({ consecutivos: Array.from(selected) }),
      });
      setResult(
        `Sincronización completada: ${resultado.productosCreados} producto(s) creado(s), ${resultado.productosActualizados} actualizado(s), ${resultado.productosRestaurados} restaurado(s).`,
      );
      onSynced();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ModalShell title="Elegir productos a sincronizar" onClose={onClose} size="lg">
      <p className="small text-secondary">
        Selecciona qué combos activos de Logística quieres crear/actualizar como productos. Trae nombre, peso
        neto/bruto y cajas por palet/minipalet — la cantidad de palets/minipalets queda editable a mano.
      </p>

      <div className="d-flex gap-3 mb-2 small">
        <button type="button" className="btn btn-link btn-sm text-brand p-0" onClick={() => setSelected(new Set(items.map((i) => i.consecutivo)))}>
          Seleccionar todos
        </button>
        <button type="button" className="btn btn-link btn-sm text-secondary p-0" onClick={() => setSelected(new Set())}>
          Ninguno
        </button>
      </div>

      <div className="border rounded-3 mb-3" style={{ maxHeight: "18rem", overflowY: "auto" }}>
        {loading && <p className="text-center text-secondary small py-4 mb-0">Cargando combos...</p>}
        {!loading && items.length === 0 && <p className="text-center text-secondary small py-4 mb-0">No hay combos activos en Logística.</p>}
        {!loading &&
          items.map((item) => (
            <label
              key={item.consecutivo}
              className="d-flex align-items-center gap-3 px-3 py-2 border-bottom small mb-0"
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                className="form-check-input m-0"
                checked={selected.has(item.consecutivo)}
                onChange={() => toggle(item.consecutivo)}
              />
              <span className="flex-grow-1">{item.nombre}</span>
              <span className="text-secondary small">Cód. {item.consecutivo}</span>
              {item.yaSincronizado ? (
                <span className="badge text-bg-secondary">Ya existe</span>
              ) : (
                <span className="badge" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                  Nuevo
                </span>
              )}
            </label>
          ))}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {result && <div className="alert alert-success py-2 small">{result}</div>}

      <div className="d-flex gap-2">
        <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1" onClick={onClose}>
          Cerrar
        </button>
        <button
          type="button"
          className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
          disabled={syncing || loading}
          onClick={handleSync}
        >
          <FiRefreshCw /> {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>
    </ModalShell>
  );
}
