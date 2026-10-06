"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { FiMapPin } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { CINTA_POR_ID, USUARIO_POR_ID } from "@/lib/precalibracion/mockData";

// Capas de mapa disponibles — todas gratis, sin API key (mismo patrón que
// components/reportes/MapaEvaluacionesModal.js).
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

// Pin chico con el número de orden: el recorrido se lee en el orden en que
// se tomaron los registros (fecha + hora).
function crearIconoOrden(color, orden) {
  return L.divIcon({
    className: "",
    html: `<div style="min-width:18px;height:18px;border-radius:9px;background:${color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;">${orden}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

function formatoFecha(fechaIso) {
  if (!fechaIso) return "";
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Recorrido de calibración en el mapa: cada punto es un racimo registrado,
// unidos en el orden de captura (fecha + hora) con la ruta trazada. Los
// colores distinguen la cinta presionada (clic en la leyenda para
// ocultar/mostrar cintas).
export default function MapaRecorridoModal({ titulo, registros = [], onClose }) {
  const [capa, setCapa] = useState("satelite");
  const [cintasOcultas, setCintasOcultas] = useState(new Set());
  const [verRuta, setVerRuta] = useState(true);

  const ordenados = useMemo(() => {
    const conUbicacion = registros.filter((r) => r.lat != null && r.lng != null);
    return [...conUbicacion].sort((a, b) =>
      a.fecha === b.fecha ? (a.hora < b.hora ? -1 : 1) : a.fecha < b.fecha ? -1 : 1,
    );
  }, [registros]);

  const visibles = useMemo(
    () => ordenados.filter((r) => !cintasOcultas.has(r.cintaId)),
    [ordenados, cintasOcultas],
  );

  const cintasPresentes = useMemo(() => {
    const mapa = new Map();
    for (const r of ordenados) {
      if (!mapa.has(r.cintaId)) {
        const cinta = CINTA_POR_ID.get(r.cintaId);
        mapa.set(r.cintaId, { id: r.cintaId, nombre: cinta?.nombre || r.cintaId, color: cinta?.color || "#64748b" });
      }
    }
    return [...mapa.values()];
  }, [ordenados]);

  function iconoPara(registro, orden) {
    const cinta = CINTA_POR_ID.get(registro.cintaId);
    return crearIconoOrden(cinta?.color || "#64748b", orden);
  }

  function toggleCinta(cintaId) {
    setCintasOcultas((prev) => {
      const next = new Set(prev);
      if (next.has(cintaId)) next.delete(cintaId);
      else next.add(cintaId);
      return next;
    });
  }

  const rutaPosiciones = useMemo(
    () => visibles.map((r) => [Number(r.lat), Number(r.lng)]),
    [visibles],
  );

  const centro = ordenados.length
    ? [
        ordenados.reduce((acc, r) => acc + Number(r.lat), 0) / ordenados.length,
        ordenados.reduce((acc, r) => acc + Number(r.lng), 0) / ordenados.length,
      ]
    : null;

  // El orden global se numera sobre el recorrido completo (con todas las
  // cintas visibles); si se oculta una cinta, los visibles conservan su
  // número original para no reordenar la lectura.
  const ordenPorId = useMemo(() => {
    const mapa = new Map();
    ordenados.forEach((r, i) => mapa.set(r.id, i + 1));
    return mapa;
  }, [ordenados]);

  return (
    <ModalShell title={titulo || "Recorrido de calibración"} onClose={onClose} fullscreen>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 border-bottom bg-light">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span className="text-secondary small">
            {visibles.length} de {ordenados.length} registros en el recorrido
            {cintasOcultas.size > 0 && <> ({ordenados.length - visibles.length} oculto(s))</>}
          </span>
          {cintasPresentes.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {cintasPresentes.map((c) => {
                const oculta = cintasOcultas.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="btn btn-sm d-flex align-items-center gap-2 rounded-pill border py-0"
                    style={{
                      opacity: oculta ? 0.45 : 1,
                      borderColor: "#e2e8f0",
                      background: oculta ? "#f1f5f9" : "#fff",
                    }}
                    onClick={() => toggleCinta(c.id)}
                    title={oculta ? `Mostrar ${c.nombre}` : `Ocultar ${c.nombre}`}
                  >
                    <span
                      className="rounded-circle d-inline-block"
                      style={{ width: 9, height: 9, background: c.color, border: "2px solid #fff", boxShadow: "0 0 0 1px #cbd5e1" }}
                    />
                    <span className="small">{c.nombre}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {ordenados.length > 0 && (
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm ${verRuta ? "btn-brand" : "btn-outline-secondary"}`}
              onClick={() => setVerRuta((v) => !v)}
              disabled={visibles.length < 2}
              title={
                visibles.length < 2
                  ? "Se necesitan al menos 2 registros visibles para trazar la ruta"
                  : "Conecta los puntos en el orden en que se tomaron"
              }
            >
              {verRuta ? "Ocultar ruta" : "Ver ruta"}
            </button>
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
          </div>
        )}
      </div>

      {ordenados.length === 0 && (
        <div className="alert alert-info py-2 small d-flex align-items-center gap-2 m-3 mb-0">
          <FiMapPin /> Ningún registro de esta selección tiene ubicación registrada.
        </div>
      )}

      {centro && (
        <div className="flex-grow-1" style={{ minHeight: 0 }}>
          <MapContainer center={centro} zoom={16} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer key={capa} attribution={CAPAS[capa].attribution} url={CAPAS[capa].url} maxZoom={CAPAS[capa].maxZoom} />
            {verRuta && visibles.length >= 2 && (
              <Polyline
                positions={rutaPosiciones}
                pathOptions={{ color: capa === "satelite" ? "#ffffff" : "#000000", weight: 2, opacity: 0.9, dashArray: "6 6" }}
              />
            )}
            {visibles.map((r) => {
              const cinta = CINTA_POR_ID.get(r.cintaId);
              const orden = ordenPorId.get(r.id);
              return (
                <Marker
                  key={r.id}
                  position={[Number(r.lat), Number(r.lng)]}
                  icon={iconoPara(r, orden)}
                >
                  <Popup>
                    <div className="small">
                      <div className="fw-bold">Orden #{orden}</div>
                      <div>
                        {formatoFecha(r.fecha)} — {r.hora}
                      </div>
                      <div className="text-secondary">{USUARIO_POR_ID.get(r.usuarioId)?.nombre || "—"}</div>
                      <div className="d-flex align-items-center gap-1 mt-1">
                        <span
                          className="rounded-circle d-inline-block"
                          style={{ width: 8, height: 8, background: cinta?.color || "#64748b" }}
                        />
                        {cinta?.nombre || "—"} / S{r.edad}
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
