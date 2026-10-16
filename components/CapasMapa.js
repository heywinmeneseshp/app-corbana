"use client";

// Capas de mapa de una finca (vías de cable, canales, parcelas, riego…)
// importadas de un KMZ, dentro de un <MapContainer> de react-leaflet. Un
// control de capas permite prender/apagar cada categoría.
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, LayerGroup, LayersControl, Polygon, Polyline, Tooltip } from "react-leaflet";
import { apiFetch } from "@/lib/api";
import { NOMBRES_CATEGORIA } from "@/lib/kmz";

const ESTILOS = {
  VIA_CABLE: { color: "#f97316", weight: 2 },
  CANAL: { color: "#2563eb", weight: 2 },
  PARCELA: { color: "#16a34a", weight: 1.5, dashArray: "5 4", fillOpacity: 0.05 },
  RIEGO: { color: "#06b6d4", weight: 1.5, fillOpacity: 0.08 },
  TRINCHEO: { color: "#92400e", weight: 2, fillOpacity: 0.1 },
  OTRO: { color: "#a855f7", weight: 1.5, fillOpacity: 0.05 },
  PUNTO: { color: "#ef4444", weight: 2 },
};
const GRUESO_CANAL = { Primario: 4, Madre: 4, Secundario: 3, Terciario: 2 };
const ORDEN = ["VIA_CABLE", "CANAL", "PARCELA", "RIEGO", "TRINCHEO", "OTRO", "PUNTO"];
// Visibles al abrir: lo que no tapa ni ensucia el mapa.
const VISIBLES = new Set(["VIA_CABLE", "CANAL"]);

function Elemento({ e }) {
  const base = ESTILOS[e.categoria] || ESTILOS.OTRO;
  const opts = { ...base, ...(e.categoria === "CANAL" && GRUESO_CANAL[e.subtipo] ? { weight: GRUESO_CANAL[e.subtipo] } : {}) };
  const etiqueta = e.nombre ? <Tooltip sticky>{e.nombre}</Tooltip> : null;
  if (e.geometria === "PUNTO") {
    return <CircleMarker center={e.coordenadas} radius={5} pathOptions={opts}>{etiqueta}</CircleMarker>;
  }
  if (e.geometria === "LINEA") return <Polyline positions={e.coordenadas} pathOptions={opts}>{etiqueta}</Polyline>;
  return <Polygon positions={e.coordenadas} pathOptions={opts}>{etiqueta}</Polygon>;
}

export default function CapasMapa({ fincaUuid }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!fincaUuid) return;
    apiFetch(`/fincas/${fincaUuid}/capas-mapa`)
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]));
  }, [fincaUuid]);

  const porCategoria = useMemo(() => {
    const m = {};
    for (const i of items) (m[i.categoria] ||= []).push(i);
    return m;
  }, [items]);

  const categorias = ORDEN.filter((c) => porCategoria[c]?.length);
  if (categorias.length === 0) return null;

  return (
    <LayersControl position="topright" collapsed>
      {categorias.map((cat) => (
        <LayersControl.Overlay key={cat} checked={VISIBLES.has(cat)} name={`${NOMBRES_CATEGORIA[cat]} (${porCategoria[cat].length})`}>
          <LayerGroup>
            {porCategoria[cat].map((e) => (
              <Elemento key={e.uuid} e={e} />
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
      ))}
    </LayersControl>
  );
}
