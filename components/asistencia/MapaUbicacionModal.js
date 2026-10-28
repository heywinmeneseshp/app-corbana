"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import { normalizarPerimetro } from "@/lib/kml";

// Satélite de Esri (gratis, sin API key), el mismo del mapa de evaluaciones.
const SATELITE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
};

const punto = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.6);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
const iconoMarcacion = punto("#dc2626"); // rojo: donde se marcó
const iconoSitio = punto("#16a34a"); // verde: ubicación guardada de la finca o el lugar
const numero = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

// Encuadra el punto de la marcación y, si hay, el perímetro de la finca y su punto guardado.
function Encuadre({ marca, perimetro, sitio }) {
  const map = useMap();
  useEffect(() => {
    const puntos = [[marca.lat, marca.lng], ...(perimetro || []), ...(sitio ? [[sitio.lat, sitio.lng]] : [])];
    if (puntos.length > 1) map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 18 });
    else map.setView([marca.lat, marca.lng], 17);
  }, [map, marca, perimetro, sitio]);
  return null;
}

// Mapa satelital con el punto GPS donde se hizo una marcación (rojo) y la ubicación guardada del sitio (verde): latitud/longitud
// de la finca o del lugar (oficina...). Si es una finca con KML, también su perímetro.
// `punto`: { lat, lng, titulo, detalle, fincaUuid?, lugarUuid? }.
export default function MapaUbicacionModal({ punto, onClose }) {
  const [perimetro, setPerimetro] = useState(null);
  const [sitio, setSitio] = useState(null); // { lat, lng, nombre }
  const [cargando, setCargando] = useState(Boolean(punto.fincaUuid || punto.lugarUuid));

  useEffect(() => {
    if (!punto.fincaUuid && !punto.lugarUuid) return undefined;
    let activo = true;
    const conCoordenadas = (lat, lng, nombre) => (numero(lat) !== null && numero(lng) !== null ? { lat: numero(lat), lng: numero(lng), nombre } : null);
    const pedir = punto.fincaUuid
      ? apiFetch(`/fincas/${punto.fincaUuid}`).then((f) => {
          if (!activo) return;
          setPerimetro(normalizarPerimetro(f.perimetro));
          setSitio(conCoordenadas(f.latitud, f.longitud, f.nombre));
        })
      : apiFetch("/asistencia/lugares").then((lista) => {
          const l = (lista || []).find((x) => x.uuid === punto.lugarUuid);
          if (activo && l) setSitio(conCoordenadas(l.lat, l.lng, l.nombre));
        });
    pedir.catch(() => {}).finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [punto.fincaUuid, punto.lugarUuid]);

  const { lat, lng, titulo, detalle } = punto;
  const conPerimetro = perimetro && perimetro.length > 2;

  return (
    <ModalShell title={titulo} onClose={onClose} width="80vw" height="80vh" minHeight="80vh">
      <div>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 small mb-2">
          <span className="text-secondary">
            {detalle}
            {punto.fincaUuid && !cargando && !conPerimetro && " · la finca no tiene perímetro (KML) cargado"}
            {(punto.fincaUuid || punto.lugarUuid) && !cargando && !sitio && " · sin latitud/longitud guardada del sitio"}
          </span>
          <span className="d-flex flex-wrap gap-3 align-items-center">
            <span className="d-inline-flex align-items-center gap-1">
              <span className="rounded-circle" style={{ width: 10, height: 10, background: "#dc2626" }} /> Marcación
            </span>
            {sitio && (
              <span className="d-inline-flex align-items-center gap-1">
                <span className="rounded-circle" style={{ width: 10, height: 10, background: "#16a34a" }} /> {sitio.nombre}
              </span>
            )}
            <span className="text-secondary">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
            <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
              Abrir en Google Maps
            </a>
          </span>
        </div>
        {/* 80 % de la pantalla menos el título y la barra de datos */}
        <div className="rounded-3 overflow-hidden border" style={{ height: "calc(80vh - 9.5rem)", minHeight: 300 }}>
          <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer url={SATELITE.url} attribution={SATELITE.attribution} maxZoom={19} />
            {conPerimetro && <Polygon positions={perimetro} pathOptions={{ color: "#facc15", weight: 3, fillOpacity: 0.08 }} />}
            {sitio && (
              <Marker position={[sitio.lat, sitio.lng]} icon={iconoSitio}>
                <Tooltip direction="bottom" offset={[0, 8]} permanent>
                  {sitio.nombre}
                </Tooltip>
              </Marker>
            )}
            <Marker position={[lat, lng]} icon={iconoMarcacion}>
              <Tooltip direction="top" offset={[0, -8]} permanent>
                {titulo}
              </Tooltip>
            </Marker>
            <Encuadre marca={punto} perimetro={conPerimetro ? perimetro : null} sitio={sitio} />
          </MapContainer>
        </div>
      </div>
    </ModalShell>
  );
}
