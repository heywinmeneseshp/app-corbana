"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function FincasPage() {
  const [fincas, setFincas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [fincaModal, setFincaModal] = useState(null); // null | {} | finca
  const [lotesModal, setLotesModal] = useState(null); // null | finca
  const [configModal, setConfigModal] = useState(false);
  const [syncModal, setSyncModal] = useState(false);

  async function loadFincas() {
    setLoading(true);
    setError("");
    setSelected(new Set());
    try {
      const { items } = await apiFetch(`/fincas?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      setFincas(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFincas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelected = (uuid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === fincas.length ? new Set() : new Set(fincas.map((f) => f.uuid))));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Eliminar ${selected.size} finca(s) seleccionada(s)? Esta acción no se puede deshacer.`)) return;
    setError("");
    try {
      for (const uuid of selected) {
        await apiFetch(`/fincas/${uuid}`, { method: "DELETE" });
      }
      loadFincas();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteOne = async (uuid) => {
    if (!confirm("¿Eliminar esta finca?")) return;
    try {
      await apiFetch(`/fincas/${uuid}`, { method: "DELETE" });
      loadFincas();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Fincas</h1>
        <p className="text-secondary mb-0">Gestiona las fincas registradas en Corbana.</p>
      </div>

      <div className="d-flex flex-column flex-sm-row gap-2 mb-3">
        <div className="flex-grow-1">
          <input
            type="text"
            className="form-control rounded-3"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadFincas()}
          />
        </div>
        <button type="button" className="btn btn-brand rounded-3 text-nowrap" onClick={() => setFincaModal({})}>
          + Nueva Finca
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary rounded-3 text-nowrap"
          onClick={() => setSyncModal(true)}
        >
          Sincronizar con banarica
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary rounded-3"
          title="Configurar enlace del API de banarica"
          onClick={() => setConfigModal(true)}
        >
          ⚙
        </button>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {selected.size > 0 && (
        <div className="d-flex align-items-center justify-content-between rounded-3 px-3 py-2 mb-3" style={{ backgroundColor: "var(--brand-50)", border: "1px solid var(--brand-100)" }}>
          <span className="small fw-medium" style={{ color: "var(--brand-900)" }}>
            {selected.size} finca(s) seleccionada(s)
          </span>
          <button type="button" className="btn btn-link btn-sm text-danger text-decoration-none" onClick={handleBulkDelete}>
            Eliminar seleccionadas
          </button>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={fincas.length > 0 && selected.size === fincas.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Finca</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
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
              {!loading && fincas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No hay fincas registradas todavía.
                  </td>
                </tr>
              )}
              {!loading &&
                fincas.map((finca) => (
                  <tr key={finca.uuid}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selected.has(finca.uuid)}
                        onChange={() => toggleSelected(finca.uuid)}
                      />
                    </td>
                    <td>
                      <p className="fw-medium mb-0">{finca.nombre}</p>
                      <p className="small text-secondary mb-0">Código: {finca.codigo}</p>
                    </td>
                    <td>
                      {finca.estado ? (
                        <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                          Activo
                        </span>
                      ) : (
                        <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                      )}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-2"
                        onClick={() => setLotesModal(finca)}
                      >
                        Ver lotes
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-2"
                        onClick={() => setFincaModal(finca)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteOne(finca.uuid)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {fincaModal && (
        <FincaModal
          finca={fincaModal.uuid ? fincaModal : null}
          onClose={() => setFincaModal(null)}
          onSaved={() => {
            setFincaModal(null);
            loadFincas();
          }}
        />
      )}

      {lotesModal && <LotesModal finca={lotesModal} onClose={() => setLotesModal(null)} />}

      {configModal && <ConfigModal onClose={() => setConfigModal(false)} />}

      {syncModal && <SyncModal onClose={() => setSyncModal(false)} onSynced={loadFincas} />}
    </div>
  );
}

// ─── Modal: crear/editar finca ───
function FincaModal({ finca, onClose, onSaved }) {
  const [nombre, setNombre] = useState(finca?.nombre || "");
  const [codigo, setCodigo] = useState(finca?.codigo || "");
  const [estado, setEstado] = useState(finca ? finca.estado : true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(finca ? `/fincas/${finca.uuid}` : "/fincas", {
        method: finca ? "PUT" : "POST",
        body: JSON.stringify({ nombre, codigo, estado }),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={finca ? "Editar Finca" : "Nueva Finca"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">Nombre de la finca</label>
          <input
            type="text"
            required
            className="form-control rounded-3"
            placeholder="Ej: Finca La Esmeralda"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium">Código</label>
          <input
            type="text"
            required
            className="form-control rounded-3"
            placeholder="Ej: F-03"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>
        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="fincaEstado"
            checked={estado}
            onChange={(e) => setEstado(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="fincaEstado">
            Activo
          </label>
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-brand rounded-3 flex-grow-1">
            {saving ? "Guardando..." : "Guardar Finca"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: ver / crear lotes de una finca ───
function LotesModal({ finca, onClose }) {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function loadLotes() {
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/fincas/${finca.uuid}/lotes?limit=100`);
      setLotes(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalShell title={`Lotes de ${finca.nombre}`} onClose={onClose} size="lg">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="small text-secondary">Código: {finca.codigo}</span>
        <button type="button" className="btn btn-sm btn-brand rounded-3" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "+ Nuevo Lote"}
        </button>
      </div>

      {showForm && (
        <NuevoLoteForm
          fincaUuid={finca.uuid}
          onCreated={() => {
            setShowForm(false);
            loadLotes();
          }}
        />
      )}

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Lote</th>
              <th>Área (Ha)</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="text-center text-secondary py-3">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && lotes.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-secondary py-3">
                  Esta finca todavía no tiene lotes.
                </td>
              </tr>
            )}
            {!loading &&
              lotes.map((lote) => (
                <tr key={lote.uuid}>
                  <td>
                    <p className="mb-0">{lote.nombre}</p>
                    <p className="small text-secondary mb-0">Código: {lote.codigo}</p>
                  </td>
                  <td>{lote.area != null ? `${Number(lote.area).toFixed(1)} Ha` : "—"}</td>
                  <td>
                    {lote.estado ? (
                      <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                        Activo
                      </span>
                    ) : (
                      <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

function NuevoLoteForm({ fincaUuid, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch("/lotes", {
        method: "POST",
        body: JSON.stringify({
          fincaUuid,
          nombre,
          codigo,
          estado: true,
          ...(area ? { area: Number(area) } : {}),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-3 p-3 mb-3 bg-light">
      <div className="row g-2 mb-2">
        <div className="col-12 col-sm-5">
          <input
            type="text"
            required
            className="form-control form-control-sm rounded-3"
            placeholder="Nombre del lote"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="col-6 col-sm-3">
          <input
            type="text"
            required
            className="form-control form-control-sm rounded-3"
            placeholder="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>
        <div className="col-6 col-sm-2">
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control form-control-sm rounded-3"
            placeholder="Área (Ha)"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <div className="col-12 col-sm-2">
          <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 w-100">
            {saving ? "..." : "Agregar"}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-danger py-1 px-2 small mb-0">{error}</div>}
    </form>
  );
}

// ─── Modal: configurar enlace de banarica ───
function ConfigModal({ onClose }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/configuraciones/banarica-url")
      .then((data) => setUrl(data.url))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      await apiFetch("/configuraciones/banarica-url", { method: "PUT", body: JSON.stringify({ url }) });
      setOk("Enlace guardado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Conexión con banarica" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">Enlace del API de banarica</label>
          <input
            type="url"
            required
            disabled={loading}
            className="form-control rounded-3"
            placeholder="https://api-logistica-banarica.vercel.app"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="form-text small">
            Se usará para consultar <code>/api/v1/almacenes/</code> al sincronizar.
          </p>
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {ok && <div className="alert alert-success py-2 small">{ok}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving || loading} className="btn btn-brand rounded-3 flex-grow-1">
            {saving ? "Guardando..." : "Guardar enlace"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: elegir almacenes de banarica a sincronizar ───
function SyncModal({ onClose, onSynced }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    apiFetch("/fincas/banarica-almacenes")
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
      setError("Selecciona al menos un almacén.");
      return;
    }
    setError("");
    setSyncing(true);
    try {
      const resultado = await apiFetch("/fincas/sync-banarica", {
        method: "POST",
        body: JSON.stringify({ consecutivos: Array.from(selected) }),
      });
      setResult(
        `Sincronización completada: ${resultado.fincasCreadas} finca(s) creada(s), ${resultado.fincasActualizadas} actualizada(s), ${resultado.fincasRestauradas} restaurada(s).`,
      );
      onSynced();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ModalShell title="Elegir almacenes a sincronizar" onClose={onClose} size="lg">
      <p className="small text-secondary">
        Selecciona qué almacenes activos de banarica quieres crear/actualizar como fincas.
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
        {loading && <p className="text-center text-secondary small py-4 mb-0">Cargando almacenes...</p>}
        {!loading && items.length === 0 && <p className="text-center text-secondary small py-4 mb-0">No hay almacenes activos en banarica.</p>}
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
          Cancelar
        </button>
        <button type="button" disabled={syncing} className="btn btn-brand rounded-3 flex-grow-1" onClick={handleSync}>
          {syncing ? "Sincronizando..." : "Sincronizar seleccionados"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children, size }) {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: "rgba(15,23,42,0.4)", zIndex: 1050 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-4 shadow p-4 w-100" style={{ maxWidth: size === "lg" ? "36rem" : "28rem" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="h5 fw-bold mb-0">{title}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar"></button>
        </div>
        {children}
      </div>
    </div>
  );
}
