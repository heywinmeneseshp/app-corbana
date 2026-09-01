"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiRepeat } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const TIPOS = [
  { value: "ENTRADA", label: "Entrada", badge: "success" },
  { value: "SALIDA", label: "Salida", badge: "danger" },
  { value: "AJUSTE_ENTRADA", label: "Ajuste (entrada)", badge: "warning" },
  { value: "AJUSTE_SALIDA", label: "Ajuste (salida)", badge: "warning" },
  { value: "TRANSFERENCIA_SALIDA", label: "Transferencia (salida)", badge: "info" },
  { value: "TRANSFERENCIA_ENTRADA", label: "Transferencia (entrada)", badge: "info" },
  { value: "ELABORACION_SALIDA", label: "Elaboración (salida)", badge: "secondary" },
  { value: "ELABORACION_ENTRADA", label: "Elaboración (entrada)", badge: "secondary" },
];

function badgeFor(tipo) {
  const t = TIPOS.find((x) => x.value === tipo);
  return t ? t.badge : "secondary";
}

function labelFor(tipo) {
  const t = TIPOS.find((x) => x.value === tipo);
  return t ? t.label : tipo;
}

function emptyForm() {
  return {
    documento: "",
    tipo: "ENTRADA",
    fecha: new Date().toISOString().slice(0, 10),
    almacenUuid: "",
    articuloUuid: "",
    cantidad: "",
    unidadUuid: "",
    costoUnitario: "0",
    lote: "",
    fechaVencimiento: "",
    motivoUuid: "",
    observaciones: "",
  };
}

function emptyTransferForm() {
  return {
    documento: "",
    fecha: new Date().toISOString().slice(0, 10),
    almacenOrigenUuid: "",
    almacenDestinoUuid: "",
    articuloUuid: "",
    cantidad: "",
    unidadUuid: "",
    costoUnitario: "0",
    observaciones: "",
  };
}

export default function MovimientosPage() {
  const [items, setItems] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filtros, setFiltros] = useState({ almacenUuid: "", articuloUuid: "", tipo: "", fechaDesde: "", fechaHasta: "", documento: "" });

  const [modalOpen, setModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [transferForm, setTransferForm] = useState(emptyTransferForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100" });
      Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
      const { items: rows } = await apiFetch(`/inventarios/movimientos?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [a, p, m, u] = await Promise.all([
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/motivos?limit=100&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
      ]);
      setAlmacenes(a.items || []);
      setArticulos(p.items || []);
      setMotivos(m.items || []);
      setUnidades(u.items || []);
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
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openTransfer() {
    setTransferForm(emptyTransferForm());
    setFormError("");
    setTransferModalOpen(true);
  }

  function handleArticuloChange(uuid, setter) {
    const prod = articulos.find((p) => p.uuid === uuid);
    setter((f) => ({ ...f, articuloUuid: uuid, unidadUuid: prod?.unidadMedida?.uuid || f.unidadUuid }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = {
        ...form,
        cantidad: Number(form.cantidad),
        costoUnitario: Number(form.costoUnitario),
        unidadUuid: form.unidadUuid || null,
        lote: form.lote || null,
        fechaVencimiento: form.fechaVencimiento || null,
        motivoUuid: form.motivoUuid || null,
        observaciones: form.observaciones || null,
      };
      await apiFetch("/inventarios/movimientos", { method: "POST", body: JSON.stringify(body) });
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTransfer(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = {
        ...transferForm,
        cantidad: Number(transferForm.cantidad),
        costoUnitario: Number(transferForm.costoUnitario),
        unidadUuid: transferForm.unidadUuid || null,
        observaciones: transferForm.observaciones || null,
      };
      await apiFetch("/inventarios/movimientos/transferencias", { method: "POST", body: JSON.stringify(body) });
      setTransferModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Movimientos de Inventario</h1>
            <p className="text-secondary mb-0">Entradas, salidas, ajustes, transferencias y elaboraciones. Registro inmutable (kárdex).</p>
          </div>
          <div className="d-flex gap-2">
            {hasPermission("inventario.movimientos.crear") && (
              <button type="button" className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2" onClick={openTransfer}>
                <FiRepeat /> Transferencia
              </button>
            )}
            {hasPermission("inventario.movimientos.crear") && (
              <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                <FiPlus /> Nuevo movimiento
              </button>
            )}
          </div>
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
              <label className="form-label small fw-medium mb-1">Artículo</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.articuloUuid}
                onChange={(e) => setFiltros((f) => ({ ...f, articuloUuid: e.target.value }))}
              >
                <option value="">Todos</option>
                {articulos.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Tipo</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.tipo}
                onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}
              >
                <option value="">Todos</option>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
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
              <label className="form-label small fw-medium mb-1">Documento</label>
              <input
                type="text"
                className="form-control form-control-sm rounded-3"
                value={filtros.documento}
                onChange={(e) => setFiltros((f) => ({ ...f, documento: e.target.value }))}
              />
            </div>
            <div className="col-auto">
              <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={load}>
                Filtrar
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
                  <th>Almacén</th>
                  <th>Artículo</th>
                  <th>Cantidad</th>
                  <th>Costo unit.</th>
                  <th>Costo total</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
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
                      No hay movimientos registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((m) => (
                    <tr key={m.uuid}>
                      <td className="small text-secondary">{new Date(m.fecha).toLocaleDateString()}</td>
                      <td className="fw-medium">{m.documento}</td>
                      <td>
                        <span className={`badge rounded-pill text-bg-${badgeFor(m.tipo)}`}>{labelFor(m.tipo)}</span>
                      </td>
                      <td className="small text-secondary">{m.almacen?.nombre || "—"}</td>
                      <td className="small text-secondary">{m.articulo?.nombre || "—"}</td>
                      <td className="small">
                        {Number(m.cantidad).toFixed(2)} {m.unidad?.simbolo || ""}
                      </td>
                      <td className="small">{Number(m.costoUnitario || 0).toFixed(2)}</td>
                      <td className="small">{Number(m.costoTotal || 0).toFixed(2)}</td>
                      <td className="small text-secondary">{m.motivo?.nombre || "—"}</td>
                      <td className="small text-secondary">{m.usuario?.usuario || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <ModalShell title="Nuevo movimiento" onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Documento <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    required
                    maxLength={50}
                    value={form.documento}
                    onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Fecha <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control rounded-3"
                    required
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Tipo</label>
                <select
                  className="form-select rounded-3"
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                >
                  {TIPOS.filter((t) => !t.value.startsWith("TRANSFERENCIA")).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Almacén <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select rounded-3"
                    required
                    value={form.almacenUuid}
                    onChange={(e) => setForm((f) => ({ ...f, almacenUuid: e.target.value }))}
                  >
                    <option value="">Seleccionar...</option>
                    {almacenes.map((a) => (
                      <option key={a.uuid} value={a.uuid}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Artículo <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select rounded-3"
                    required
                    value={form.articuloUuid}
                    onChange={(e) => handleArticuloChange(e.target.value, setForm)}
                  >
                    <option value="">Seleccionar...</option>
                    {articulos.map((p) => (
                      <option key={p.uuid} value={p.uuid}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    Cantidad <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-control rounded-3"
                    value={form.cantidad}
                    onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Unidad</label>
                  <select
                    className="form-select rounded-3"
                    value={form.unidadUuid}
                    onChange={(e) => setForm((f) => ({ ...f, unidadUuid: e.target.value }))}
                  >
                    <option value="">Base del artículo</option>
                    {unidades.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.simbolo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Costo unitario</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={form.costoUnitario}
                    onChange={(e) => setForm((f) => ({ ...f, costoUnitario: e.target.value }))}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Lote</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={50}
                    value={form.lote}
                    onChange={(e) => setForm((f) => ({ ...f, lote: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Fecha de vencimiento</label>
                  <input
                    type="date"
                    className="form-control rounded-3"
                    value={form.fechaVencimiento}
                    onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Motivo</label>
                <select
                  className="form-select rounded-3"
                  value={form.motivoUuid}
                  onChange={(e) => setForm((f) => ({ ...f, motivoUuid: e.target.value }))}
                >
                  <option value="">Sin motivo</option>
                  {motivos.map((m) => (
                    <option key={m.uuid} value={m.uuid}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Observaciones</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={500}
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

        {transferModalOpen && (
          <ModalShell title="Nueva transferencia" onClose={() => setTransferModalOpen(false)}>
            <form onSubmit={handleSaveTransfer}>
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Documento <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    required
                    maxLength={50}
                    value={transferForm.documento}
                    onChange={(e) => setTransferForm((f) => ({ ...f, documento: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Fecha <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control rounded-3"
                    required
                    value={transferForm.fecha}
                    onChange={(e) => setTransferForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Almacén origen <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select rounded-3"
                    required
                    value={transferForm.almacenOrigenUuid}
                    onChange={(e) => setTransferForm((f) => ({ ...f, almacenOrigenUuid: e.target.value }))}
                  >
                    <option value="">Seleccionar...</option>
                    {almacenes.map((a) => (
                      <option key={a.uuid} value={a.uuid}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    Almacén destino <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select rounded-3"
                    required
                    value={transferForm.almacenDestinoUuid}
                    onChange={(e) => setTransferForm((f) => ({ ...f, almacenDestinoUuid: e.target.value }))}
                  >
                    <option value="">Seleccionar...</option>
                    {almacenes
                      .filter((a) => a.uuid !== transferForm.almacenOrigenUuid)
                      .map((a) => (
                        <option key={a.uuid} value={a.uuid}>
                          {a.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Artículo <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select rounded-3"
                  required
                  value={transferForm.articuloUuid}
                  onChange={(e) => handleArticuloChange(e.target.value, setTransferForm)}
                >
                  <option value="">Seleccionar...</option>
                  {articulos.map((p) => (
                    <option key={p.uuid} value={p.uuid}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    Cantidad <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-control rounded-3"
                    value={transferForm.cantidad}
                    onChange={(e) => setTransferForm((f) => ({ ...f, cantidad: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Unidad</label>
                  <select
                    className="form-select rounded-3"
                    value={transferForm.unidadUuid}
                    onChange={(e) => setTransferForm((f) => ({ ...f, unidadUuid: e.target.value }))}
                  >
                    <option value="">Base del artículo</option>
                    {unidades.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.simbolo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Costo unitario</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control rounded-3"
                    value={transferForm.costoUnitario}
                    onChange={(e) => setTransferForm((f) => ({ ...f, costoUnitario: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Observaciones</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={500}
                  value={transferForm.observaciones}
                  onChange={(e) => setTransferForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setTransferModalOpen(false)}>
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
