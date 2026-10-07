"use client";

import { useEffect, useState } from "react";
import {
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiGrid,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiMap,
  FiUpload,
  FiDownload,
} from "react-icons/fi";
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip } from "react-leaflet";
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
  const [mapaFincasOpen, setMapaFincasOpen] = useState(false); // mapa con las coordenadas de todas las fincas
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
          <button type="button" className="btn btn-brand btn-sm rounded-3 text-nowrap d-flex align-items-center gap-2 px-3" onClick={() => setFincaModal({})}>
            <FiPlus size={15} /> Nueva Finca
          </button>
        )}
        {hasPermission("finca.crear") && (
          <button
            type="button"
            className="btn btn-light btn-sm rounded-3 text-nowrap d-flex align-items-center gap-2 px-3 text-secondary"
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
              <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                <th className="fw-medium" style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={fincas.length > 0 && selected.size === fincas.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="fw-medium">Finca</th>
                <th className="fw-medium text-center">
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 fw-medium text-secondary text-decoration-none"
                    onClick={() => setMapaFincasOpen(true)}
                    title="Ver todas las fincas en un mapa"
                  >
                    Coordenadas
                  </button>
                </th>
                <th className="fw-medium text-center">Plot</th>
                <th className="fw-medium text-center">Acciones</th>
                <th className="fw-medium text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && fincas.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-4">
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
                    <td className="text-center small text-nowrap">
                      {finca.latitud != null && finca.longitud != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${Number(finca.latitud)},${Number(finca.longitud)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver ubicación en Google Maps"
                        >
                          {Number(finca.latitud).toFixed(6)}, {Number(finca.longitud).toFixed(6)}
                        </a>
                      ) : (
                        <span className="text-secondary">—</span>
                      )}
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

      {mapaFincasOpen && <MapaFincasModal fincas={fincas} onClose={() => setMapaFincasOpen(false)} />}
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
  // Coordenadas de la finca (grados decimales) — las usa Open-Meteo.
  const [latitud, setLatitud] = useState(finca?.latitud != null ? String(finca.latitud) : "");
  const [longitud, setLongitud] = useState(finca?.longitud != null ? String(finca.longitud) : "");
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
      const num = (v) => (String(v).trim() === "" ? null : Number(String(v).replace(",", ".")));
      const lat = num(latitud);
      const lng = num(longitud);
      if ((lat === null) !== (lng === null)) {
        setError("Para guardar las coordenadas completa latitud y longitud.");
        setSaving(false);
        return;
      }
      if (lat !== null && (Number.isNaN(lat) || Number.isNaN(lng))) {
        setError("Las coordenadas deben ser números (ej. 7.8800 y -76.6300).");
        setSaving(false);
        return;
      }
      const payload = { nombre, codigo, estado, esExterna, grupoFincaUuid: grupoFincaUuid || null, latitud: lat, longitud: lng };
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
        <div className="mb-3">
          <label className="form-label small fw-medium">Coordenadas (opcional)</label>
          <div className="row g-2">
            <div className="col-6">
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                className="form-control rounded-3"
                placeholder="Latitud (ej. 7.8800)"
                value={latitud}
                onChange={(e) => setLatitud(e.target.value)}
              />
            </div>
            <div className="col-6">
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                className="form-control rounded-3"
                placeholder="Longitud (ej. -76.6300)"
                value={longitud}
                onChange={(e) => setLongitud(e.target.value)}
              />
            </div>
          </div>
          <div className="form-text">Se usan para consultar el clima de la finca en Estación Meteorológica &gt; Open-Meteo.</div>
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
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
            <FiX /> Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1">
            <FiSave /> {saving ? "Guardando..." : "Guardar Finca"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: mapa con las coordenadas de todas las fincas ───
function MapaFincasModal({ fincas, onClose }) {
  const puntos = fincas
    .filter((f) => f.latitud != null && f.longitud != null)
    .map((f) => ({ uuid: f.uuid, nombre: f.nombre, pos: [Number(f.latitud), Number(f.longitud)] }));

  return (
    <ModalShell title={`Ubicación de las fincas (${puntos.length})`} onClose={onClose} fullscreen>
      <div className="flex-grow-1" style={{ minHeight: 0 }}>
        {puntos.length === 0 ? (
          <div className="text-secondary small p-4 text-center">Ninguna finca tiene coordenadas todavía.</div>
        ) : (
          <MapContainer bounds={puntos.map((p) => p.pos)} boundsOptions={{ padding: [50, 50] }} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            {puntos.map((p) => (
              <CircleMarker key={p.uuid} center={p.pos} radius={6} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }}>
                <Tooltip permanent direction="right" offset={[8, 0]}>
                  {p.nombre}
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>
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
  const [aviso, setAviso] = useState("");
  const [areaProdMap, setAreaProdMap] = useState({}); // loteUuid -> último registro de área en producción
  const [valores, setValores] = useState({}); // `${loteUuid}|total|produccion` -> string
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(null); // loteUuid con el formulario de nombre/código abierto
  const [agregando, setAgregando] = useState(false);
  const [nuevoLote, setNuevoLote] = useState("");
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const esAdmin = (getCurrentUser()?.roles || []).includes("Administrador");
  const puedeEditar = hasPermission("lote.editar");
  const puedeCrear = hasPermission("lote.crear");

  // Mismo diseño que el modal "Área de lotes pendiente de confirmar": una fila
  // por lote con Total y En producción, y la papelera OCULTA el lote (queda
  // inactivo; no se borra y sigue en estadísticas e informes).
  const ocultos = lotes.filter((l) => !l.estado || l.deletedAt);
  const visibles = mostrarOcultos ? lotes : lotes.filter((l) => l.estado && !l.deletedAt);

  const setValor = (loteUuid, campo, valor) => setValores((prev) => ({ ...prev, [`${loteUuid}|${campo}`]: valor }));

  function precargar(items, areaMap) {
    const next = {};
    for (const l of items) {
      next[`${l.uuid}|total`] = l.area != null ? String(Number(l.area)) : "";
      const ult = areaMap[l.uuid];
      next[`${l.uuid}|produccion`] = ult ? String(Number(ult.area)) : "";
    }
    return next;
  }

  async function loadLotes() {
    setLoading(true);
    setError("");
    try {
      const incluirParam = esAdmin && mostrarOcultos ? "&incluirEliminados=true" : "";
      const { items } = await apiFetch(`/fincas/${finca.uuid}/lotes?limit=100${incluirParam}`);
      const entries = await Promise.all(
        items
          .filter((lote) => !lote.deletedAt)
          .map(async (lote) => {
            const { items: historial } = await apiFetch(`/lotes/${lote.uuid}/area-produccion?limit=1`);
            return [lote.uuid, historial[0] || null];
          }),
      );
      const areaMap = Object.fromEntries(entries);
      setLotes(items);
      setAreaProdMap(areaMap);
      setValores(precargar(items, areaMap));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarOcultos]);

  // ¿La fila tiene cambios sin guardar?
  const cambioTotal = (l) => (valores[`${l.uuid}|total`] ?? "") !== (l.area != null ? String(Number(l.area)) : "");
  const cambioProd = (l) => {
    const ult = areaProdMap[l.uuid];
    return (valores[`${l.uuid}|produccion`] ?? "") !== (ult ? String(Number(ult.area)) : "");
  };
  const hayCambios = lotes.some((l) => !l.deletedAt && (cambioTotal(l) || cambioProd(l)));

  async function handleGuardar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    setGuardando(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      let guardados = 0;
      for (const l of lotes) {
        if (l.deletedAt) continue;
        if (cambioTotal(l)) {
          const t = valores[`${l.uuid}|total`];
          await apiFetch(`/lotes/${l.uuid}`, { method: "PUT", body: JSON.stringify({ area: t === "" ? null : Number(t) }) });
          guardados++;
        }
        if (cambioProd(l)) {
          const p = valores[`${l.uuid}|produccion`];
          if (p !== "" && !Number.isNaN(Number(p))) {
            await apiFetch(`/lotes/${l.uuid}/area-produccion`, { method: "POST", body: JSON.stringify({ area: Number(p), fecha: hoy }) });
            guardados++;
          }
        }
      }
      await loadLotes();
      setAviso(guardados > 0 ? "Cambios guardados." : "No había cambios por guardar.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // Ocultar = dejar el lote inactivo: no se borra, solo deja de mostrarse.
  async function handleOcultar(lote) {
    if (!confirm(`¿Ocultar el lote ${lote.nombre}? Solo hazlo si no pertenece a esta finca. El lote seguirá existiendo.`)) return;
    setError("");
    try {
      const res = await apiFetch(`/lotes/${lote.uuid}`, { method: "PUT", body: JSON.stringify({ estado: false }) });
      setLotes((prev) => prev.map((l) => (l.uuid === lote.uuid ? res : l)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMostrar(lote) {
    setError("");
    try {
      const res = await apiFetch(`/lotes/${lote.uuid}`, { method: "PUT", body: JSON.stringify({ estado: true }) });
      setLotes((prev) => prev.map((l) => (l.uuid === lote.uuid ? res : l)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRestaurar(lote) {
    if (!confirm(`¿Restaurar el lote ${lote.nombre}?`)) return;
    try {
      const restaurado = await apiFetch(`/lotes/${lote.uuid}/restore`, { method: "POST" });
      setLotes((prev) => prev.map((l) => (l.uuid === lote.uuid ? restaurado : l)));
    } catch (err) {
      setError(err.message);
    }
  }

  // Agregar un lote; si ya existía uno con ese nombre oculto, se vuelve a mostrar.
  async function handleAgregar() {
    const nombre = nuevoLote.trim();
    if (!nombre) return;
    setError("");
    try {
      const oculto = lotes.find((l) => l.nombre === nombre && !l.deletedAt && !l.estado);
      if (oculto) {
        await handleMostrar(oculto);
      } else {
        const nuevo = await apiFetch("/lotes", { method: "POST", body: JSON.stringify({ fincaUuid: finca.uuid, nombre, estado: true }) });
        setLotes((prev) => [...prev, nuevo]);
        setValores((prev) => ({ ...prev, [`${nuevo.uuid}|total`]: "", [`${nuevo.uuid}|produccion`]: "" }));
      }
      setNuevoLote("");
      setAgregando(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 1050 }}
    >
      <div className="bg-white rounded-4 shadow-lg p-4 p-md-5" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <FiMap className="text-primary" size={22} />
            <h2 className="h5 fw-bold mb-0">Lotes de {finca.nombre}</h2>
          </div>
          <button type="button" className="btn btn-sm p-1 border-0 text-secondary" title="Cerrar" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>
        <p className="text-secondary small mb-4">
          Código de la finca: {finca.codigo}. Edita el área total y el área en producción de cada lote.
        </p>

        <form onSubmit={handleGuardar}>
          {loading && <p className="text-secondary small">Cargando...</p>}
          {!loading && visibles.length === 0 && <p className="text-secondary small">Esta finca todavía no tiene lotes.</p>}

          <div className="d-flex flex-column gap-2">
            {!loading &&
              visibles.map((l) => {
                const oculto = !l.estado || l.deletedAt;
                return (
                  <div key={l.uuid}>
                    <div className={`row g-2 align-items-center ${oculto ? "opacity-50" : ""}`}>
                      <div className="col-12 col-md-3">
                        <span className="d-flex align-items-center gap-2">
                          <span className="text-secondary small fw-medium d-block">Lote {l.nombre}</span>
                          {!l.deletedAt && !oculto && puedeEditar && (
                            <>
                              <button type="button" className="btn btn-sm p-0 border-0 text-secondary" title="Editar nombre y código" onClick={() => setEditando(editando === l.uuid ? null : l.uuid)}>
                                <FiEdit2 size={13} />
                              </button>
                              <button type="button" className="btn btn-sm p-0 border-0 text-danger" title="Ocultar lote (no lo borra)" onClick={() => handleOcultar(l)}>
                                <FiTrash2 size={14} />
                              </button>
                            </>
                          )}
                          {oculto && !l.deletedAt && puedeEditar && (
                            <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none small" onClick={() => handleMostrar(l)}>
                              Mostrar
                            </button>
                          )}
                          {l.deletedAt && esAdmin && (
                            <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none small" onClick={() => handleRestaurar(l)}>
                              Restaurar
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">Total</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            placeholder="0.00"
                            disabled={!puedeEditar || oculto}
                            value={valores[`${l.uuid}|total`] ?? ""}
                            onChange={(e) => setValor(l.uuid, "total", e.target.value)}
                          />
                          <span className="input-group-text">Ha</span>
                        </div>
                      </div>
                      <div className="col-12 col-md-5">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">En producción</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            placeholder="0.00"
                            disabled={!puedeEditar || oculto}
                            value={valores[`${l.uuid}|produccion`] ?? ""}
                            onChange={(e) => setValor(l.uuid, "produccion", e.target.value)}
                          />
                          <span className="input-group-text">Ha</span>
                        </div>
                      </div>
                    </div>
                    {editando === l.uuid && (
                      <div className="bg-light rounded-3 px-3 mt-1">
                        <EditarLoteForm
                          lote={l}
                          onSaved={(actualizado) => {
                            setLotes((prev) => prev.map((x) => (x.uuid === actualizado.uuid ? actualizado : x)));
                            setEditando(null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {(puedeCrear || esAdmin) && (
            <div className="mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
              {puedeCrear && (
                <div>
                  {agregando ? (
                    <div className="d-flex gap-2 align-items-center">
                      <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                        <span className="input-group-text">Lote</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-control"
                          placeholder="N.º (ej: 09)"
                          value={nuevoLote}
                          onChange={(e) => setNuevoLote(e.target.value.replace(/\D/g, ""))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAgregar();
                            }
                          }}
                        />
                      </div>
                      <button type="button" className="btn btn-sm btn-brand rounded-3" onClick={handleAgregar}>
                        Agregar
                      </button>
                      <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setAgregando(false)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-sm btn-link text-decoration-none p-0 small d-flex align-items-center gap-1" onClick={() => setAgregando(true)}>
                      <FiPlus size={14} /> Agregar lote
                    </button>
                  )}
                </div>
              )}
              {(esAdmin || ocultos.length > 0) && (
                <label className="form-check small text-secondary mb-0">
                  <input type="checkbox" className="form-check-input" checked={mostrarOcultos} onChange={(e) => setMostrarOcultos(e.target.checked)} />{" "}
                  <span className="form-check-label">Mostrar ocultos{ocultos.length > 0 ? ` (${ocultos.length})` : ""}</span>
                </label>
              )}
            </div>
          )}

          {error && (
            <div className="alert alert-danger py-2 small mt-3 mb-0 d-flex align-items-center gap-2">{error}</div>
          )}
          {aviso && !error && <div className="alert alert-success py-2 small mt-3 mb-0">{aviso}</div>}

          {puedeEditar && (
            <button type="submit" className="btn btn-brand btn-sm w-100 rounded-3 mt-4" disabled={!hayCambios || guardando}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          )}
        </form>
      </div>
    </div>
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
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
          <FiX /> Cancelar
        </button>
        <button type="button" disabled={syncing} className="btn btn-brand btn-sm rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={handleSync}>
          <FiRefreshCw /> {syncing ? "Sincronizando..." : "Sincronizar seleccionados"}
        </button>
      </div>
    </ModalShell>
  );
}
