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
  FiClock,
  FiMap,
  FiUpload,
  FiDownload,
} from "react-icons/fi";
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip } from "react-leaflet";
import ExcelJS from "exceljs";
import { apiFetch, apiFetchFormData } from "@/lib/api";
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
  const [areasMasivoModal, setAreasMasivoModal] = useState(false);
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
      const { items } = await apiFetch(`/fincas?limit=100&incluirAreas=true${search ? `&search=${encodeURIComponent(search)}` : ""}`);
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
        {hasPermission("area_lote.actualizar_masivo") && (
          <button
            type="button"
            className="btn btn-light btn-sm rounded-3 text-nowrap d-flex align-items-center gap-2 px-3 text-secondary"
            onClick={() => setAreasMasivoModal(true)}
            title="Actualizar el área de muchos lotes a la vez con un Excel"
          >
            <FiUpload size={15} /> Actualizar áreas
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
                <th className="fw-medium text-end">Área total (Ha)</th>
                <th className="fw-medium text-end">En producción (Ha)</th>
                <th className="fw-medium text-center">Plot</th>
                <th className="fw-medium text-center">Acciones</th>
                <th className="fw-medium text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && fincas.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-secondary py-4">
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
                    <td className="text-end small text-nowrap" title={`Suma de los ${finca.totalLotes ?? 0} lote(s) activos`}>
                      {Number(finca.areaTotal) > 0 ? Number(finca.areaTotal).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                    </td>
                    <td className="text-end small text-nowrap" title="Suma de la última área en producción registrada de cada lote activo">
                      {Number(finca.areaProduccion) > 0 ? Number(finca.areaProduccion).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
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
      {areasMasivoModal && <AreasMasivoModal onClose={() => setAreasMasivoModal(false)} onDone={loadFincas} />}

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
  const [eventos, setEventos] = useState([]); // todas las actualizaciones de área de la finca (semana desc, último primero)
  const [valores, setValores] = useState({}); // `${loteUuid}|total|produccion` -> string
  const [base, setBase] = useState({}); // valores originales de la semana elegida (para detectar cambios)
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(null); // loteUuid con el formulario de nombre/código abierto
  const [agregando, setAgregando] = useState(false);
  const [nuevoLote, setNuevoLote] = useState("");
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [tab, setTab] = useState("lotes"); // "lotes" | "historico"
  const [semanas, setSemanas] = useState([]); // semanas hasta la actual, de la más reciente a la más antigua
  const [semanaSel, setSemanaSel] = useState(""); // uuid de la semana que se está editando
  const [filtroLote, setFiltroLote] = useState("");
  const [filtroSemana, setFiltroSemana] = useState("");
  const [detalleAbierto, setDetalleAbierto] = useState(null); // `${loteUuid}|${semanaUuid}` con el detalle por día abierto
  const esAdmin = (getCurrentUser()?.roles || []).includes("Administrador");
  const puedeEditar = hasPermission("lote.editar");
  const puedeCrear = hasPermission("lote.crear");
  // Sin este permiso solo se edita la semana actual (el Administrador ya los tiene todos).
  const puedeSemanasAnteriores = hasPermission("area_lote.editar_semanas_anteriores");

  // Cada registro de área pertenece a una SEMANA: lo que se guarda hoy queda en
  // la semana actual; con permiso se puede editar una semana anterior. La
  // papelera OCULTA el lote (queda inactivo; no se borra).
  const semanaActual = semanas[0] || null;
  const semanaElegida = semanas.find((s) => s.uuid === semanaSel) || semanaActual;
  const editandoActual = !semanaElegida || !semanaActual || semanaElegida.uuid === semanaActual.uuid;
  const ocultos = lotes.filter((l) => !l.estado || l.deletedAt);
  const visibles = mostrarOcultos ? lotes : lotes.filter((l) => l.estado && !l.deletedAt);
  const lotePorUuid = new Map(lotes.map((l) => [l.uuid, l]));

  const setValor = (loteUuid, campo, valor) => setValores((prev) => ({ ...prev, [`${loteUuid}|${campo}`]: valor }));

  // Valor vigente de un lote en una semana: el último registro de esa semana o,
  // si no tiene, el de la última semana anterior que sí tenga. `eventos` viene
  // ordenado de la semana más reciente a la más antigua.
  function vigenteEn(loteUuid, semana) {
    if (!semana) return null;
    return eventos.find((e) => e.lote?.uuid === loteUuid && e.semana && e.semana.fechaInicio <= semana.fechaInicio) || null;
  }

  // Valores de las filas para la semana elegida.
  function calcularValores(items, evs, semana, esActual) {
    const out = {};
    for (const l of items) {
      const ev = semana ? evs.find((e) => e.lote?.uuid === l.uuid && e.semana && e.semana.fechaInicio <= semana.fechaInicio) : null;
      // Semana actual: el total es el del lote; semana anterior: el total que tenía ese registro.
      const total = esActual ? (l.area != null ? String(Number(l.area)) : "") : ev && ev.areaTotal != null ? String(Number(ev.areaTotal)) : "";
      out[`${l.uuid}|total`] = total;
      out[`${l.uuid}|produccion`] = ev ? String(Number(ev.area)) : "";
    }
    return out;
  }

  async function loadTodo(semanaParaCalcular) {
    setLoading(true);
    setError("");
    try {
      const incluirParam = esAdmin && mostrarOcultos ? "&incluirEliminados=true" : "";
      const [{ items }, historial, semanasRes] = await Promise.all([
        apiFetch(`/fincas/${finca.uuid}/lotes?limit=100${incluirParam}`),
        apiFetch(`/fincas/${finca.uuid}/lotes/area-historial?limit=1000`),
        semanas.length ? Promise.resolve(null) : apiFetch(`/semanas?limit=100&anio=${new Date().getFullYear()}`),
      ]);
      let lista = semanas;
      if (semanasRes) {
        const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });
        lista = (semanasRes.items || []).filter((s) => s.fechaInicio <= hoy).sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1));
        setSemanas(lista);
      }
      const actual = lista[0] || null;
      const elegida = semanaParaCalcular || lista.find((s) => s.uuid === semanaSel) || actual;
      const esActual = !elegida || !actual || elegida.uuid === actual.uuid;
      const vals = calcularValores(items, historial.items, elegida, esActual);
      setLotes(items);
      setEventos(historial.items);
      setValores(vals);
      setBase(vals);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarOcultos]);

  // Cambiar de semana: precarga las filas con lo vigente en esa semana.
  function elegirSemana(uuid) {
    setSemanaSel(uuid);
    setAviso("");
    const sem = semanas.find((s) => s.uuid === uuid) || semanaActual;
    const esActual = !semanaActual || sem.uuid === semanaActual.uuid;
    const vals = calcularValores(lotes, eventos, sem, esActual);
    setValores(vals);
    setBase(vals);
  }

  const cambioTotal = (l) => (valores[`${l.uuid}|total`] ?? "") !== (base[`${l.uuid}|total`] ?? "");
  const cambioProd = (l) => (valores[`${l.uuid}|produccion`] ?? "") !== (base[`${l.uuid}|produccion`] ?? "");
  const hayCambios = lotes.some((l) => !l.deletedAt && (cambioTotal(l) || cambioProd(l)));

  async function handleGuardar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    setGuardando(true);
    try {
      let guardados = 0;
      for (const l of lotes) {
        if (l.deletedAt) continue;
        const cT = cambioTotal(l);
        const cP = cambioProd(l);
        if (!cT && !cP) continue;
        const t = valores[`${l.uuid}|total`];
        const p = valores[`${l.uuid}|produccion`];
        // El total del lote solo se actualiza al editar la semana actual.
        if (cT && editandoActual) {
          await apiFetch(`/lotes/${l.uuid}`, { method: "PUT", body: JSON.stringify({ area: t === "" ? null : Number(t) }) });
        }
        // Cada actualización queda en el histórico, en la semana elegida; si el
        // campo de producción está vacío se conserva la vigente en esa semana.
        const vig = vigenteEn(l.uuid, semanaElegida);
        const prodVal = p !== "" && !Number.isNaN(Number(p)) ? Number(p) : vig ? Number(vig.area) : null;
        if (prodVal !== null) {
          await apiFetch(`/lotes/${l.uuid}/area-produccion`, {
            method: "POST",
            body: JSON.stringify({
              area: prodVal,
              areaTotal: t === "" ? null : Number(t),
              ...(editandoActual ? {} : { semanaUuid: semanaElegida.uuid }),
            }),
          });
        }
        guardados++;
      }
      await loadTodo(semanaElegida);
      setAviso(guardados > 0 ? `Cambios guardados en la semana ${semanaElegida?.codigo || "actual"}.` : "No había cambios por guardar.");
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
        const vacios = { [`${nuevo.uuid}|total`]: "", [`${nuevo.uuid}|produccion`]: "" };
        setValores((prev) => ({ ...prev, ...vacios }));
        setBase((prev) => ({ ...prev, ...vacios }));
      }
      setNuevoLote("");
      setAgregando(false);
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Histórico semanal: una fila por lote y semana con el dato más
  // actualizado de esa semana; el reloj abre el detalle de ediciones por día.
  const grupos = (() => {
    const mapa = new Map();
    for (const ev of eventos) {
      if (!ev.lote) continue;
      const clave = `${ev.lote.uuid}|${ev.semana?.uuid || "sin"}`;
      if (!mapa.has(clave)) mapa.set(clave, { clave, lote: ev.lote, semana: ev.semana, ultimo: ev, ediciones: [] });
      mapa.get(clave).ediciones.push(ev);
    }
    return [...mapa.values()];
  })();
  const gruposFiltrados = grupos.filter((g) => (!filtroLote || g.lote.uuid === filtroLote) && (!filtroSemana || (g.semana?.uuid || "sin") === filtroSemana));
  const nombreUsuario = (u) => (u ? `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario : "—");
  const semanasConDatos = [...new Map(grupos.filter((g) => g.semana).map((g) => [g.semana.uuid, g.semana])).values()];

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 1050 }}
    >
      <div className="bg-white rounded-4 shadow-lg p-4 p-md-5" style={{ maxWidth: tab === "historico" ? 820 : 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <FiMap className="text-primary" size={22} />
            <h2 className="h5 fw-bold mb-0">Lotes de {finca.nombre}</h2>
          </div>
          <button type="button" className="btn btn-sm p-1 border-0 text-secondary" title="Cerrar" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 ${tab === "lotes" ? "active" : ""}`} onClick={() => setTab("lotes")}>
              Lotes
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 ${tab === "historico" ? "active" : ""}`} onClick={() => setTab("historico")}>
              Histórico de áreas
            </button>
          </li>
        </ul>

        {tab === "historico" && (
          <div>
            <p className="text-secondary small mb-2">
              Área semanal de cada lote: se muestra el dato más actualizado de la semana. Con el reloj ves las ediciones de esa semana, día por día.
            </p>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <select className="form-select form-select-sm bg-white" style={{ width: "auto" }} value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)}>
                <option value="">Todos los lotes</option>
                {lotes
                  .slice()
                  .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { numeric: true }))
                  .map((l) => (
                    <option key={l.uuid} value={l.uuid}>
                      Lote {l.nombre}
                    </option>
                  ))}
              </select>
              <select className="form-select form-select-sm bg-white" style={{ width: "auto" }} value={filtroSemana} onChange={(e) => setFiltroSemana(e.target.value)}>
                <option value="">Todas las semanas</option>
                {semanasConDatos.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
              <span className="small text-secondary">{gruposFiltrados.length} registro(s)</span>
            </div>
            {loading && <p className="small text-secondary">Cargando...</p>}
            {!loading && (
              <div className="table-responsive" style={{ maxHeight: "55vh" }}>
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.8125rem" }}>
                  <thead>
                    <tr className="table-light small text-secondary">
                      <th>Semana</th>
                      <th>Lote</th>
                      <th className="text-end">Total (Ha)</th>
                      <th className="text-end">En producción (Ha)</th>
                      <th>Última edición</th>
                      <th style={{ width: "2rem" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruposFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-secondary py-3">
                          Todavía no hay actualizaciones de área registradas.
                        </td>
                      </tr>
                    )}
                    {gruposFiltrados.map((g) => (
                      <Fragment key={g.clave}>
                        <tr>
                          <td className="text-nowrap fw-medium">{g.semana?.codigo || "—"}</td>
                          <td>Lote {g.lote.nombre}</td>
                          <td className="text-end">{g.ultimo.areaTotal != null ? Number(g.ultimo.areaTotal).toFixed(2) : ""}</td>
                          <td className="text-end">{Number(g.ultimo.area).toFixed(2)}</td>
                          <td className="small text-secondary">
                            {g.ultimo.fechaRegistro} · {nombreUsuario(g.ultimo.creadoPor)}
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className={`btn btn-sm p-0 border-0 ${detalleAbierto === g.clave ? "text-primary" : "text-secondary"}`}
                              title={`Ver las ${g.ediciones.length} edición(es) de esta semana`}
                              onClick={() => setDetalleAbierto(detalleAbierto === g.clave ? null : g.clave)}
                            >
                              <FiClock size={14} />
                            </button>
                          </td>
                        </tr>
                        {detalleAbierto === g.clave && (
                          <tr>
                            <td colSpan={6} className="bg-light p-2">
                              <div className="small fw-medium text-secondary mb-1">
                                Ediciones de la semana {g.semana?.codigo || "—"} — Lote {g.lote.nombre} (día por día)
                              </div>
                              <table className="table table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                                <thead>
                                  <tr className="text-secondary">
                                    <th>Día</th>
                                    <th className="text-end">Total (Ha)</th>
                                    <th className="text-end">En producción (Ha)</th>
                                    <th>Registró</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.ediciones.map((ev) => (
                                    <tr key={ev.uuid || ev.id}>
                                      <td className="text-nowrap">{ev.fechaRegistro}</td>
                                      <td className="text-end">{ev.areaTotal != null ? Number(ev.areaTotal).toFixed(2) : ""}</td>
                                      <td className="text-end">{Number(ev.area).toFixed(2)}</td>
                                      <td>{nombreUsuario(ev.creadoPor)}</td>
                                      <td>
                                        {ev.semana && ev.fechaRegistro > ev.semana.fechaFin && (
                                          <span className="badge text-bg-warning" title="Se guardó después de terminar esa semana">
                                            Retroactiva
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "lotes" && (
          <>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <span className="small text-secondary">Semana:</span>
              <select
                className="form-select form-select-sm bg-white"
                style={{ width: "auto" }}
                value={semanaElegida?.uuid || ""}
                onChange={(e) => elegirSemana(e.target.value)}
                disabled={!puedeSemanasAnteriores || semanas.length <= 1}
                title={puedeSemanasAnteriores ? "Elige la semana que quieres editar" : "Solo puedes editar la semana actual"}
              >
                {semanas.map((s, i) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                    {i === 0 ? " (actual)" : ""}
                  </option>
                ))}
              </select>
              {!editandoActual && (
                <span className="badge text-bg-warning">Editando una semana anterior: el cambio queda en {semanaElegida.codigo}</span>
              )}
            </div>
            <p className="text-secondary small mb-4">
              Código de la finca: {finca.codigo}. Edita el área total y el área en producción de cada lote
              {editandoActual ? " (se guarda en la semana actual)" : ` (semana ${semanaElegida?.codigo})`}.
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

              {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
              {aviso && !error && <div className="alert alert-success py-2 small mt-3 mb-0">{aviso}</div>}

              {puedeEditar && (
                <button type="submit" className="btn btn-brand btn-sm w-100 rounded-3 mt-4" disabled={!hayCambios || guardando}>
                  {guardando ? "Guardando..." : editandoActual ? "Guardar cambios" : `Guardar cambios en ${semanaElegida?.codigo}`}
                </button>
              )}
            </form>
          </>
        )}
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

// ─── Modal: actualización masiva de áreas (Excel) ───
// La SEMANA a actualizar va en el propio Excel: columna `semana` obligatoria en
// cada fila (ej. S41-2026). Pasos: 1) descargar la plantilla, 2) editarla
// (escribiendo la semana en cada fila), 3) subirla, 4) validar (vista previa
// con errores) y 5) aplicar.
function AreasMasivoModal({ onClose, onDone }) {
  const [archivo, setArchivo] = useState(null);
  const [resultado, setResultado] = useState(null); // respuesta de la validación o de la aplicación
  const [aplicado, setAplicado] = useState(false);
  const [trabajando, setTrabajando] = useState("");
  const [error, setError] = useState("");

  async function descargarPlantilla() {
    setError("");
    setTrabajando("plantilla");
    try {
      const { filas, semanaActual } = await apiFetch("/lotes/area-plantilla");
      const BRAND = "FF15803D";
      const wb = new ExcelJS.Workbook();
      wb.creator = "Corbana";
      const ws = wb.addWorksheet("Áreas", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "codigo_finca", key: "codigoFinca", width: 14 },
        { header: "finca", key: "finca", width: 22 },
        { header: "lote", key: "lote", width: 10 },
        { header: "semana", key: "semana", width: 14 },
        { header: "area_total", key: "areaTotal", width: 14 },
        { header: "area_en_produccion", key: "areaProduccion", width: 20 },
      ];
      ws.getRow(1).eachCell((c) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      // La semana va vacía a propósito: hay que escribirla en cada fila a actualizar.
      ws.getCell("D1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45309" } };
      for (const f of filas) ws.addRow({ ...f, semana: "" });
      ws.getColumn("finca").font = { color: { argb: "FF64748B" } };

      const ins = wb.addWorksheet("Instrucciones");
      ins.getColumn(1).width = 115;
      [
        "Actualización masiva de áreas por semana",
        `La columna semana es OBLIGATORIA en cada fila que quieras actualizar: escribe el código de la semana (ej. ${semanaActual || "S41-2026"}). Una misma carga puede incluir semanas distintas.`,
        "Edita area_total y area_en_produccion (en hectáreas). No cambies codigo_finca ni lote: con eso se identifica cada lote. La columna finca es solo informativa.",
        "Los valores de la plantilla son los vigentes hoy. Si dejas una celda de área vacía, se conserva el valor vigente de la semana escrita. El 0 es un valor válido.",
        "Las filas sin semana se reportan como error al validar; las filas sin cambios de área se omiten.",
        "El área total del lote solo se actualiza cuando la semana escrita es la actual; en semanas anteriores solo queda en el histórico de esa semana.",
        "No se pueden actualizar semanas futuras.",
      ].forEach((t, i) => {
        const r = ins.getRow(i + 1);
        r.getCell(1).value = t;
        r.getCell(1).alignment = { wrapText: true, vertical: "top" };
        if (i === 0) r.getCell(1).font = { bold: true, size: 13 };
      });

      const buffer = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_areas.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando("");
    }
  }

  async function enviar(dryRun) {
    setError("");
    setTrabajando(dryRun ? "validar" : "aplicar");
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("dryRun", dryRun ? "true" : "false");
      const res = await apiFetchFormData("/lotes/area-bulk-upload", fd);
      setResultado(res);
      if (!dryRun) {
        setAplicado(true);
        onDone?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando("");
    }
  }

  const puedeAplicar = resultado?.dryRun && resultado.actualizados > 0 && !aplicado;

  return (
    <ModalShell title="Actualizar áreas de lotes (masivo)" onClose={onClose} size="lg">
      <p className="small text-secondary mb-3">
        Actualiza el área total y el área en producción de muchos lotes a la vez con un Excel. En el Excel es <strong>obligatorio escribir la semana</strong>{" "}
        a actualizar en cada fila (columna <code>semana</code>, ej. S41-2026); el cambio queda en el histórico de esa semana.
      </p>

      <div className="mb-3">
        <label className="form-label small fw-medium d-block">1. Descarga la plantilla</label>
        <button type="button" className="btn btn-light btn-sm rounded-3 d-inline-flex align-items-center gap-2" disabled={trabajando === "plantilla"} onClick={descargarPlantilla}>
          <FiDownload size={14} /> {trabajando === "plantilla" ? "Generando..." : "Descargar plantilla con las áreas vigentes"}
        </button>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-medium">2. Sube el Excel editado</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="form-control form-control-sm"
          onChange={(e) => {
            setArchivo(e.target.files?.[0] || null);
            setResultado(null);
            setAplicado(false);
          }}
        />
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="d-flex gap-2 mb-3">
        <button type="button" className="btn btn-light btn-sm rounded-3" disabled={!archivo || trabajando !== "" || aplicado} onClick={() => enviar(true)}>
          {trabajando === "validar" ? "Validando..." : "3. Validar"}
        </button>
        <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={!puedeAplicar || trabajando !== ""} onClick={() => enviar(false)}>
          {trabajando === "aplicar" ? "Aplicando..." : "4. Aplicar actualización"}
        </button>
      </div>

      {resultado && (
        <div>
          <div className={`alert py-2 small ${aplicado ? "alert-success" : resultado.actualizados > 0 ? "alert-info" : "alert-warning"}`}>
            {aplicado
              ? `Listo: se actualizaron ${resultado.actualizados} registro(s) en ${resultado.semanas.join(", ")}.`
              : `Validación: ${resultado.actualizados} registro(s) listos para actualizar${resultado.semanas.length ? ` (${resultado.semanas.join(", ")})` : ""}, ${resultado.errores.length} fila(s) con error (se omiten).`}
          </div>

          {resultado.errores.length > 0 && (
            <div className="mb-3">
              <div className="small fw-medium text-danger mb-1">Filas con error</div>
              <ul className="small text-secondary mb-0" style={{ maxHeight: "9rem", overflowY: "auto" }}>
                {resultado.errores.map((e) => (
                  <li key={`${e.fila}-${e.error}`}>
                    Fila {e.fila}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.vistaPrevia.length > 0 && (
            <div className="table-responsive" style={{ maxHeight: "14rem" }}>
              <table className="table table-sm mb-0" style={{ fontSize: "0.78rem" }}>
                <thead>
                  <tr className="text-secondary">
                    <th>Fila</th>
                    <th>Semana</th>
                    <th>Finca</th>
                    <th>Lote</th>
                    <th className="text-end">Total (Ha)</th>
                    <th className="text-end">En producción (Ha)</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.vistaPrevia.map((r) => (
                    <tr key={r.fila}>
                      <td>{r.fila}</td>
                      <td className="fw-medium">{r.semana}</td>
                      <td>{r.codigoFinca}</td>
                      <td>{r.lote}</td>
                      <td className="text-end">{r.areaTotal !== null && r.areaTotal !== undefined ? Number(r.areaTotal).toFixed(2) : ""}</td>
                      <td className="text-end">{Number(r.areaProduccion).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="d-flex justify-content-end mt-3">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
          {aplicado ? "Cerrar" : "Cancelar"}
        </button>
      </div>
    </ModalShell>
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
