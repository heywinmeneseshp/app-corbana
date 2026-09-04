"use client";

import { Fragment, useEffect, useState } from "react";
import {
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiGrid,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiRotateCcw,
  FiMap,
  FiUpload,
  FiDownload,
} from "react-icons/fi";
import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { parseKmlPolygon, descargarKml, normalizarPerimetro } from "@/lib/kml";

export default function FincasPage() {
  const [fincas, setFincas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [fincaModal, setFincaModal] = useState(null); // null | {} | finca
  const [lotesModal, setLotesModal] = useState(null); // null | finca
  const [syncModal, setSyncModal] = useState(false);
  const [perimetroModal, setPerimetroModal] = useState(null); // null | finca (a visualizar en el mapa)
  const [importandoUuid, setImportandoUuid] = useState(""); // finca.uuid en curso de importar un .kml
  const [perimetroError, setPerimetroError] = useState("");

  async function handleImportarKml(finca, file) {
    setPerimetroError("");
    setImportandoUuid(finca.uuid);
    try {
      const texto = await file.text();
      const puntos = parseKmlPolygon(texto);
      await apiFetch(`/fincas/${finca.uuid}`, {
        method: "PUT",
        body: JSON.stringify({ perimetro: puntos }),
      });
      loadFincas();
    } catch (err) {
      setPerimetroError(`${finca.nombre}: ${err.message}`);
    } finally {
      setImportandoUuid("");
    }
  }

  async function handleQuitarPerimetro(finca) {
    if (!confirm(`¿Quitar el plot guardado de ${finca.nombre}?`)) return;
    try {
      await apiFetch(`/fincas/${finca.uuid}`, { method: "PUT", body: JSON.stringify({ perimetro: null }) });
      loadFincas();
    } catch (err) {
      setPerimetroError(err.message);
    }
  }

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
    <RequirePermission code="menu.maestros.fincas">
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-medium h4 mb-1">Fincas</h1>
        <p className="text-secondary small mb-0">Gestiona las fincas registradas en Corbana.</p>
      </div>

      <div className="d-flex flex-column flex-sm-row gap-2 mb-3">
        <div className="flex-grow-1 position-relative">
          <FiSearch className="position-absolute text-secondary" size={15} style={{ top: "0.7rem", left: "0.85rem" }} />
          <input
            type="text"
            className="form-control rounded-3 ps-5 border-0 bg-light"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadFincas()}
          />
        </div>
        {hasPermission("finca.crear") && (
          <button type="button" className="btn btn-brand rounded-3 text-nowrap d-flex align-items-center gap-2 px-3" onClick={() => setFincaModal({})}>
            <FiPlus size={15} /> Nueva Finca
          </button>
        )}
        {hasPermission("finca.crear") && (
          <button
            type="button"
            className="btn btn-light rounded-3 text-nowrap d-flex align-items-center gap-2 px-3 text-secondary"
            onClick={() => setSyncModal(true)}
          >
            <FiRefreshCw size={15} /> Sincronización con Logística
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger py-2 small border-0 rounded-3">{error}</div>}
      {perimetroError && <div className="alert alert-danger py-2 small border-0 rounded-3">{perimetroError}</div>}

      {selected.size > 0 && (
        <div className="d-flex align-items-center justify-content-between rounded-3 px-3 py-2 mb-3" style={{ backgroundColor: "var(--brand-50)" }}>
          <span className="small" style={{ color: "var(--brand-900)" }}>
            {selected.size} finca(s) seleccionada(s)
          </span>
          {hasPermission("finca.eliminar") && (
            <button type="button" className="btn btn-link btn-sm text-danger text-decoration-none d-flex align-items-center gap-1" onClick={handleBulkDelete}>
              <FiTrash2 size={13} /> Eliminar seleccionadas
            </button>
          )}
        </div>
      )}

      <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr className="small text-secondary" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <th className="fw-medium" style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={fincas.length > 0 && selected.size === fincas.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="fw-medium">Finca</th>
                <th className="fw-medium text-center">Plot</th>
                <th className="fw-medium text-center">Acciones</th>
                <th className="fw-medium text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && fincas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
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
                      <p className="fw-medium mb-0 d-flex align-items-center gap-2">
                        {finca.nombre}
                        {finca.esExterna && (
                          <span className="small text-secondary" title="No es propia — sin seguimiento de labores/racimos/lluvias">
                            · Externa
                          </span>
                        )}
                      </p>
                      <p className="small text-secondary mb-0">Código: {finca.codigo}</p>
                    </td>
                    <td className="text-center">
                      <div className="d-flex align-items-center justify-content-center gap-1 flex-nowrap">
                        {normalizarPerimetro(finca.perimetro) && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#2563eb" }}
                              title="Ver en el mapa"
                              onClick={() => setPerimetroModal(finca)}
                            >
                              <FiMap size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#16a34a" }}
                              title="Exportar .kml"
                              onClick={() => descargarKml(normalizarPerimetro(finca.perimetro), finca.codigo || "perimetro")}
                            >
                              <FiDownload size={15} />
                            </button>
                          </>
                        )}
                        {hasPermission("finca.editar") && (
                          <label
                            className="d-inline-flex align-items-center justify-content-center p-1"
                            style={{
                              color: "#d97706",
                              cursor: importandoUuid === finca.uuid ? "default" : "pointer",
                              opacity: importandoUuid === finca.uuid ? 0.4 : 1,
                            }}
                            title="Importar .kml"
                          >
                            <FiUpload size={15} />
                            <input
                              type="file"
                              accept=".kml"
                              hidden
                              disabled={importandoUuid === finca.uuid}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) handleImportarKml(finca, file);
                              }}
                            />
                          </label>
                        )}
                        {normalizarPerimetro(finca.perimetro) && hasPermission("finca.editar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex"
                            style={{ color: "#dc2626" }}
                            title="Quitar plot"
                            onClick={() => handleQuitarPerimetro(finca)}
                          >
                            <FiX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-1 flex-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 text-secondary text-decoration-none text-nowrap"
                          title="Ver / crear lotes de esta finca"
                          onClick={() => setLotesModal(finca)}
                        >
                          <FiGrid size={15} /> Lotes
                        </button>
                        {hasPermission("finca.editar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                            title="Editar"
                            onClick={() => setFincaModal(finca)}
                          >
                            <FiEdit2 size={15} />
                          </button>
                        )}
                        {hasPermission("finca.eliminar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex"
                            style={{ color: "#dc2626" }}
                            title="Eliminar"
                            onClick={() => handleDeleteOne(finca.uuid)}
                          >
                            <FiTrash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="d-inline-flex align-items-center gap-1 small text-secondary">
                        <span
                          className="rounded-circle d-inline-block"
                          style={{ width: 6, height: 6, background: finca.estado ? "#16a34a" : "#cbd5e1" }}
                        />
                        {finca.estado ? "Activo" : "Inactivo"}
                      </span>
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

      {syncModal && <SyncModal onClose={() => setSyncModal(false)} onSynced={loadFincas} />}

      {perimetroModal && <VerPerimetroModal finca={perimetroModal} onClose={() => setPerimetroModal(null)} />}
    </div>
    </RequirePermission>
  );
}

// ─── Modal: crear/editar finca ───
function FincaModal({ finca, onClose, onSaved }) {
  const [nombre, setNombre] = useState(finca?.nombre || "");
  const [codigo, setCodigo] = useState(finca?.codigo || "");
  const [estado, setEstado] = useState(finca ? finca.estado : true);
  const [esExterna, setEsExterna] = useState(finca?.esExterna || false);
  const [grupoFincaUuid, setGrupoFincaUuid] = useState(finca?.grupoFinca?.uuid || "");
  const [grupos, setGrupos] = useState([]);
  const [fincasHermanas, setFincasHermanas] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/grupos-finca?limit=100")
      .then((data) => setGrupos(data.items))
      .catch(() => {});
  }, []);

  // Muestra qué otra(s) finca(s) ya están en el grupo elegido, para que
  // quede claro que seleccionar cualquiera de ellas comparte lotes y acceso.
  useEffect(() => {
    if (!grupoFincaUuid) {
      setFincasHermanas([]);
      return;
    }
    apiFetch(`/grupos-finca/${grupoFincaUuid}`)
      .then((grupo) => setFincasHermanas((grupo.fincas || []).filter((f) => f.uuid !== finca?.uuid)))
      .catch(() => setFincasHermanas([]));
  }, [grupoFincaUuid, finca?.uuid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = { nombre, codigo, estado, esExterna, grupoFincaUuid: grupoFincaUuid || null };
      await apiFetch(finca ? `/fincas/${finca.uuid}` : "/fincas", {
        method: finca ? "PUT" : "POST",
        body: JSON.stringify(payload),
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
        <div className="mb-3">
          <label className="form-label small fw-medium">Grupo de Finca (opcional)</label>
          <select
            className="form-select rounded-3"
            value={grupoFincaUuid}
            onChange={(e) => setGrupoFincaUuid(e.target.value)}
          >
            <option value="">Ninguno</option>
            {grupos.map((g) => (
              <option key={g.uuid} value={g.uuid}>
                {g.nombre}
              </option>
            ))}
          </select>
          <div className="form-text">
            Para fincas que en realidad son una sola dividida en varios registros: seleccionar cualquiera trae los
            lotes y datos de todo el grupo.
          </div>
          {fincasHermanas.length > 0 && (
            <div className="alert alert-info py-2 small mt-2 mb-0">
              También comparten este grupo: {fincasHermanas.map((f) => f.nombre).join(", ")}
            </div>
          )}
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
        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="fincaExterna"
            checked={esExterna}
            onChange={(e) => setEsExterna(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="fincaExterna">
            Finca externa
          </label>
          <div className="form-text">
            No es propia — exporta cajas a través nuestro (aparece en Programación de Corte) pero no le hacemos
            seguimiento de labores, racimos, precipitación, etc. Se oculta de esos selectores.
          </div>
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
            <FiX /> Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1">
            <FiSave /> {saving ? "Guardando..." : "Guardar Finca"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: visualizar el perímetro guardado en el mapa ───
function VerPerimetroModal({ finca, onClose }) {
  const perimetro = normalizarPerimetro(finca.perimetro) || [];
  const centro = perimetro.length
    ? [
        perimetro.reduce((acc, p) => acc + p[0], 0) / perimetro.length,
        perimetro.reduce((acc, p) => acc + p[1], 0) / perimetro.length,
      ]
    : [0, 0];

  return (
    <ModalShell title={`Plot — ${finca.nombre}`} onClose={onClose} fullscreen>
      <div className="flex-grow-1" style={{ minHeight: 0 }}>
        {perimetro.length === 0 ? (
          <div className="text-secondary small p-4 text-center">No se pudo leer el plot guardado.</div>
        ) : (
        <MapContainer center={centro} zoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <Polygon
            positions={perimetro}
            pathOptions={{ color: "#facc15", weight: 2, fillColor: "#facc15", fillOpacity: 0.1 }}
          />
        </MapContainer>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Modal: ver / crear lotes de una finca ───
function LotesModal({ finca, onClose }) {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [areaProdMap, setAreaProdMap] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({});
  const [mostrarEliminados, setMostrarEliminados] = useState(false);
  const esAdmin = (getCurrentUser()?.roles || []).includes("Administrador");

  const enableEditMode = () => {
    const draft = {};
    for (const l of lotes) {
      draft[l.uuid] = { nombre: l.nombre, codigo: l.codigo, area: l.area ?? "", estado: l.estado };
    }
    setEditDraft(draft);
    setEditMode(true);
    setExpanded(null);
  };

  const cancelEditMode = () => {
    setEditMode(false);
    setEditDraft({});
  };

  const handleDeleteLote = async (lote) => {
    if (!confirm(`¿Eliminar el lote "${lote.nombre}" (${lote.codigo})? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/lotes/${lote.uuid}`, { method: "DELETE" });
      setLotes((prev) => prev.filter((l) => l.uuid !== lote.uuid));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRestoreLote = async (lote) => {
    if (!confirm(`¿Restaurar el lote "${lote.nombre}" (${lote.codigo})?`)) return;
    try {
      const restaurado = await apiFetch(`/lotes/${lote.uuid}/restore`, { method: "POST" });
      setLotes((prev) => prev.map((l) => (l.uuid === lote.uuid ? restaurado : l)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveRow = async (uuid) => {
    const values = editDraft[uuid];
    if (!values) return;
    try {
      const res = await apiFetch(`/lotes/${uuid}`, {
        method: "PUT",
        body: JSON.stringify(
          values.area !== "" ? values : { ...values, area: null },
        ),
      });
      setLotes((prev) => prev.map((l) => (l.uuid === uuid ? res : l)));
    } catch (err) {
      setError(err.message);
    }
  };

  const setDraftField = (uuid, field, value) => {
    setEditDraft((prev) => ({ ...prev, [uuid]: { ...prev[uuid], [field]: value } }));
  };

  const toggle = (uuid, type) => {
    setExpanded((prev) => (prev && prev.uuid === uuid && prev.type === type ? null : { uuid, type }));
  };

  async function loadLotes() {
    setLoading(true);
    setError("");
    try {
      const incluirParam = esAdmin && mostrarEliminados ? "&incluirEliminados=true" : "";
      const { items } = await apiFetch(`/fincas/${finca.uuid}/lotes?limit=100${incluirParam}`);
      setLotes(items);
      // Los lotes eliminados no existen para el endpoint de historial (lo
      // excluye por ser soft-delete), así que se omiten aquí — de todas
      // formas no se les muestra esa columna en la tabla.
      const entries = await Promise.all(
        items
          .filter((lote) => !lote.deletedAt)
          .map(async (lote) => {
            const { items: historial } = await apiFetch(`/lotes/${lote.uuid}/area-produccion?limit=1`);
            return [lote.uuid, historial[0] || null];
          }),
      );
      setAreaProdMap(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarEliminados]);

  return (
    <ModalShell title={`Lotes de ${finca.nombre}`} onClose={onClose} size="lg">
      {error && <div className="alert alert-danger py-2 small border-0 rounded-3">{error}</div>}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-3">
          <span className="small text-secondary">Código: {finca.codigo}</span>
          {esAdmin && (
            <div className="form-check mb-0">
              <input
                type="checkbox"
                className="form-check-input"
                id="mostrar-eliminados"
                checked={mostrarEliminados}
                onChange={(e) => setMostrarEliminados(e.target.checked)}
              />
              <label className="form-check-label small text-secondary" htmlFor="mostrar-eliminados">
                Mostrar eliminados
              </label>
            </div>
          )}
        </div>
        <div className="d-flex gap-2">
          {!editMode && (
            <>
              {hasPermission("lote.editar") && (
                <button type="button" className="btn btn-sm btn-light rounded-3 d-inline-flex align-items-center gap-1 text-secondary" onClick={enableEditMode}>
                  <FiEdit2 size={14} /> Modo edición
                </button>
              )}
              {hasPermission("lote.crear") && (
                <button type="button" className="btn btn-sm btn-brand rounded-3 d-inline-flex align-items-center gap-1" onClick={() => setShowForm((v) => !v)}>
                  {showForm ? <><FiX size={14} /> Cancelar</> : <><FiPlus size={14} /> Nuevo Lote</>}
                </button>
              )}
            </>
          )}
          {editMode && (
            <button type="button" className="btn btn-sm btn-light rounded-3 d-inline-flex align-items-center gap-1 text-secondary" onClick={cancelEditMode}>
              <FiX size={14} /> Salir de edición
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <NuevoLoteForm
          fincaUuid={finca.uuid}
          onCreated={(nuevo) => {
            setLotes((prev) => [...prev, nuevo]);
            setShowForm(false);
          }}
        />
      )}

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead>
            <tr className="small text-secondary" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <th className="fw-medium">Lote</th>
              <th className="fw-medium">Área Disponible</th>
              <th className="fw-medium">Área en Producción</th>
              <th className="fw-medium">Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center text-secondary py-3">Cargando...</td>
              </tr>
            )}
            {!loading && lotes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-secondary py-3">Esta finca todavía no tiene lotes.</td>
              </tr>
            )}
            {!loading &&
              lotes.map((lote) => {
                const ultimo = areaProdMap[lote.uuid];
                const draft = editDraft[lote.uuid];
                return (
                  <Fragment key={lote.uuid}>
                    {editMode && draft ? (
                      <tr>
                        <td>
                          <input className="form-control form-control-sm rounded-3 mb-1" inputMode="numeric" pattern="[0-9]*" value={draft.nombre} onChange={(e) => setDraftField(lote.uuid, "nombre", e.target.value.replace(/\D/g, ""))} placeholder="Nombre (ej: 01)" />
                          <input className="form-control form-control-sm rounded-3" value={draft.codigo} onChange={(e) => setDraftField(lote.uuid, "codigo", e.target.value)} placeholder="Código" />
                        </td>
                        <td>
                          <input className="form-control form-control-sm rounded-3" type="number" step="0.01" min="0" value={draft.area} onChange={(e) => setDraftField(lote.uuid, "area", e.target.value)} placeholder="Ha" style={{ width: "7rem" }} />
                        </td>
                        <td>
                          {ultimo ? (
                            <><span>{Number(ultimo.area).toFixed(1)} Ha</span><p className="small text-secondary mb-0">{ultimo.fechaRegistro}</p></>
                          ) : (
                            <span className="text-secondary small">Sin registrar</span>
                          )}
                        </td>
                        <td>
                          <div className="form-check">
                            <input type="checkbox" className="form-check-input" id={`edit-estado-${lote.uuid}`} checked={draft.estado} onChange={(e) => setDraftField(lote.uuid, "estado", e.target.checked)} />
                            <label className="form-check-label small" htmlFor={`edit-estado-${lote.uuid}`}>{draft.estado ? "Activo" : "Inactivo"}</label>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex justify-content-end gap-2 flex-nowrap">
                            <button type="button" className="btn btn-sm btn-brand rounded-3 d-inline-flex align-items-center gap-1 text-nowrap" onClick={() => handleSaveRow(lote.uuid)}>
                              <FiSave /> Guardar
                            </button>
                            {esAdmin && (
                              <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar lote" onClick={() => handleDeleteLote(lote)}>
                                <FiTrash2 />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr className={lote.deletedAt ? "opacity-50" : undefined}>
                          <td>
                            <p className="mb-0">{lote.nombre}</p>
                            <p className="small text-secondary mb-0">Código: {lote.codigo}</p>
                          </td>
                          <td>{lote.area != null ? `${Number(lote.area).toFixed(1)} Ha` : "—"}</td>
                          <td>
                            {ultimo ? (
                              <><span>{Number(ultimo.area).toFixed(1)} Ha</span><p className="small text-secondary mb-0">{ultimo.fechaRegistro}</p></>
                            ) : (
                              <span className="text-secondary small">Sin registrar</span>
                            )}
                          </td>
                          <td>
                            <span className="d-inline-flex align-items-center gap-1 small text-secondary">
                              <span
                                className="rounded-circle d-inline-block"
                                style={{
                                  width: 6,
                                  height: 6,
                                  background: lote.deletedAt ? "#dc2626" : lote.estado ? "#16a34a" : "#cbd5e1",
                                }}
                              />
                              {lote.deletedAt ? "Eliminado" : lote.estado ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>
                            {lote.deletedAt ? (
                              esAdmin && (
                                <div className="d-flex justify-content-end">
                                  <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 text-decoration-none" style={{ color: "#16a34a" }} title="Restaurar lote" onClick={() => handleRestoreLote(lote)}>
                                    <FiRotateCcw size={14} /> Restaurar
                                  </button>
                                </div>
                              )
                            ) : (
                            <div className="d-flex justify-content-end gap-1 flex-nowrap">
                              {hasPermission("lote.editar") && (
                                <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex" title={expanded?.uuid === lote.uuid && expanded.type === "editar" ? "Cancelar" : "Editar lote"} onClick={() => toggle(lote.uuid, "editar")}>
                                  {expanded?.uuid === lote.uuid && expanded.type === "editar" ? <FiX size={15} className="text-secondary" /> : <FiEdit2 size={15} className="text-secondary" />}
                                </button>
                              )}
                              {hasPermission("lote.editar") && (
                                <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex" style={{ color: "#16a34a" }} title={expanded?.uuid === lote.uuid && expanded.type === "area" ? "Cancelar" : "Registrar área en producción"} onClick={() => toggle(lote.uuid, "area")}>
                                  {expanded?.uuid === lote.uuid && expanded.type === "area" ? <FiX size={15} /> : <FiRefreshCw size={15} />}
                                </button>
                              )}
                              {esAdmin && (
                                <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex" style={{ color: "#dc2626" }} title="Eliminar lote" onClick={() => handleDeleteLote(lote)}>
                                  <FiTrash2 size={15} />
                                </button>
                              )}
                            </div>
                            )}
                          </td>
                        </tr>
                        {expanded?.uuid === lote.uuid && expanded.type === "area" && (
                          <tr><td colSpan={5} className="bg-light p-3"><AreaProduccionForm loteUuid={lote.uuid} onRegistered={async () => { const { items: historial } = await apiFetch(`/lotes/${lote.uuid}/area-produccion?limit=1`); setAreaProdMap((prev) => ({ ...prev, [lote.uuid]: historial[0] || null })); setExpanded(null); }} /></td></tr>
                        )}
                        {expanded?.uuid === lote.uuid && expanded.type === "editar" && (
                          <tr><td colSpan={5} className="bg-light p-3"><EditarLoteForm lote={lote} onSaved={(actualizado) => { setLotes((prev) => prev.map((l) => (l.uuid === actualizado.uuid ? actualizado : l))); setExpanded(null); }} /></td></tr>
                        )}
                      </>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

function EditarLoteForm({ lote, onSaved }) {
  const [nombre, setNombre] = useState(lote.nombre);
  const [codigo, setCodigo] = useState(lote.codigo);
  const [area, setArea] = useState(lote.area ?? "");
  const [estado, setEstado] = useState(lote.estado);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch(`/lotes/${lote.uuid}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre,
          codigo,
          estado,
          ...(area !== "" ? { area: Number(area) } : {}),
        }),
      });
      onSaved(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-wrap align-items-end gap-2 py-2">
      <div>
        <label className="form-label small mb-1">Nombre del lote</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          className="form-control form-control-sm rounded-3"
          style={{ width: "12rem" }}
          placeholder="Ej: 01"
          value={nombre}
          onChange={(e) => setNombre(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div>
        <label className="form-label small mb-1">Código</label>
        <input
          type="text"
          required
          className="form-control form-control-sm rounded-3"
          style={{ width: "7rem" }}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
      </div>
      <div>
        <label className="form-label small mb-1">Área (Ha)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="form-control form-control-sm rounded-3"
          style={{ width: "6rem" }}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
      </div>
      <div className="form-check pb-2">
        <input
          type="checkbox"
          className="form-check-input"
          id={`estado-${lote.uuid}`}
          checked={estado}
          onChange={(e) => setEstado(e.target.checked)}
        />
        <label className="form-check-label small" htmlFor={`estado-${lote.uuid}`}>
          Activo
        </label>
      </div>
      <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1 text-nowrap">
        <FiSave /> {saving ? "Guardando..." : "Guardar"}
      </button>
      {error && <div className="alert alert-danger py-1 px-2 small mb-0 w-100">{error}</div>}
    </form>
  );
}

function AreaProduccionForm({ loteUuid, onRegistered }) {
  const [area, setArea] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(`/lotes/${loteUuid}/area-produccion`, {
        method: "POST",
        body: JSON.stringify({ area: Number(area), fecha }),
      });
      onRegistered();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-wrap align-items-end gap-2 py-2">
      <div>
        <label className="form-label small mb-1">Nueva área en producción (Ha)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          className="form-control form-control-sm rounded-3"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
      </div>
      <div>
        <label className="form-label small mb-1">Fecha</label>
        <input
          type="date"
          required
          className="form-control form-control-sm rounded-3"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 d-inline-flex align-items-center gap-1">
        <FiSave /> {saving ? "Guardando..." : "Registrar"}
      </button>
      {error && <span className="text-danger small ms-2">{error}</span>}
    </form>
  );
}

function NuevoLoteForm({ fincaUuid, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch("/lotes", {
        method: "POST",
        body: JSON.stringify({
          fincaUuid,
          nombre,
          estado: true,
          ...(area ? { area: Number(area) } : {}),
        }),
      });
      onCreated(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-3 p-3 mb-3 bg-light">
      <p className="small text-secondary mb-2">El código del lote se genera automáticamente (código de la finca + consecutivo).</p>
      <div className="row g-2 mb-2">
        <div className="col-12 col-sm-7">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            className="form-control form-control-sm rounded-3"
            placeholder="Nombre del lote (ej: 01)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="col-6 col-sm-3">
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
          <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 w-100 d-flex align-items-center justify-content-center gap-1">
            <FiPlus /> {saving ? "..." : "Agregar"}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-danger py-1 px-2 small mb-0">{error}</div>}
    </form>
  );
}

// ─── Modal: elegir almacenes de Logística a sincronizar ───
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
        Selecciona qué almacenes activos de Logística quieres crear/actualizar como fincas.
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
        {!loading && items.length === 0 && <p className="text-center text-secondary small py-4 mb-0">No hay almacenes activos en Logística.</p>}
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
        <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
          <FiX /> Cancelar
        </button>
        <button type="button" disabled={syncing} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={handleSync}>
          <FiRefreshCw /> {syncing ? "Sincronizando..." : "Sincronizar seleccionados"}
        </button>
      </div>
    </ModalShell>
  );
}
