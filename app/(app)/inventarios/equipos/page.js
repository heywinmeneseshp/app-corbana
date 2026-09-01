"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiTool } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const ESTADOS = ["OPERATIVO", "MANTENIMIENTO", "FUERA_SERVICIO", "INACTIVO", "DE_BAJA"];

const ESTADO_BADGE = {
  OPERATIVO: "success",
  MANTENIMIENTO: "warning",
  FUERA_SERVICIO: "danger",
  INACTIVO: "secondary",
  DE_BAJA: "dark",
};

function emptyForm() {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    tipoUuid: "",
    marca: "",
    modelo: "",
    serie: "",
    fechaAdquisicion: "",
    ubicacionUuid: "",
    centroCostoUuid: "",
    estado: "OPERATIVO",
    horometro: "0",
    kilometraje: "0",
    responsableUuid: "",
    observaciones: "",
  };
}

export default function EquiposInventarioPage() {
  const [items, setItems] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [tipoModalOpen, setTipoModalOpen] = useState(false);

  const [repuestosEquipo, setRepuestosEquipo] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100", ...(search ? { search } : {}) });
      const { items: rows } = await apiFetch(`/inventarios/equipos?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [a, u, t] = await Promise.all([
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/users?limit=100"),
        apiFetch("/inventarios/equipos-tipos?limit=100&estado=true"),
      ]);
      setAlmacenes(a.items || []);
      setUsuarios(u.items || []);
      setTipos(t.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  // Se llama sola después de crear un tipo nuevo desde el modal — recarga
  // el combo y lo deja ya seleccionado en el formulario de equipo.
  async function loadTipos(seleccionarUuid) {
    try {
      const t = await apiFetch("/inventarios/equipos-tipos?limit=100&estado=true");
      setTipos(t.items || []);
      if (seleccionarUuid) setForm((f) => ({ ...f, tipoUuid: seleccionarUuid }));
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

  function openEdit(equipo) {
    setEditing(equipo);
    setForm({
      codigo: equipo.codigo,
      nombre: equipo.nombre,
      descripcion: equipo.descripcion || "",
      tipoUuid: equipo.tipo?.uuid || "",
      marca: equipo.marca || "",
      modelo: equipo.modelo || "",
      serie: equipo.serie || "",
      fechaAdquisicion: equipo.fechaAdquisicion || "",
      ubicacionUuid: equipo.ubicacion?.uuid || "",
      centroCostoUuid: equipo.centroCosto?.uuid || "",
      estado: equipo.estado,
      horometro: String(equipo.horometro ?? 0),
      kilometraje: String(equipo.kilometraje ?? 0),
      responsableUuid: equipo.responsable?.uuid || "",
      observaciones: equipo.observaciones || "",
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
        descripcion: form.descripcion || null,
        marca: form.marca || null,
        modelo: form.modelo || null,
        serie: form.serie || null,
        fechaAdquisicion: form.fechaAdquisicion || null,
        ubicacionUuid: form.ubicacionUuid || null,
        centroCostoUuid: form.centroCostoUuid || null,
        responsableUuid: form.responsableUuid || null,
        observaciones: form.observaciones || null,
        horometro: Number(form.horometro),
        kilometraje: Number(form.kilometraje),
      };
      if (editing) {
        await apiFetch(`/inventarios/equipos/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/inventarios/equipos", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(equipo) {
    if (!confirm(`¿Eliminar el equipo "${equipo.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/equipos/${equipo.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openRepuestos(equipo) {
    setRepuestosEquipo({ uuid: equipo.uuid, nombre: equipo.nombre, componentes: [], loading: true, error: "" });
    try {
      const detalle = await apiFetch(`/inventarios/equipos/${equipo.uuid}`);
      setRepuestosEquipo({ uuid: equipo.uuid, nombre: equipo.nombre, componentes: detalle.componentes || [], loading: false, error: "" });
    } catch (err) {
      setRepuestosEquipo({ uuid: equipo.uuid, nombre: equipo.nombre, componentes: [], loading: false, error: err.message });
    }
  }

  return (
    <RequirePermission code="menu.inventarios.equipos">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Equipos</h1>
            <p className="text-secondary mb-0">Tractores, vehículos, maquinaria y bombas — con repuestos compatibles.</p>
          </div>
          {hasPermission("inventario.equipos.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nuevo equipo
            </button>
          )}
        </div>

        <div className="mb-3">
          <input
            type="text"
            className="form-control rounded-3"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por código, nombre o marca..."
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
                  <th>Marca / Modelo</th>
                  <th>Ubicación</th>
                  <th>Horómetro</th>
                  <th>Km</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-secondary py-4">
                      No hay equipos registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((eq) => (
                    <tr key={eq.uuid}>
                      <td className="fw-medium">{eq.codigo}</td>
                      <td>{eq.nombre}</td>
                      <td className="small text-secondary">{eq.tipo?.nombre || "—"}</td>
                      <td className="small text-secondary">{[eq.marca, eq.modelo].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="small text-secondary">{eq.ubicacion?.nombre || "—"}</td>
                      <td className="small">{Number(eq.horometro || 0).toFixed(2)}</td>
                      <td className="small">{Number(eq.kilometraje || 0).toFixed(2)}</td>
                      <td className="small text-secondary">{eq.responsable?.nombre || "—"}</td>
                      <td>
                        <span className={`badge rounded-pill text-bg-${ESTADO_BADGE[eq.estado] || "secondary"}`}>{eq.estado}</span>
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          <button type="button" className="btn btn-sm btn-outline-secondary" title="Repuestos compatibles" onClick={() => openRepuestos(eq)}>
                            <FiTool />
                          </button>
                          {hasPermission("inventario.equipos.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(eq)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.equipos.eliminar") && (
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(eq)}>
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
          <ModalShell title={editing ? "Editar equipo" : "Nuevo equipo"} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    Código <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    required
                    maxLength={50}
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
                    value={form.tipoUuid}
                    onChange={(e) => setForm((f) => ({ ...f, tipoUuid: e.target.value }))}
                  >
                    <option value="">Otro (por defecto)</option>
                    {tipos.map((t) => (
                      <option key={t.uuid} value={t.uuid}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 mt-1"
                    onClick={() => setTipoModalOpen(true)}
                  >
                    + Crear tipo
                  </button>
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Marca</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={100}
                    value={form.marca}
                    onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Modelo</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={100}
                    value={form.modelo}
                    onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">Serie</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={100}
                    value={form.serie}
                    onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Fecha de adquisición</label>
                  <input
                    type="date"
                    className="form-control rounded-3"
                    value={form.fechaAdquisicion}
                    onChange={(e) => setForm((f) => ({ ...f, fechaAdquisicion: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Estado</label>
                  <select className="form-select rounded-3" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Ubicación</label>
                  <select
                    className="form-select rounded-3"
                    value={form.ubicacionUuid}
                    onChange={(e) => setForm((f) => ({ ...f, ubicacionUuid: e.target.value }))}
                  >
                    <option value="">Sin ubicación</option>
                    {almacenes.map((a) => (
                      <option key={a.uuid} value={a.uuid}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Centro de costo</label>
                  <select
                    className="form-select rounded-3"
                    value={form.centroCostoUuid}
                    onChange={(e) => setForm((f) => ({ ...f, centroCostoUuid: e.target.value }))}
                  >
                    <option value="">Sin centro de costo</option>
                    {almacenes.map((a) => (
                      <option key={a.uuid} value={a.uuid}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">Horómetro</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={form.horometro}
                    onChange={(e) => setForm((f) => ({ ...f, horometro: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Kilometraje</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={form.kilometraje}
                    onChange={(e) => setForm((f) => ({ ...f, kilometraje: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Responsable</label>
                  <select
                    className="form-select rounded-3"
                    value={form.responsableUuid}
                    onChange={(e) => setForm((f) => ({ ...f, responsableUuid: e.target.value }))}
                  >
                    <option value="">Sin responsable</option>
                    {usuarios.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.nombre} {u.apellido}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Observaciones</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={1000}
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
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

        {repuestosEquipo && (
          <RepuestosModal
            equipo={repuestosEquipo}
            onClose={() => setRepuestosEquipo(null)}
            onChanged={() => openRepuestos({ uuid: repuestosEquipo.uuid, nombre: repuestosEquipo.nombre })}
          />
        )}

        {tipoModalOpen && (
          <TipoModal
            onClose={() => setTipoModalOpen(false)}
            onCreated={(nuevoUuid) => {
              setTipoModalOpen(false);
              loadTipos(nuevoUuid);
            }}
          />
        )}
      </div>
    </RequirePermission>
  );
}

// Creación rápida de un tipo de equipo — antes era un ENUM fijo en código,
// ahora es un catálogo editable (equipo_tipos) y se puede agregar uno sin
// salir del formulario de Equipo.
function TipoModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const creado = await apiFetch("/inventarios/equipos-tipos", { method: "POST", body: JSON.stringify({ nombre }) });
      onCreated(creado.uuid);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Nuevo tipo de equipo" onClose={onClose}>
      <form onSubmit={handleSave}>
        <div className="mb-3">
          <label className="form-label small fw-medium">
            Nombre <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="form-control rounded-3"
            required
            autoFocus
            maxLength={100}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-brand rounded-3" disabled={saving || !nombre.trim()}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// Repuestos compatibles de un equipo (M2M contra artículos tipo REPUESTO) —
// se maneja aparte porque el listado principal no trae `componentes`, solo
// el detalle por uuid (ver equipo.repository.js DETAIL_INCLUDE).
function RepuestosModal({ equipo, onClose, onChanged }) {
  const [repuestos, setRepuestos] = useState([]);
  const [articuloUuid, setArticuloUuid] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/inventarios/articulos?limit=100&estado=true&tipo=REPUESTO")
      .then((data) => setRepuestos(data.items || []))
      .catch((err) => setError(err.message));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(`/inventarios/equipos/${equipo.uuid}/componentes`, {
        method: "POST",
        body: JSON.stringify({ articuloUuid, notas: notas || null }),
      });
      setArticuloUuid("");
      setNotas("");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(articulo) {
    if (!confirm(`¿Quitar "${articulo.nombre}" de los repuestos compatibles?`)) return;
    try {
      await apiFetch(`/inventarios/equipos/${equipo.uuid}/componentes/${articulo.uuid}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ModalShell title={`Repuestos compatibles — ${equipo.nombre}`} onClose={onClose}>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <form className="row g-2 align-items-end mb-3" onSubmit={handleAdd}>
        <div className="col-auto">
          <label className="form-label small fw-medium mb-1">Repuesto</label>
          <select
            className="form-select form-select-sm rounded-3"
            required
            value={articuloUuid}
            onChange={(e) => setArticuloUuid(e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {repuestos.map((p) => (
              <option key={p.uuid} value={p.uuid}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-auto">
          <label className="form-label small fw-medium mb-1">Notas</label>
          <input
            type="text"
            className="form-control form-control-sm rounded-3"
            style={{ width: 180 }}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving || !articuloUuid}>
            {saving ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Repuesto</th>
              <th>Código</th>
              <th>Notas</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {equipo.loading && (
              <tr>
                <td colSpan={4} className="text-center text-secondary py-3">
                  Cargando...
                </td>
              </tr>
            )}
            {!equipo.loading && equipo.componentes.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-secondary py-3">
                  Sin repuestos compatibles registrados.
                </td>
              </tr>
            )}
            {!equipo.loading &&
              equipo.componentes.map((c) => (
                <tr key={c.articulo?.uuid}>
                  <td className="small">{c.articulo?.nombre}</td>
                  <td className="small text-secondary">{c.articulo?.codigo || "—"}</td>
                  <td className="small text-secondary">{c.notas || "—"}</td>
                  <td>
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-sm btn-outline-danger" title="Quitar" onClick={() => handleRemove(c.articulo)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}
