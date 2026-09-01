"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

export default function KardexPage() {
  const [items, setItems] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ articuloUuid: "", almacenUuid: "", fechaDesde: "", fechaHasta: "" });

  async function load() {
    if (!filtros.articuloUuid) {
      setError("Seleccioná un artículo para ver su kárdex.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
      const rows = await apiFetch(`/inventarios/movimientos/kardex?${qs}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [p, a] = await Promise.all([
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
      ]);
      setArticulos(p.items || []);
      setAlmacenes(a.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Kárdex</h1>
          <p className="text-secondary mb-0">Historial de movimientos de un artículo con saldo acumulado.</p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">
                Artículo <span className="text-danger">*</span>
              </label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.articuloUuid}
                onChange={(e) => setFiltros((f) => ({ ...f, articuloUuid: e.target.value }))}
              >
                <option value="">Seleccionar...</option>
                {articulos.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
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
              <label className="form-label small fw-medium mb-1">Desde</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-3"
                value={filtros.fechaDesde}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
              />
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Hasta</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-3"
                value={filtros.fechaHasta}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
              />
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
                  <th>Fecha</th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th className="text-end">Entrada</th>
                  <th className="text-end">Salida</th>
                  <th className="text-end">Saldo</th>
                  <th className="text-end">Costo unit.</th>
                  <th className="text-end">Costo total</th>
                  <th>Almacén</th>
                  <th>Lote</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={12} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center text-secondary py-4">
                      {filtros.articuloUuid ? "Sin movimientos para los filtros seleccionados." : "Seleccioná un artículo para ver su kárdex."}
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((m, idx) => (
                    <tr key={idx}>
                      <td className="small text-secondary">{new Date(m.fecha).toLocaleDateString()}</td>
                      <td className="fw-medium">{m.documento}</td>
                      <td className="small text-secondary">{m.tipo}</td>
                      <td className="text-end small text-success">{m.entrada ? Number(m.entrada).toFixed(2) : "—"}</td>
                      <td className="text-end small text-danger">{m.salida ? Number(m.salida).toFixed(2) : "—"}</td>
                      <td className={`text-end fw-medium ${m.saldo < 0 ? "text-danger" : ""}`}>{Number(m.saldo).toFixed(2)}</td>
                      <td className="text-end small">{Number(m.costoUnitario || 0).toFixed(2)}</td>
                      <td className="text-end small">{Number(m.costoTotal || 0).toFixed(2)}</td>
                      <td className="small text-secondary">{m.almacen?.nombre || "—"}</td>
                      <td className="small text-secondary">{m.lote || "—"}</td>
                      <td className="small text-secondary">{m.motivo?.nombre || "—"}</td>
                      <td className="small text-secondary">{m.usuario?.usuario || "—"}</td>
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
