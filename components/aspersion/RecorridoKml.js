"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiDownload, FiMap, FiTrash2, FiUpload } from "react-icons/fi";
import { apiFetch, apiFetchBlob, apiFetchFormData } from "@/lib/api";
import { leerArchivoRecorrido } from "@/lib/kmlRecorrido";
import { renderMapaRecorrido } from "@/lib/mapaEstatico";
import { normalizarPerimetro } from "@/lib/kml";

// Recorridos de la aplicación (archivos KML o KMZ) del comprobante de aspersión. Puede tener VARIOS (p. ej. un vuelo por dron):
// cada uno con su mapa (satélite, perímetro de la finca y recorrido) y la descarga de su archivo original; en borrador
// (`editable`) se agregan más o se quita cada uno. Cada mapa sale en su propia hoja del PDF del comprobante.
function MapaKml({ kml, perimetro }) {
  const [mapa, setMapa] = useState(null);
  useEffect(() => {
    let activo = true;
    if (!kml.geometria) return undefined;
    renderMapaRecorrido({ geometria: kml.geometria, perimetro, ancho: 800, alto: 550 })
      .then((url) => activo && setMapa(url))
      .catch(() => activo && setMapa(null));
    return () => {
      activo = false;
    };
  }, [kml.geometria, perimetro]);
  if (!kml.geometria) return null;
  return mapa ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mapa} alt={`Mapa del recorrido ${kml.nombre}`} className="w-100 rounded-2" style={{ maxHeight: 340, objectFit: "contain", backgroundColor: "#e5e7eb" }} />
  ) : (
    <div className="small text-secondary">Generando el mapa...</div>
  );
}

export default function RecorridoKml({ comprobante: c, editable = false, onCambio }) {
  const [trabajando, setTrabajando] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const kmls = c?.kmls || [];
  const perimetroCrudo = c?.aspersion?.finca?.perimetro;
  const perimetro = useMemo(() => normalizarPerimetro(perimetroCrudo), [perimetroCrudo]);

  // Se pueden elegir varios archivos a la vez: se suben uno por uno.
  async function subir(files) {
    const lista = [...(files || [])];
    if (!lista.length) return;
    setError("");
    try {
      let actualizado = null;
      for (const [i, file] of lista.entries()) {
        setTrabajando(`Leyendo ${file.name}${lista.length > 1 ? ` (${i + 1} de ${lista.length})` : ""}...`);
        const { kmlTexto, nombreKml, geometria } = await leerArchivoRecorrido(file);
        setTrabajando(`Guardando ${file.name}...`);
        const fd = new FormData();
        fd.append("kml", new Blob([kmlTexto], { type: "application/vnd.google-earth.kml+xml" }), nombreKml);
        fd.append("geometria", JSON.stringify({ lineas: geometria.lineas, poligonos: geometria.poligonos, puntos: geometria.puntos }));
        actualizado = await apiFetchFormData(`/comprobantes-aspersion/${c.uuid}/kml`, fd, { method: "PUT" });
      }
      if (actualizado) onCambio?.(actualizado);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function quitar(k) {
    if (!confirm(`¿Quitar el recorrido «${k.nombre}» de este comprobante?`)) return;
    setTrabajando("Quitando...");
    try {
      onCambio?.(await apiFetch(`/comprobantes-aspersion/${c.uuid}/kml/${k.uuid}`, { method: "DELETE" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando("");
    }
  }

  async function descargar(k) {
    try {
      const blob = await apiFetchBlob(`/comprobantes-aspersion/${c.uuid}/kml/${k.uuid}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = k.nombre || `${c.numero}.kml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!kmls.length && !editable) return null;

  return (
    <div className="border rounded-3 p-2" style={{ borderColor: "#e2e8f0" }}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <span className="small fw-semibold d-flex align-items-center gap-1" style={{ color: "#166534" }}>
          <FiMap /> Recorridos de la aplicación (KML){kmls.length > 1 ? ` · ${kmls.length}` : ""}
        </span>
        {editable && (
          <button type="button" className="btn btn-sm btn-outline-success rounded-3 d-flex align-items-center gap-1 ms-auto" disabled={Boolean(trabajando)} onClick={() => inputRef.current?.click()}>
            <FiUpload /> {kmls.length ? "Agregar KML / KMZ" : "Subir KML / KMZ"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".kml,.kmz" multiple className="d-none" onChange={(e) => subir(e.target.files)} />
      {trabajando && <div className="small text-secondary">{trabajando}</div>}
      {error && <div className="small text-danger">{error}</div>}
      {!kmls.length && <div className="small text-secondary">Sube uno o varios KML o KMZ del vuelo: cada mapa saldrá en su propia hoja del PDF del comprobante.</div>}
      <div className="d-flex flex-column gap-2">
        {kmls.map((k, i) => (
          <div key={k.uuid}>
            <div className="d-flex align-items-center gap-2">
              <span className="small text-secondary text-truncate" style={{ maxWidth: "20rem" }} title={k.nombre}>
                {kmls.length > 1 ? `${i + 1}. ` : ""}
                {k.nombre}
              </span>
              <span className="ms-auto d-flex gap-1">
                <button type="button" className="btn btn-sm btn-link p-1 text-secondary d-inline-flex" title="Descargar el KML original" onClick={() => descargar(k)}>
                  <FiDownload />
                </button>
                {editable && (
                  <button type="button" className="btn btn-sm btn-link p-1 text-danger d-inline-flex" title="Quitar este recorrido" disabled={Boolean(trabajando)} onClick={() => quitar(k)}>
                    <FiTrash2 />
                  </button>
                )}
              </span>
            </div>
            <MapaKml kml={k} perimetro={perimetro} />
          </div>
        ))}
      </div>
    </div>
  );
}
