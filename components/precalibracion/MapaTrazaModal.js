"use client";

// Recorrido real de una sesión de precalibración: la traza GPS que guardó la app de campo mientras estuvo abierta.
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import ModalShell from "@/components/ModalShell";
import { getTrazaSesion } from "@/lib/precalibracion/api";

function AjustarVista({ posiciones }) {
  const map = useMap();
  useEffect(() => {
    if (posiciones.length > 1) map.fitBounds(posiciones, { padding: [30, 30] });
  }, [map, posiciones]);
  return null;
}

export default function MapaTrazaModal({ sesion, onClose }) {
  const [estado, setEstado] = useState({ id: null, puntos: null, error: "" });

  useEffect(() => {
    let vivo = true;
    getTrazaSesion(sesion.id)
      .then((d) => vivo && setEstado({ id: sesion.id, puntos: d.puntos, error: "" }))
      .catch((e) => vivo && setEstado({ id: sesion.id, puntos: null, error: e.message }));
    return () => {
      vivo = false;
    };
  }, [sesion.id]);

  const cargando = estado.id !== sesion.id;
  const posiciones = useMemo(() => (estado.puntos || []).map((p) => [p.lat, p.lng]), [estado.puntos]);
  const hora = (iso) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  return (
    <ModalShell title={`Recorrido — ${sesion.finca} · ${sesion.lote} · ${sesion.usuario}`} onClose={onClose} fullscreen>
      {cargando && <p className="text-secondary p-3">Cargando recorrido...</p>}
      {estado.error && <div className="alert alert-danger m-3 py-2 small">{estado.error}</div>}
      {!cargando && !estado.error && posiciones.length < 2 && (
        <p className="text-secondary p-3">Esta sesión no guardó tracking GPS (se hizo antes de activarlo o sin señal).</p>
      )}
      {posiciones.length > 1 && (
        <div className="flex-grow-1" style={{ minHeight: 0 }}>
          <MapContainer center={posiciones[0]} zoom={17} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxZoom={19}
            />
            <AjustarVista posiciones={posiciones} />
            <Polyline positions={posiciones} pathOptions={{ color: "#facc15", weight: 3 }} />
            <CircleMarker center={posiciones[0]} radius={8} pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1 }}>
              <Tooltip permanent direction="top">Inicio {hora(estado.puntos[0].t)}</Tooltip>
            </CircleMarker>
            <CircleMarker center={posiciones[posiciones.length - 1]} radius={8} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }}>
              <Tooltip permanent direction="top">Fin {hora(estado.puntos[estado.puntos.length - 1].t)}</Tooltip>
            </CircleMarker>
          </MapContainer>
        </div>
      )}
    </ModalShell>
  );
}
