"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiX } from "react-icons/fi";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import { TIPOS_MANTENIMIENTO, PRIORIDADES, ESTADOS_ORDEN, Insignia, TextoPrioridad, etiqueta, formatoFecha, hoyIso, dinero } from "@/lib/mantenimiento";

const clave = () => Math.random().toString(36).slice(2);
const vacio = () => ({
  equipoUuid: "",
  planUuid: "",
  programacionUuid: "",
  tipo: "PREVENTIVO",
  descripcion: "",
  fecha: hoyIso(),
  responsableUuid: "",
  almacenUuid: "",
  estado: "ABIERTA",
  prioridad: "MEDIA",
  observaciones: "",
  detalles: [],
  manoObra: [],
  servicios: [],
});
const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

// Órdenes de trabajo de mantenimiento: repuestos (salen del inventario al cerrar), mano de obra y servicios externos. Al cerrar, la
// programación de origen queda completada y, si el plan es por días/meses, se agenda la siguiente.
export default function OrdenesMantenimientoPage() {
  const [items, setItems] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filtros, setFiltros] = useState({ equipoUuid: "", estado: "", tipo: "", search: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [cierre, setCierre] = useState(null); // { orden, almacenUuid, observaciones }

  async function load(f = filtros) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100" });
      Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
      const { items: rows } = await apiFetchTodos(`/inventarios/ordenes-mantenimiento?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      apiFetchTodos("/inventarios/equipos?limit=100"),
      apiFetchTodos("/inventarios/planes-mantenimiento?limit=100&estado=true"),
      apiFetch("/users?limit=100").catch(() => ({ items: [] })),
      apiFetch("/inventarios/almacenes?limit=100&estado=true"),
      // Los repuestos primero; el resto del catálogo también se puede usar en una orden.
      apiFetchTodos("/inventarios/articulos?limit=100&estado=true"),
      apiFetch("/inventarios/proveedores?limit=100").catch(() => ({ items: [] })),
    ])
      .then(([e, p, u, a, art, prov]) => {
        setEquipos(e.items || []);
        setPlanes(p.items || []);
        setUsuarios(u.items || []);
        setAlmacenes(a.items || []);
        setRepuestos([...(art.items || [])].sort((x, y) => (x.categoria?.tipo === "REPUESTO" ? 0 : 1) - (y.categoria?.tipo === "REPUESTO" ? 0 : 1) || x.nombre.localeCompare(y.nombre)));
        setProveedores(prov.items || []);
        // Desde Programaciones: ?nueva=1&programacionUuid=...&equipoUuid=...&planUuid=... abre la orden ya llena.
        const params = new URLSearchParams(window.location.search);
        if (params.get("nueva")) {
          const plan = (p.items || []).find((x) => x.uuid === params.get("planUuid"));
          setModal({
            editing: null,
            form: {
              ...vacio(),
              equipoUuid: params.get("equipoUuid") || "",
              planUuid: params.get("planUuid") || "",
              programacionUuid: params.get("programacionUuid") || "",
              tipo: plan?.tipo || "PREVENTIVO",
              descripcion: plan?.nombre || "",
              almacenUuid: (a.items || []).length === 1 ? a.items[0].uuid : "",
            },
          });
        }
      })
      .catch((err) => setError(err.message));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarFiltro(patch) {
    const f = { ...filtros, ...patch };
    setFiltros(f);
    load(f);
  }

  async function abrir(orden) {
    setFormError("");
    if (!orden) {
      setModal({ editing: null, form: { ...vacio(), almacenUuid: almacenes.length === 1 ? almacenes[0].uuid : "" } });
      return;
    }
    try {
      const o = await apiFetch(`/inventarios/ordenes-mantenimiento/${orden.uuid}`);
      setModal({
        editing: o,
        form: {
          equipoUuid: o.equipo?.uuid || "",
          planUuid: o.plan?.uuid || "",
          programacionUuid: o.programacion?.uuid || "",
          tipo: o.tipo,
          descripcion: o.descripcion || "",
          fecha: String(o.fecha).slice(0, 10),
          responsableUuid: o.responsable?.uuid || "",
          almacenUuid: o.almacen?.uuid || "",
          estado: o.estado,
          prioridad: o.prioridad,
          observaciones: o.observaciones || "",
          detalles: (o.detalles || []).map((d) => ({ key: clave(), articuloUuid: d.articulo?.uuid || "", cantidad: String(Number(d.cantidad)), costoUnitario: String(Number(d.costoUnitario || 0)) })),
          manoObra: (o.manoObra || []).map((m) => ({
            key: clave(),
            descripcion: m.descripcion,
            horas: String(Number(m.horas || 0)),
            costoHora: String(Number(m.costoHora || 0)),
            responsableUuid: m.responsable?.uuid || "",
          })),
          servicios: (o.servicios || []).map((s) => ({ key: clave(), descripcion: s.descripcion, proveedor: s.proveedor || "", costo: String(Number(s.costo || 0)) })),
        },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));
  const setLinea = (lista, key, patch) => setModal((m) => ({ ...m, form: { ...m.form, [lista]: m.form[lista].map((x) => (x.key === key ? { ...x, ...patch } : x)) } }));
  const agregar = (lista, fila) => setModal((m) => ({ ...m, form: { ...m.form, [lista]: [...m.form[lista], { key: clave(), ...fila }] } }));
  const quitar = (lista, key) => setModal((m) => ({ ...m, form: { ...m.form, [lista]: m.form[lista].filter((x) => x.key !== key) } }));

  const totales = modal
    ? {
        repuestos: modal.form.detalles.reduce((a, d) => a + num(d.cantidad) * num(d.costoUnitario), 0),
        manoObra: modal.form.manoObra.reduce((a, m) => a + num(m.horas) * num(m.costoHora), 0),
        servicios: modal.form.servicios.reduce((a, s) => a + num(s.costo), 0),
      }
    : null;

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const f = modal.form;
      const body = {
        equipoUuid: f.equipoUuid,
        planUuid: f.planUuid || null,
        programacionUuid: f.programacionUuid || null,
        tipo: f.tipo,
        descripcion: f.descripcion,
        fecha: f.fecha,
        responsableUuid: f.responsableUuid || null,
        almacenUuid: f.almacenUuid || null,
        estado: f.estado,
        prioridad: f.prioridad,
        observaciones: f.observaciones || null,
        detalles: f.detalles.filter((d) => d.articuloUuid && num(d.cantidad) > 0).map((d) => ({ articuloUuid: d.articuloUuid, cantidad: num(d.cantidad), costoUnitario: num(d.costoUnitario) })),
        manoObra: f.manoObra
          .filter((m) => m.descripcion.trim())
          .map((m) => ({ descripcion: m.descripcion.trim(), horas: num(m.horas), costoHora: num(m.costoHora), responsableUuid: m.responsableUuid || null })),
        servicios: f.servicios.filter((s) => s.descripcion.trim()).map((s) => ({ descripcion: s.descripcion.trim(), proveedor: s.proveedor || null, costo: num(s.costo) })),
      };
      if (modal.editing) await apiFetch(`/inventarios/ordenes-mantenimiento/${modal.editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiFetch("/inventarios/ordenes-mantenimiento", { method: "POST", body: JSON.stringify(body) });
      setModal(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function cerrarOrden() {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/inventarios/ordenes-mantenimiento/${cierre.orden.uuid}/cerrar`, {
        method: "POST",
        body: JSON.stringify({ almacenUuid: cierre.almacenUuid || null, observaciones: cierre.observaciones || null }),
      });
      setCierre(null);
      load();
    } catch (err) {
      setCierre((c) => ({ ...c, error: err.message }));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(orden) {
    if (!confirm(`¿Eliminar la orden ${orden.numero}?`)) return;
    try {
      await apiFetch(`/inventarios/ordenes-mantenimiento/${orden.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const editable = !modal?.editing || !["CERRADA", "CANCELADA"].includes(modal.editing.estado);
  const planesDelEquipo = modal ? planes.filter((p) => !modal.form.equipoUuid || p.equipo?.uuid === modal.form.equipoUuid) : [];

  return (
    <RequirePermission code="menu.inventarios.ordenes">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Órdenes de mantenimiento</h1>
            <p className="text-secondary mb-0">Trabajos sobre los equipos: repuestos, mano de obra y servicios. Al cerrar, los repuestos salen del inventario.</p>
          </div>
          {hasPermission("inventario.ordenes.crear") && (
            <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => abrir(null)}>
              <FiPlus /> Nueva orden
            </button>
          )}
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-medium mb-1">Equipo</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.equipoUuid} onChange={(e) => cambiarFiltro({ equipoUuid: e.target.value })}>
                <option value="">Todos</option>
                {equipos.map((eq) => (
                  <option key={eq.uuid} value={eq.uuid}>
                    {eq.codigo} — {eq.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Estado</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.estado} onChange={(e) => cambiarFiltro({ estado: e.target.value })}>
                <option value="">Todos</option>
                {ESTADOS_ORDEN.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Tipo</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.tipo} onChange={(e) => cambiarFiltro({ tipo: e.target.value })}>
                <option value="">Todos</option>
                {TIPOS_MANTENIMIENTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-medium mb-1">Buscar</label>
              <input
                type="text"
                className="form-control form-control-sm rounded-3"
                placeholder="Número o descripción..."
                value={filtros.search}
                onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Trabajo</th>
                  <th>Tipo</th>
                  <th>Prioridad</th>
                  <th className="text-end">Costo</th>
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
                      No hay órdenes para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((o) => {
                    const abierta = !["CERRADA", "CANCELADA"].includes(o.estado);
                    return (
                      <tr key={o.uuid}>
                        <td className="fw-medium text-nowrap">{o.numero}</td>
                        <td className="text-nowrap">{formatoFecha(o.fecha)}</td>
                        <td>
                          <span className="fw-medium">{o.equipo?.codigo}</span> <span className="text-secondary">{o.equipo?.nombre}</span>
                        </td>
                        <td>
                          {o.descripcion}
                          {o.plan && <div className="text-secondary">Plan: {o.plan.nombre}</div>}
                        </td>
                        <td>{etiqueta(TIPOS_MANTENIMIENTO, o.tipo)}</td>
                        <td>
                          <TextoPrioridad value={o.prioridad} />
                        </td>
                        <td className="text-end text-nowrap">{dinero(o.costoTotal)}</td>
                        <td>
                          <Insignia lista={ESTADOS_ORDEN} value={o.estado} />
                          {o.fechaCierre && <div className="text-secondary">{formatoFecha(o.fechaCierre)}</div>}
                        </td>
                        <td className="text-end text-nowrap">
                          {abierta && hasPermission("inventario.ordenes.cerrar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 text-success"
                              title="Cerrar orden (descuenta los repuestos del inventario)"
                              onClick={() => setCierre({ orden: o, almacenUuid: o.almacen?.uuid || (almacenes.length === 1 ? almacenes[0].uuid : ""), observaciones: "" })}
                            >
                              <FiCheckCircle />
                            </button>
                          )}
                          {hasPermission("inventario.ordenes.editar") && (
                            <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title={abierta ? "Editar" : "Ver"} onClick={() => abrir(o)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {abierta && hasPermission("inventario.ordenes.eliminar") && (
                            <button type="button" className="btn btn-sm btn-link p-1 text-danger" title="Eliminar" onClick={() => eliminar(o)}>
                              <FiTrash2 />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {modal && (
          <ModalShell
            title={modal.editing ? `${editable ? "Editar" : "Ver"} orden ${modal.editing.numero}` : "Nueva orden de mantenimiento"}
            onClose={() => setModal(null)}
            size="xl"
          >
            <form onSubmit={guardar}>
              <fieldset disabled={!editable}>
                <div className="row g-2 mb-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-medium mb-1">
                      Equipo <span className="text-danger">*</span>
                    </label>
                    <select className="form-select form-select-sm rounded-3" required value={modal.form.equipoUuid} onChange={(e) => setForm({ equipoUuid: e.target.value, planUuid: "" })}>
                      <option value="">Selecciona...</option>
                      {equipos.map((eq) => (
                        <option key={eq.uuid} value={eq.uuid}>
                          {eq.codigo} — {eq.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-medium mb-1">Plan</label>
                    <select className="form-select form-select-sm rounded-3" value={modal.form.planUuid} onChange={(e) => setForm({ planUuid: e.target.value })}>
                      <option value="">Sin plan</option>
                      {planesDelEquipo.map((p) => (
                        <option key={p.uuid} value={p.uuid}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-medium mb-1">
                      Trabajo a realizar <span className="text-danger">*</span>
                    </label>
                    <input type="text" required maxLength={2000} className="form-control form-control-sm rounded-3" value={modal.form.descripcion} onChange={(e) => setForm({ descripcion: e.target.value })} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-medium mb-1">Fecha</label>
                    <input type="date" required className="form-control form-control-sm rounded-3" value={modal.form.fecha} onChange={(e) => setForm({ fecha: e.target.value })} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-medium mb-1">Tipo</label>
                    <select className="form-select form-select-sm rounded-3" value={modal.form.tipo} onChange={(e) => setForm({ tipo: e.target.value })}>
                      {TIPOS_MANTENIMIENTO.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-medium mb-1">Prioridad</label>
                    <select className="form-select form-select-sm rounded-3" value={modal.form.prioridad} onChange={(e) => setForm({ prioridad: e.target.value })}>
                      {PRIORIDADES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-medium mb-1">Estado</label>
                    <select className="form-select form-select-sm rounded-3" value={modal.form.estado} onChange={(e) => setForm({ estado: e.target.value })}>
                      {ESTADOS_ORDEN.filter((s) => s.value !== "CERRADA").map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-medium mb-1">Responsable</label>
                    <select className="form-select form-select-sm rounded-3" value={modal.form.responsableUuid} onChange={(e) => setForm({ responsableUuid: e.target.value })}>
                      <option value="">Sin asignar</option>
                      {usuarios.map((u) => (
                        <option key={u.uuid} value={u.uuid}>
                          {u.nombre || u.usuario}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-medium mb-1">Almacén de los repuestos</label>
                    <select className="form-select form-select-sm rounded-3" value={modal.form.almacenUuid} onChange={(e) => setForm({ almacenUuid: e.target.value })}>
                      <option value="">Sin almacén</option>
                      {almacenes.map((a) => (
                        <option key={a.uuid} value={a.uuid}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Repuestos */}
                <div className="mt-3 p-2 rounded-3" style={{ backgroundColor: "#f8f9fa" }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small fw-semibold">Repuestos e insumos</span>
                    <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none text-success" onClick={() => agregar("detalles", { articuloUuid: "", cantidad: "1", costoUnitario: "0" })}>
                      + Agregar repuesto
                    </button>
                  </div>
                  {modal.form.detalles.length === 0 && <div className="small text-secondary">Sin repuestos.</div>}
                  {modal.form.detalles.map((d) => (
                    <div key={d.key} className="row g-1 align-items-center mb-1">
                      <div className="col-12 col-md-6">
                        <select
                          className="form-select form-select-sm rounded-3"
                          value={d.articuloUuid}
                          onChange={(e) => {
                            const art = repuestos.find((a) => a.uuid === e.target.value);
                            setLinea("detalles", d.key, { articuloUuid: e.target.value, costoUnitario: String(Number(art?.costoCompra || 0)) });
                          }}
                        >
                          <option value="">Selecciona...</option>
                          {repuestos.map((a) => (
                            <option key={a.uuid} value={a.uuid}>
                              {a.nombre}
                              {a.codigo ? ` (${a.codigo})` : ""}
                              {a.categoria?.tipo === "REPUESTO" ? "" : ` — ${a.categoria?.nombre || "otro"}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-4 col-md-2">
                        <input type="text" inputMode="decimal" className="form-control form-control-sm rounded-3 text-end" placeholder="Cant." value={d.cantidad} onChange={(e) => setLinea("detalles", d.key, { cantidad: e.target.value })} />
                      </div>
                      <div className="col-5 col-md-3">
                        <input type="text" inputMode="decimal" className="form-control form-control-sm rounded-3 text-end" placeholder="Costo unit." value={d.costoUnitario} onChange={(e) => setLinea("detalles", d.key, { costoUnitario: e.target.value })} />
                      </div>
                      <div className="col-3 col-md-1 text-end">
                        <button type="button" className="btn btn-link btn-sm p-0 text-danger" title="Quitar" onClick={() => quitar("detalles", d.key)}>
                          <FiX />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mano de obra */}
                <div className="mt-2 p-2 rounded-3" style={{ backgroundColor: "#f8f9fa" }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small fw-semibold">Mano de obra</span>
                    <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none text-success" onClick={() => agregar("manoObra", { descripcion: "", horas: "1", costoHora: "0", responsableUuid: "" })}>
                      + Agregar mano de obra
                    </button>
                  </div>
                  {modal.form.manoObra.length === 0 && <div className="small text-secondary">Sin mano de obra.</div>}
                  {modal.form.manoObra.map((m) => (
                    <div key={m.key} className="row g-1 align-items-center mb-1">
                      <div className="col-12 col-md-4">
                        <input type="text" className="form-control form-control-sm rounded-3" placeholder="Labor" value={m.descripcion} onChange={(e) => setLinea("manoObra", m.key, { descripcion: e.target.value })} />
                      </div>
                      <div className="col-6 col-md-3">
                        <select className="form-select form-select-sm rounded-3" value={m.responsableUuid} onChange={(e) => setLinea("manoObra", m.key, { responsableUuid: e.target.value })}>
                          <option value="">Quién</option>
                          {usuarios.map((u) => (
                            <option key={u.uuid} value={u.uuid}>
                              {u.nombre || u.usuario}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-3 col-md-2">
                        <input type="text" inputMode="decimal" className="form-control form-control-sm rounded-3 text-end" placeholder="Horas" value={m.horas} onChange={(e) => setLinea("manoObra", m.key, { horas: e.target.value })} />
                      </div>
                      <div className="col-3 col-md-2">
                        <input type="text" inputMode="decimal" className="form-control form-control-sm rounded-3 text-end" placeholder="$/hora" value={m.costoHora} onChange={(e) => setLinea("manoObra", m.key, { costoHora: e.target.value })} />
                      </div>
                      <div className="col-12 col-md-1 text-end">
                        <button type="button" className="btn btn-link btn-sm p-0 text-danger" title="Quitar" onClick={() => quitar("manoObra", m.key)}>
                          <FiX />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Servicios */}
                <div className="mt-2 p-2 rounded-3" style={{ backgroundColor: "#f8f9fa" }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small fw-semibold">Servicios externos</span>
                    <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none text-success" onClick={() => agregar("servicios", { descripcion: "", proveedor: "", costo: "0" })}>
                      + Agregar servicio
                    </button>
                  </div>
                  {modal.form.servicios.length === 0 && <div className="small text-secondary">Sin servicios.</div>}
                  {modal.form.servicios.map((s) => (
                    <div key={s.key} className="row g-1 align-items-center mb-1">
                      <div className="col-12 col-md-5">
                        <input type="text" className="form-control form-control-sm rounded-3" placeholder="Servicio" value={s.descripcion} onChange={(e) => setLinea("servicios", s.key, { descripcion: e.target.value })} />
                      </div>
                      <div className="col-7 col-md-4">
                        <input type="text" list="ordenes-proveedores" className="form-control form-control-sm rounded-3" placeholder="Proveedor" value={s.proveedor} onChange={(e) => setLinea("servicios", s.key, { proveedor: e.target.value })} />
                      </div>
                      <div className="col-4 col-md-2">
                        <input type="text" inputMode="decimal" className="form-control form-control-sm rounded-3 text-end" placeholder="Costo" value={s.costo} onChange={(e) => setLinea("servicios", s.key, { costo: e.target.value })} />
                      </div>
                      <div className="col-1 text-end">
                        <button type="button" className="btn btn-link btn-sm p-0 text-danger" title="Quitar" onClick={() => quitar("servicios", s.key)}>
                          <FiX />
                        </button>
                      </div>
                    </div>
                  ))}
                  <datalist id="ordenes-proveedores">
                    {proveedores.map((p) => (
                      <option key={p.uuid} value={p.nombre} />
                    ))}
                  </datalist>
                </div>

                <div className="mt-2 mb-3">
                  <label className="form-label small fw-medium mb-1">Observaciones</label>
                  <textarea className="form-control form-control-sm rounded-3" rows={2} maxLength={1000} value={modal.form.observaciones} onChange={(e) => setForm({ observaciones: e.target.value })} />
                </div>
              </fieldset>

              <div className="d-flex flex-wrap justify-content-end gap-3 small mb-3">
                <span>Repuestos: {dinero(totales.repuestos)}</span>
                <span>Mano de obra: {dinero(totales.manoObra)}</span>
                <span>Servicios: {dinero(totales.servicios)}</span>
                <strong>Total: {dinero(totales.repuestos + totales.manoObra + totales.servicios)}</strong>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setModal(null)}>
                  {editable ? "Cancelar" : "Cerrar"}
                </button>
                {editable && (
                  <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                )}
              </div>
            </form>
          </ModalShell>
        )}

        {cierre && (
          <ModalShell title={`Cerrar orden ${cierre.orden.numero}`} onClose={() => setCierre(null)}>
            <p className="small">
              Al cerrar, los repuestos de la orden salen del inventario (con validación de stock), la programación de origen queda completada y, si el plan
              es por días o meses, se agenda la siguiente. Una orden cerrada ya no se puede editar.
            </p>
            <div className="mb-2">
              <label className="form-label small fw-medium mb-1">Almacén de donde salen los repuestos</label>
              <select className="form-select form-select-sm rounded-3" value={cierre.almacenUuid} onChange={(e) => setCierre((c) => ({ ...c, almacenUuid: e.target.value }))}>
                <option value="">El de la orden</option>
                {almacenes.map((a) => (
                  <option key={a.uuid} value={a.uuid}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label small fw-medium mb-1">Observaciones del cierre</label>
              <textarea className="form-control form-control-sm rounded-3" rows={2} value={cierre.observaciones} onChange={(e) => setCierre((c) => ({ ...c, observaciones: e.target.value }))} />
            </div>
            {cierre.error && <div className="alert alert-danger py-2 small">{cierre.error}</div>}
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setCierre(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={saving} onClick={cerrarOrden}>
                {saving ? "Cerrando..." : "Cerrar orden"}
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
