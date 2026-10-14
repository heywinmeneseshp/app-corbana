"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

export default function ExistenciasPage() {
  const [items, setItems] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ almacenUuid: "", articuloUuid: "" });
  // Texto escrito en los campos con sugerencias (datalist); al coincidir exactamente con una opción se fija el filtro.
  const [textoAlmacen, setTextoAlmacen] = useState("");
  const [textoArticulo, setTextoArticulo] = useState("");

  const etiquetaAlmacen = (a) => a.nombre;
  const etiquetaArticulo = (p) => (p.codigo ? `${p.nombre} (${p.codigo})` : p.nombre);
  const unicasAlmacen = useMemo(() => new Map(almacenes.map((a) => [etiquetaAlmacen(a), a.uuid])), [almacenes]);
  const unicasArticulo = useMemo(() => new Map(articulos.map((p) => [etiquetaArticulo(p), p.uuid])), [articulos]);

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
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
      ]);
      setAlmacenes(a.items || []);
      setArticulos(p.items || []);
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
          <p className="text-secondary mb-0">Saldo actual por almacén y artículo (existencia en tiempo real).</p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Almacén</label>
              <input
                list="existencias-almacenes"
                className="form-control form-control-sm rounded-3"
                style={{ minWidth: 220 }}
                placeholder="Todos"
                value={textoAlmacen}
                onChange={(e) => {
                  setTextoAlmacen(e.target.value);
                  setFiltros((f) => ({ ...f, almacenUuid: unicasAlmacen.get(e.target.value) || "" }));
                }}
              />
              <datalist id="existencias-almacenes">
                {almacenes.map((a) => (
                  <option key={a.uuid} value={etiquetaAlmacen(a)} />
                ))}
              </datalist>
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Artículo</label>
              <input
                list="existencias-articulos"
                className="form-control form-control-sm rounded-3"
                style={{ minWidth: 260 }}
                placeholder="Todos"
                value={textoArticulo}
                onChange={(e) => {
                  setTextoArticulo(e.target.value);
                  setFiltros((f) => ({ ...f, articuloUuid: unicasArticulo.get(e.target.value) || "" }));
                }}
              />
              <datalist id="existencias-articulos">
                {articulos.map((p) => (
                  <option key={p.uuid} value={etiquetaArticulo(p)} />
                ))}
              </datalist>
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
                  <th>Artículo</th>
                  <th className="text-end">Saldo</th>
                  <th>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      No hay existencias para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((e, idx) => (
                    <tr key={`${e.almacen?.uuid || idx}-${e.articulo?.uuid || idx}`}>
                      <td className="small text-secondary">{e.almacen?.nombre || "—"}</td>
                      <td className="fw-medium">{e.articulo?.nombre || "—"}</td>
                      <td className={`text-end fw-medium ${e.saldo < 0 ? "text-danger" : ""}`}>{Number(e.saldo).toFixed(2)}</td>
                      <td className="small text-secondary">{e.unidad ? `${e.unidad.simbolo} · ${e.unidad.nombre}` : "—"}</td>
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
