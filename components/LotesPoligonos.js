"use client";

// Dibuja el perímetro de cada lote de una finca (los que tengan uno cargado)
// dentro de un <MapContainer> de react-leaflet. Con `loteUuidResaltado` el
// lote elegido se pinta más marcado y los demás quedan tenues.
import { useEffect, useState } from "react";
import { Polygon, Tooltip } from "react-leaflet";
import { apiFetch } from "@/lib/api";
import { normalizarPerimetro } from "@/lib/kml";

export default function LotesPoligonos({ fincaUuid, loteUuidResaltado }) {
  const [lotes, setLotes] = useState([]);

  useEffect(() => {
    if (!fincaUuid) return;
    apiFetch(`/fincas/${fincaUuid}/lotes?limit=100`)
      .then((res) =>
        setLotes(
          (res.items || [])
            .filter((l) => l.estado && !l.deletedAt)
            .map((l) => ({ uuid: l.uuid, nombre: l.nombre, codigo: l.codigo, perimetro: normalizarPerimetro(l.perimetro) }))
            .filter((l) => l.perimetro && l.perimetro.length > 2),
        ),
      )
      .catch(() => setLotes([]));
  }, [fincaUuid]);

  return lotes.map((l) => {
    const resaltado = loteUuidResaltado && l.uuid === loteUuidResaltado;
    const atenuado = loteUuidResaltado && !resaltado;
    return (
      <Polygon
        key={l.uuid}
        positions={l.perimetro}
        pathOptions={{
          color: resaltado ? "#ffffff" : "#38bdf8",
          weight: resaltado ? 3 : 1.5,
          fillColor: "#38bdf8",
          fillOpacity: resaltado ? 0.25 : atenuado ? 0.03 : 0.1,
          opacity: atenuado ? 0.5 : 1,
        }}
      >
        <Tooltip sticky>Lote {l.nombre}</Tooltip>
      </Polygon>
    );
  });
}
