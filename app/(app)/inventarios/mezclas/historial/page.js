"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiEye } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { estadoPruebaInfo, ESTADO_PRUEBA_INFO } from "@/lib/mezclaEstados";
import RequirePermission from "@/components/RequirePermission";

export default function HistorialMezclasPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

  const [usuarios, setUsuarios] = useState([]);
  const [articulosElaborados, setArticulosElaborados] = useState([]);
  const [articulosComponente, setArticulosComponente] = useState([]);

  const [filtros, setFiltros] = useState({
    estadoPrueba: "",
    operadorUuid: "",
    fechaDesde: "",
    fechaHasta: "",
    articuloElaboradoUuid: "",
    articuloComponenteUuid: "",
  });

  async function loadCombos() {
    try {
      const [u, elaborados, todos] = await Promise.all([
        apiFetch("/users?limit=100"),
        apiFetch("/inventarios/articulos?limit=100&tipo=ELABORADO&estado=true"),
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
      ]);
      setUsuarios(u.items || []);
      setArticulosElaborados(elaborados.items || []);
      setArticulosComponente(todos.items || []);
    } catch {
      // combos no bloquean la carga del historial
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "50" });
      Object.entries(filtros).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      const { items: rows, meta: m } = await apiFetch(`/inventarios/mezclas/historial?${qs}`);
      setItems(rows);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function aplicarFiltros() {
    if (page === 1) load();
    else setPage(1);
  }

  function limpiarFiltros() {
    setFiltros({ estadoPrueba: "", operadorUuid: "", fechaDesde: "", fechaHasta: "", articuloElaboradoUuid: "", articuloComponenteUuid: "" });
    setPage(1);
    setTimeout(load, 0);
  }

  return (
    <RequirePermission code="menu.inventarios.mezclas">
      <div className="p-4 p-md-5">
        <button
          type="button"
          className="btn btn-sm btn-link p-0 mb-3 text-secondary d-inline-flex align-items-center gap-1"
          onClick={() => router.push("/inventarios/mezclas")}
        >
          <FiArrowLeft /> Volver a Mezclas
        </button>

        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Historial de pruebas de mezcla</h1>
          <p className="text-secondary mb-0">Todas las pruebas realizadas, con su resultado y trazabilidad completa.</p>
        </div>

        <div className="card border-0 rounded-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-6 col-md-2">
                <label className="form-label small mb-1">Estado</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.estadoPrueba}
                  onChange={(e) => setFiltros((f) => ({ ...f, estadoPrueba: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {Object.entries(ESTADO_PRUEBA_INFO).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small mb-1">Operador</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.operadorUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, operadorUuid: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.uuid} value={u.uuid}>
                      {u.nombre || u.usuario}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small mb-1">Desde</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={filtros.fechaDesde}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
                />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small mb-1">Hasta</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={filtros.fechaHasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
                />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small mb-1">Producto elaborado</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.articuloElaboradoUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, articuloElaboradoUuid: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {articulosElaborados.map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small mb-1">Componente usado</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.articuloComponenteUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, articuloComponenteUuid: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {articulosComponente.map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={aplicarFiltros}>
                Filtrar
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={limpiarFiltros}>
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium">Fecha</th>
                  <th className="fw-medium">Prueba</th>
                  <th className="fw-medium">Producto objetivo</th>
                  <th className="fw-medium">Operador</th>
                  <th className="fw-medium">Estado</th>
                  <th className="fw-medium">pH / CE final</th>
                  <th className="fw-medium">Elaborado generado</th>
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-3 small">
                      No hay pruebas que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((v) => {
                    const info = estadoPruebaInfo(v.estadoPrueba);
                    return (
                      <tr key={v.uuid} style={{ cursor: "pointer" }} onClick={() => router.push(`/inventarios/mezclas/${v.mezcla?.uuid}`)}>
                        <td className="small text-secondary">
                          {v.created_at ? new Date(v.created_at).toLocaleDateString("es-CO", { timeZone: "America/Bogota" }) : "—"}
                        </td>
                        <td className="small fw-medium">{v.mezcla?.nombre}</td>
                        <td className="small text-secondary">{v.mezcla?.articuloElaborado?.nombre || "—"}</td>
                        <td className="small text-secondary">{v.operador ? v.operador.nombre || v.operador.usuario : "—"}</td>
                        <td className="small">
                          <span className="badge rounded-pill small" style={{ backgroundColor: info.bg, color: info.color }}>
                            {info.label}
                          </span>
                        </td>
                        <td className="small text-secondary">
                          {v.phFinal ?? "—"} / {v.ceFinal ?? "—"}
                        </td>
                        <td className="small text-secondary">{v.elaboracionGenerada?.documento || "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="d-flex justify-content-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Ver prueba"
                              onClick={() => router.push(`/inventarios/mezclas/${v.mezcla?.uuid}`)}
                            >
                              <FiEye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
          <span className="small text-secondary">
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} prueba(s))
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
      </div>
    </RequirePermission>
  );
}
