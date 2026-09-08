"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiClock, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyComponente() {
  return { articuloUuid: "", cantidad: "1", unidadUuid: "" };
}

function emptyForm() {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    articuloElaboradoUuid: "",
    unidadRendimientoUuid: "",
    rendimiento: "1",
    precioVenta: "0",
    estado: true,
    componentes: [emptyComponente()],
  };
}

export default function MezclasPage() {
  const [items, setItems] = useState([]);
  const [articulosElaborados, setArticulosElaborados] = useState([]);
  const [articulos, setArticulos] = useState([]);
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
  const [formAdvertencias, setFormAdvertencias] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialMezcla, setHistorialMezcla] = useState(null);
  const [historialLoading, setHistorialLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "100", ...(search ? { search } : {}) });
      const { items: rows, meta: m } = await apiFetch(`/inventarios/mezclas?${qs}`);
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
      const [elaborados, todos, uni] = await Promise.all([
        apiFetch("/inventarios/articulos?limit=100&tipo=ELABORADO&estado=true"),
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
      ]);
      setArticulosElaborados(elaborados.items || []);
      setArticulos(todos.items || []);
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
    setFormAdvertencias([]);
    setModalOpen(true);
  }

  async function openEdit(mezcla) {
    setEditing(mezcla);
    setFormError("");
    setFormAdvertencias([]);
    setModalOpen(true);
    setCargandoDetalle(true);
    try {
      const detalle = await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`);
      const activa = (detalle.versiones || []).find((v) => v.activa) || detalle.versiones?.[0];
      setForm({
        codigo: detalle.codigo || "",
        nombre: detalle.nombre,
        descripcion: detalle.descripcion || "",
        articuloElaboradoUuid: detalle.articuloElaborado?.uuid || "",
        unidadRendimientoUuid: detalle.unidadRendimiento?.uuid || "",
        rendimiento: String(detalle.rendimiento ?? 1),
        precioVenta: String(detalle.precioVenta ?? 0),
        estado: detalle.estado,
        componentes:
          activa?.componentes?.length > 0
            ? activa.componentes.map((c) => ({
                articuloUuid: c.articulo?.uuid || "",
                cantidad: String(c.cantidad ?? 1),
                unidadUuid: c.unidad?.uuid || "",
              }))
            : [emptyComponente()],
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCargandoDetalle(false);
    }
  }

  function updateComponente(idx, field, value) {
    setForm((f) => {
      const componentes = [...f.componentes];
      componentes[idx] = { ...componentes[idx], [field]: value };
      return { ...f, componentes };
    });
  }

  function addComponente() {
    setForm((f) => ({ ...f, componentes: [...f.componentes, emptyComponente()] }));
  }

  function removeComponente(idx) {
    setForm((f) => ({ ...f, componentes: f.componentes.filter((_, i) => i !== idx) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setFormAdvertencias([]);

    const componentesValidos = form.componentes.filter((c) => c.articuloUuid && c.cantidad);
    if (componentesValidos.length === 0) {
      setFormError("Agrega al menos un componente con artículo y cantidad.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        codigo: form.codigo || null,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        articuloElaboradoUuid: form.articuloElaboradoUuid,
        unidadRendimientoUuid: form.unidadRendimientoUuid || null,
        rendimiento: Number(form.rendimiento),
        precioVenta: Number(form.precioVenta),
        estado: form.estado,
        componentes: componentesValidos.map((c) => ({
          articuloUuid: c.articuloUuid,
          cantidad: Number(c.cantidad),
          unidadUuid: c.unidadUuid || null,
        })),
      };
      let resultado;
      if (editing) {
        resultado = await apiFetch(`/inventarios/mezclas/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        resultado = await apiFetch("/inventarios/mezclas", { method: "POST", body: JSON.stringify(body) });
      }
      if (resultado?.advertencias?.length) {
        setFormAdvertencias(resultado.advertencias);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mezcla) {
    if (!confirm(`¿Eliminar la mezcla "${mezcla.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openHistorial(mezcla) {
    setHistorialOpen(true);
    setHistorialLoading(true);
    setHistorialMezcla({ nombre: mezcla.nombre, versiones: [] });
    try {
      const detalle = await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`);
      setHistorialMezcla(detalle);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistorialLoading(false);
    }
  }

  const costoUnitarioActivo = (m) => {
    const activa = (m.versiones || [])[0];
    return activa ? Number(activa.costoUnitario) : null;
  };

  return (
    <RequirePermission code="menu.inventarios.mezclas">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Mezclas</h1>
            <p className="text-secondary mb-0">
              Recetas de artículos elaborados: componentes, costo total/unitario y precio de venta, con historial de
              versiones cada vez que cambian los componentes o el rendimiento.
            </p>
          </div>
          {hasPermission("inventario.mezclas.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nueva mezcla
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
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="small text-secondary" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th className="fw-medium">Código</th>
                  <th className="fw-medium">Nombre</th>
                  <th className="fw-medium">Artículo elaborado</th>
                  <th className="fw-medium">Rendimiento</th>
                  <th className="fw-medium">Costo unitario</th>
                  <th className="fw-medium">Precio venta</th>
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-3 small">
                      No hay mezclas registradas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((m) => {
                    const costoUnitario = costoUnitarioActivo(m);
                    const precio = Number(m.precioVenta || 0);
                    const bajoCosto = costoUnitario !== null && precio > 0 && precio < costoUnitario;
                    return (
                      <tr key={m.uuid}>
                        <td className="small text-secondary">{m.codigo || "—"}</td>
                        <td className="small fw-medium">{m.nombre}</td>
                        <td className="small text-secondary">{m.articuloElaborado?.nombre || "—"}</td>
                        <td className="small text-secondary">
                          {Number(m.rendimiento).toFixed(2)} {m.unidadRendimiento?.simbolo || ""}
                        </td>
                        <td className="small">
                          {costoUnitario !== null ? costoUnitario.toFixed(2) : "—"}
                        </td>
                        <td className="small">
                          <span className={bajoCosto ? "text-danger fw-medium" : ""}>{precio.toFixed(2)}</span>
                        </td>
                        <td>
                          <div className="d-flex justify-content-end gap-1 flex-nowrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Historial de versiones"
                              onClick={() => openHistorial(m)}
                            >
                              <FiClock size={15} />
                            </button>
                            {hasPermission("inventario.mezclas.editar") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                                title="Editar"
                                onClick={() => openEdit(m)}
                              >
                                <FiEdit2 size={15} />
                              </button>
                            )}
                            {hasPermission("inventario.mezclas.eliminar") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex"
                                style={{ color: "#dc2626" }}
                                title="Eliminar"
                                onClick={() => handleDelete(m)}
                              >
                                <FiTrash2 size={15} />
                              </button>
                            )}
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
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} mezcla(s))
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

        {modalOpen && (
          <ModalShell title={editing ? "Editar mezcla" : "Nueva mezcla"} onClose={() => setModalOpen(false)} size="xl">
            {cargandoDetalle ? (
              <div className="text-center text-secondary py-4 small">Cargando...</div>
            ) : (
              <form onSubmit={handleSave}>
                {editing && (
                  <div className="alert alert-info py-2 small">
                    Si cambias los componentes o el rendimiento, se crea una <strong>versión nueva</strong> (con su
                    propio costo) — la versión anterior queda en el historial, no se pierde.
                  </div>
                )}

                <div className="row g-3 mb-3">
                  <div className="col-3">
                    <label className="form-label small fw-medium">Código</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      maxLength={50}
                      value={form.codigo}
                      onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    />
                  </div>
                  <div className="col-9">
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
                    <label className="form-label small fw-medium">
                      Artículo elaborado <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select rounded-3"
                      required
                      value={form.articuloElaboradoUuid}
                      onChange={(e) => setForm((f) => ({ ...f, articuloElaboradoUuid: e.target.value }))}
                    >
                      <option value="">Selecciona...</option>
                      {articulosElaborados.map((a) => (
                        <option key={a.uuid} value={a.uuid}>
                          {a.codigo ? `${a.codigo} — ${a.nombre}` : a.nombre}
                        </option>
                      ))}
                    </select>
                    <p className="form-text small mb-0">
                      Solo artículos de categoría tipo <strong>Elaborado</strong> — es lo que produce esta receta.
                    </p>
                  </div>
                  <div className="col-3">
                    <label className="form-label small fw-medium">
                      Rendimiento <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control rounded-3"
                      required
                      value={form.rendimiento}
                      onChange={(e) => setForm((f) => ({ ...f, rendimiento: e.target.value }))}
                    />
                  </div>
                  <div className="col-3">
                    <label className="form-label small fw-medium">Unidad</label>
                    <select
                      className="form-select rounded-3"
                      value={form.unidadRendimientoUuid}
                      onChange={(e) => setForm((f) => ({ ...f, unidadRendimientoUuid: e.target.value }))}
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
                  <div className="col-4">
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
                  <div className="col-4 d-flex align-items-end">
                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="mezcla-estado"
                        checked={form.estado}
                        onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                      />
                      <label className="form-check-label small" htmlFor="mezcla-estado">
                        Activa
                      </label>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="form-label small fw-medium mb-0">
                    Componentes <span className="text-danger">*</span>
                  </label>
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1" onClick={addComponente}>
                    <FiPlus size={14} /> Agregar componente
                  </button>
                </div>
                <div className="table-responsive mb-3">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="small text-secondary">
                        <th style={{ minWidth: "14rem" }}>Artículo</th>
                        <th style={{ width: "8rem" }}>Cantidad</th>
                        <th style={{ minWidth: "10rem" }}>Unidad</th>
                        <th style={{ width: "8rem" }}>Costo unit.</th>
                        <th style={{ width: "2.5rem" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {form.componentes.map((c, idx) => {
                        const articuloSel = articulos.find((a) => a.uuid === c.articuloUuid);
                        return (
                          <tr key={idx}>
                            <td>
                              <select
                                className="form-select form-select-sm rounded-3"
                                value={c.articuloUuid}
                                onChange={(e) => updateComponente(idx, "articuloUuid", e.target.value)}
                              >
                                <option value="">Selecciona...</option>
                                {articulos.map((a) => (
                                  <option key={a.uuid} value={a.uuid}>
                                    {a.codigo ? `${a.codigo} — ${a.nombre}` : a.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-control form-control-sm rounded-3"
                                value={c.cantidad}
                                onChange={(e) => updateComponente(idx, "cantidad", e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm rounded-3"
                                value={c.unidadUuid}
                                onChange={(e) => updateComponente(idx, "unidadUuid", e.target.value)}
                              >
                                <option value="">Sin unidad</option>
                                {unidades.map((u) => (
                                  <option key={u.uuid} value={u.uuid}>
                                    {u.simbolo}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="small text-secondary">
                              {articuloSel ? Number(articuloSel.costoCompra || 0).toFixed(2) : "—"}
                            </td>
                            <td>
                              {form.componentes.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-1 d-inline-flex text-danger"
                                  title="Quitar"
                                  onClick={() => removeComponente(idx)}
                                >
                                  <FiX size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {formAdvertencias.length > 0 && (
                  <div className="alert alert-warning py-2 small">
                    {formAdvertencias.map((a, i) => (
                      <p key={i} className="mb-0">
                        {a}
                      </p>
                    ))}
                  </div>
                )}
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
            )}
          </ModalShell>
        )}

        {historialOpen && (
          <ModalShell
            title={`Historial de versiones — ${historialMezcla?.nombre || ""}`}
            onClose={() => setHistorialOpen(false)}
            size="xl"
          >
            {historialLoading ? (
              <div className="text-center text-secondary py-4 small">Cargando...</div>
            ) : (historialMezcla?.versiones || []).length === 0 ? (
              <p className="text-secondary small mb-0">Esta mezcla no tiene versiones registradas.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {historialMezcla.versiones.map((v) => (
                  <div key={v.uuid} className="card border-0 rounded-3 p-3" style={{ backgroundColor: v.activa ? "#f0fdf4" : "#f8f9fa" }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-medium small">
                        Versión {v.version}{" "}
                        {v.activa && (
                          <span className="badge rounded-pill small ms-1" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activa
                          </span>
                        )}
                      </span>
                      <span className="small text-secondary">
                        Costo total: <strong>{Number(v.costoTotal).toFixed(2)}</strong> — Costo unitario:{" "}
                        <strong>{Number(v.costoUnitario).toFixed(2)}</strong>
                      </span>
                    </div>
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr className="small text-secondary">
                          <th>Artículo</th>
                          <th>Cantidad</th>
                          <th>Costo unit. (snapshot)</th>
                          <th>Costo total (snapshot)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(v.componentes || []).map((c) => (
                          <tr key={c.uuid}>
                            <td className="small">{c.articulo?.nombre || "—"}</td>
                            <td className="small">
                              {Number(c.cantidad).toFixed(2)} {c.unidad?.simbolo || ""}
                            </td>
                            <td className="small">{Number(c.costoUnitarioSnapshot).toFixed(2)}</td>
                            <td className="small">{Number(c.costoTotalSnapshot).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
            <div className="d-flex justify-content-end mt-3">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setHistorialOpen(false)}>
                Cerrar
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
