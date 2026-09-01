"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

export default function ExistenciasPage() {
  const [items, setItems] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ almacenUuid: "", productoUuid: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
      const rows = await apiFetch(`/inventarios/movimientos/existencias?${qs}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [a, p] = await Promise.all([
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/inventarios/productos?limit=100&estado=true"),
      ]);
      setAlmacenes(a.items || []);
      setProductos(p.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    loadCombos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Existencias</h1>
          <p className="text-secondary mb-0">Saldo actual por almacén y producto (existencia en tiempo real).</p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Almacén</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.almacenUuid}
                onChange={(e) => setFiltros((f) => ({ ...f, almacenUuid: e.target.value }))}
              >
                <option value="">Todos</option>
                {almacenes.map((a) => (
                  <option key={a.uuid} value={a.uuid}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Producto</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.productoUuid}
                onChange={(e) => setFiltros((f) => ({ ...f, productoUuid: e.target.value }))}
              >
                <option value="">Todos</option>
                {productos.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={load}>
                Consultar
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Almacén</th>
                  <th>Producto</th>
                  <th className="text-end">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={3} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-secondary py-4">
                      No hay existencias para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((e, idx) => (
                    <tr key={`${e.almacen?.uuid || idx}-${e.producto?.uuid || idx}`}>
                      <td className="small text-secondary">{e.almacen?.nombre || "—"}</td>
                      <td className="fw-medium">{e.producto?.nombre || "—"}</td>
                      <td className={`text-end fw-medium ${e.saldo < 0 ? "text-danger" : ""}`}>{Number(e.saldo).toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
