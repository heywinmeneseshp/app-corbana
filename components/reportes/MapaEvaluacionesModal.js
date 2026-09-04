"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { FiMapPin } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";

// Paleta de colores distintos para identificar cada tipo de evaluación en
// el mapa — se asigna en orden de aparición, así que dos fincas muestran el
// mismo color para el mismo tipo mientras no se agreguen más de 10 tipos.
const PALETA_TIPOS = [
  "#2563eb", // azul
  "#dc2626", // rojo
  "#16a34a", // verde
  "#d97706", // ámbar
  "#9333ea", // morado
  "#0891b2", // cian
  "#db2777", // rosa
  "#65a30d", // lima
  "#7c3aed", // violeta
  "#0f766e", // teal
];

function colorDeTipo(nombreTipo, mapaColores) {
  return mapaColores[nombreTipo] || "#64748b";
}

// Pin coloreado por CSS (círculo con borde blanco) en vez del ícono PNG por
// defecto de Leaflet — así cada tipo de evaluación se distingue por color
// sin tener que generar/alojar un ícono de imagen distinto por tipo.
function crearIconoColor(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:11px;height:11px;border-radius:50%;background:${color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>`,
    iconSize: [11, 11],
    iconAnchor: [5, 5],
    popupAnchor: [0, -5],
  });
}

// Capas de mapa disponibles — todas gratis, sin API key.
const CAPAS = {
  satelite: {
    nombre: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
  relieve: {
    nombre: "Relieve",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
  calles: {
    nombre: "Calles",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
};

function fechaCorta(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

// Modal con mapa de dónde se tomaron las evaluaciones de una finca, con los
// mismos filtros (semana/usuario/lote) que el panel de Indicadores — cada
// evaluación tiene su geolocalización a través de la planta evaluada
// (planta.latitud/longitud, capturada desde la app móvil). Arranca en vista
// satelital (Esri World Imagery), con relieve/topográfico y calles como
// alternativas (botones arriba del mapa), y colorea cada pin según el tipo
// de evaluación.
export default function MapaEvaluacionesModal({ fincaUuid, fincaNombre, semanaUuid, semanaCodigo, usuarioUuid, loteUuid, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [capa, setCapa] = useState("satelite");
  // Tipos de evaluación ocultos del mapa (clic en la leyenda) — vacío =
  // todos visibles.
  const [tiposOcultos, setTiposOcultos] = useState(new Set());
  const [verSinUbicacion, setVerSinUbicacion] = useState(false);

  useEffect(() => {
    if (!fincaUuid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ fincaUuid, limit: "100" });
    if (semanaUuid) params.set("semanaUuid", semanaUuid);
    if (usuarioUuid) params.set("usuarioUuid", usuarioUuid);
    if (loteUuid) params.set("loteUuid", loteUuid);
    apiFetch(`/evaluaciones?${params.toString()}`)
      .then((res) => setItems(res.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fincaUuid, semanaUuid, usuarioUuid, loteUuid]);

  const conUbicacion = useMemo(
    () => items.filter((it) => it.planta?.latitud != null && it.planta?.longitud != null),
    [items],
  );
  const sinUbicacion = useMemo(
    () => items.filter((it) => it.planta?.latitud == null || it.planta?.longitud == null),
    [items],
  );

  // Un color por tipo de evaluación, asignado en orden de aparición.
  const mapaColores = useMemo(() => {
    const mapa = {};
    let i = 0;
    for (const it of conUbicacion) {
      const nombre = it.tipoEvaluacion?.nombre || "Sin tipo";
      if (!mapa[nombre]) {
        mapa[nombre] = PALETA_TIPOS[i % PALETA_TIPOS.length];
        i += 1;
      }
    }
    return mapa;
  }, [conUbicacion]);

  // Un ícono por color usado (no por evaluación) — se arma de una vez a
  // partir de los colores ya asignados en mapaColores.
  const iconosPorColor = useMemo(() => {
    const colores = [...new Set(Object.values(mapaColores))];
    return Object.fromEntries(colores.map((color) => [color, crearIconoColor(color)]));
  }, [mapaColores]);

  const visibles = useMemo(
    () => conUbicacion.filter((it) => !tiposOcultos.has(it.tipoEvaluacion?.nombre || "Sin tipo")),
    [conUbicacion, tiposOcultos],
  );

  function toggleTipo(nombre) {
    setTiposOcultos((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }

  const centro = conUbicacion.length
    ? [
        conUbicacion.reduce((acc, it) => acc + Number(it.planta.latitud), 0) / conUbicacion.length,
        conUbicacion.reduce((acc, it) => acc + Number(it.planta.longitud), 0) / conUbicacion.length,
      ]
    : null;

  return (
    <ModalShell title={`Ubicación de evaluaciones — ${fincaNombre || ""}`} onClose={onClose} fullscreen>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 border-bottom bg-light">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span className="text-secondary small">
            {semanaCodigo ? <>Semana <strong>{semanaCodigo}</strong></> : "Todas las semanas"}
            {" — "}
            {visibles.length} de {items.length} con ubicación
            {tiposOcultos.size > 0 && <> ({conUbicacion.length - visibles.length} oculta(s))</>}
            {sinUbicacion.length > 0 && (
              <>
                {" — "}
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 align-baseline text-decoration-underline"
                  onClick={() => setVerSinUbicacion((v) => !v)}
                >
                  {sinUbicacion.length} sin ubicación
                </button>
              </>
            )}
          </span>
          {!loading && !error && conUbicacion.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {Object.entries(mapaColores).map(([nombre, color]) => {
                const oculto = tiposOcultos.has(nombre);
                return (
                  <button
                    key={nombre}
                    type="button"
                    className="btn btn-sm d-flex align-items-center gap-2 rounded-pill border py-0"
                    style={{
                      opacity: oculto ? 0.45 : 1,
                      borderColor: "#e2e8f0",
                      background: oculto ? "#f1f5f9" : "#fff",
                    }}
                    onClick={() => toggleTipo(nombre)}
                    title={oculto ? `Mostrar ${nombre}` : `Ocultar ${nombre}`}
                  >
                    <span
                      className="rounded-circle d-inline-block"
                      style={{ width: 9, height: 9, background: color, border: "2px solid #fff", boxShadow: "0 0 0 1px #cbd5e1" }}
                    />
                    <span className="small">{nombre}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {!loading && !error && conUbicacion.length > 0 && (
          <div className="btn-group btn-group-sm" role="group">
            {Object.entries(CAPAS).map(([clave, def]) => (
              <button
                key={clave}
                type="button"
                className={`btn ${capa === clave ? "btn-brand" : "btn-outline-secondary"}`}
                onClick={() => setCapa(clave)}
              >
                {def.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {verSinUbicacion && sinUbicacion.length > 0 && (
        <div className="px-3 py-2 border-bottom bg-white" style={{ maxHeight: "9rem", overflowY: "auto" }}>
          <div className="small text-secondary mb-1">
            Evaluaciones sin ubicación registrada (planta sin latitud/longitud guardada):
          </div>
          <div className="d-flex flex-wrap gap-2">
            {sinUbicacion.map((it) => (
              <span key={it.uuid} className="badge rounded-pill text-bg-light border small fw-normal">
                {it.planta?.codigo || "Planta"} — {fechaCorta(it.fecha)}
                {it.usuario && <> — {`${it.usuario.nombre || ""} ${it.usuario.apellido || ""}`.trim() || it.usuario.usuario}</>}
                {it.tipoEvaluacion?.nombre && <> — {it.tipoEvaluacion.nombre}</>}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="text-secondary small py-4 text-center">Cargando ubicaciones...</div>}
      {!loading && error && <div className="alert alert-danger py-2 small m-3">{error}</div>}

      {!loading && !error && conUbicacion.length === 0 && (
        <div className="alert alert-info py-2 small d-flex align-items-center gap-2 m-3 mb-0">
          <FiMapPin /> Ninguna evaluación de este filtro tiene ubicación registrada.
        </div>
      )}

      {!loading && !error && conUbicacion.length > 0 && (
        <div className="flex-grow-1" style={{ minHeight: 0 }}>
          <MapContainer center={centro} zoom={16} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer key={capa} attribution={CAPAS[capa].attribution} url={CAPAS[capa].url} maxZoom={CAPAS[capa].maxZoom} />
            {visibles.map((it) => {
                const nombreTipo = it.tipoEvaluacion?.nombre || "Sin tipo";
                const color = colorDeTipo(nombreTipo, mapaColores);
                return (
                  <Marker
                    key={it.uuid}
                    position={[Number(it.planta.latitud), Number(it.planta.longitud)]}
                    icon={iconosPorColor[color]}
                  >
                    <Popup>
                      <div className="small">
                        <div className="fw-bold">{it.planta?.codigo || "Planta"}</div>
                        <div>{fechaCorta(it.fecha)}</div>
                        {it.usuario && (
                          <div className="text-secondary">
                            {`${it.usuario.nombre || ""} ${it.usuario.apellido || ""}`.trim() || it.usuario.usuario}
                          </div>
                        )}
                        <div className="d-flex align-items-center gap-1 mt-1">
                          <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: color }} />
                          {nombreTipo}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        </div>
      )}
    </ModalShell>
  );
}
