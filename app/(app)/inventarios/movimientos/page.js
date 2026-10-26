"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiDownload, FiPlus, FiRepeat, FiTruck } from "react-icons/fi";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import InventarioTabs from "@/components/inventario/InventarioTabs";
import ModalShell from "@/components/ModalShell";
import MovimientoLoteModal from "@/components/inventario/MovimientoLoteModal";

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

// Fecha DATEONLY mostrada tal cual (dd/mm/aaaa): `new Date("2026-10-22")` en Colombia se mostraba como el día anterior.
function formatoFecha(f) {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
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

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [loteModo, setLoteModo] = useState(null); // null | "recepcion" | "movimiento"
  const [transferForm, setTransferForm] = useState(emptyTransferForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [total, setTotal] = useState(0);
  const [exportando, setExportando] = useState(false);

  // Excel con TODOS los movimientos de los filtros actuales (la tabla muestra solo los 100 más recientes).
  async function exportarExcel() {
    setExportando(true);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
      const { items: todos } = await apiFetchTodos(`/inventarios/movimientos?${qs}`);
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Movimientos", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Fecha", width: 12 },
        { header: "Documento", width: 16 },
        { header: "Tipo", width: 22 },
        { header: "Almacén", width: 18 },
        { header: "Código", width: 12 },
        { header: "Artículo", width: 32 },
        { header: "Cantidad", width: 12 },
        { header: "Unidad", width: 10 },
        { header: "Costo unit.", width: 12 },
        { header: "Costo total", width: 14 },
        { header: "Proveedor", width: 22 },
        { header: "Motivo", width: 18 },
        { header: "Usuario", width: 16 },
        { header: "Observaciones", width: 30 },
      ];
      for (const m of todos) {
        ws.addRow([
          formatoFecha(m.fecha),
          m.documento,
          labelFor(m.tipo),
          m.almacen?.nombre || "",
          m.articulo?.codigo || "",
          m.articulo?.nombre || "",
          Number(m.cantidad),
          m.unidad?.simbolo || "",
          Number(m.costoUnitario || 0),
          Number(m.costoTotal || 0),
          m.proveedor?.nombre || "",
          m.motivo?.nombre || "",
          m.usuario?.usuario || "",
          m.observaciones || "",
        ]);
      }
      ws.getRow(1).eachCell((c) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
      });
      [7, 9, 10].forEach((i) => (ws.getColumn(i).numFmt = "#,##0.00"));
      const buffer = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100" });
      Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
      const { items: rows, meta } = await apiFetch(`/inventarios/movimientos?${qs}`);
      setItems(rows);
      setTotal(meta?.total ?? rows.length);
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
        apiFetchTodos("/inventarios/articulos?limit=100&estado=true"),
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

  function openTransfer() {
    setTransferForm(emptyTransferForm());
    setFormError("");
    setTransferModalOpen(true);
  }

  function handleArticuloChange(uuid, setter) {
    const prod = articulos.find((p) => p.uuid === uuid);
    setter((f) => ({ ...f, articuloUuid: uuid, unidadUuid: prod?.unidadMedida?.uuid || f.unidadUuid }));
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
        <InventarioTabs />
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Movimientos de Inventario</h1>
            <p className="text-secondary mb-0">Entradas, salidas, ajustes, transferencias y elaboraciones. Registro inmutable (kárdex).</p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-success btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={exportarExcel}
              disabled={exportando || items.length === 0}
            >
              <FiDownload /> {exportando ? "Generando..." : "Excel"}
            </button>
            {hasPermission("inventario.movimientos.crear") && (
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" onClick={openTransfer}>
                <FiRepeat /> Transferencia
              </button>
            )}
            {hasPermission("inventario.movimientos.crear") && (
              <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => setLoteModo("recepcion")}>
                <FiTruck /> Recepción
              </button>
            )}
            {esAdministrador() && (
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => setLoteModo("movimiento")}>
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
                      <td className="small text-secondary text-nowrap">{formatoFecha(m.fecha)}</td>
                      <td className="fw-medium">
                        {m.documento}
                        {m.proveedor && <div className="small text-secondary fw-normal">{m.proveedor.nombre}</div>}
                      </td>
                      <td>
                        <span className={`badge rounded-pill text-bg-${badgeFor(m.tipo)}`}>{labelFor(m.tipo)}</span>
                      </td>
                      <td className="small text-secondary">{m.almacen?.nombre || "—"}</td>
                      <td className="small">
                        {m.articulo?.uuid ? (
                          <Link href={`/inventarios/kardex?articuloUuid=${m.articulo.uuid}`} className="text-decoration-none" title="Ver kárdex de este artículo">
                            {m.articulo.nombre}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
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
        {total > items.length && (
          <p className="small text-secondary mt-2">
            Mostrando los {items.length} movimientos más recientes de {total}. Usa los filtros para acotar o descarga el Excel con todos.
          </p>
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
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setTransferModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
        {loteModo && (
          <MovimientoLoteModal
            modo={loteModo}
            almacenes={almacenes}
            articulos={articulos}
            unidades={unidades}
            motivos={motivos}
            onClose={() => setLoteModo(null)}
            onGuardado={() => {
              setLoteModo(null);
              load();
            }}
          />
        )}
      </div>
    </RequirePermission>
  );
}
