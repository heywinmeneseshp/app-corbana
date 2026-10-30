"use client";

import { useEffect, useRef, useState } from "react";
import { FiDownload, FiMap, FiTrash2, FiUpload } from "react-icons/fi";
import { apiFetch, apiFetchBlob, apiFetchFormData } from "@/lib/api";
import { leerArchivoRecorrido } from "@/lib/kmlRecorrido";
import { renderMapaRecorrido } from "@/lib/mapaEstatico";
import { normalizarPerimetro } from "@/lib/kml";

// Recorrido de la aplicación (archivo KML o KMZ) del comprobante de aspersión: vista previa del mapa (satélite, perímetro de la
// finca y recorrido), descarga del archivo original y, en borrador (`editable`), subirlo o quitarlo. El mismo mapa sale en la
// segunda hoja del PDF del comprobante.
export default function RecorridoKml({ comprobante: c, editable = false, onCambio }) {
  const [mapa, setMapa] = useState(null);
  const [trabajando, setTrabajando] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    let activo = true;
    if (!c?.kmlGeometria) {
      Promise.resolve().then(() => activo && setMapa(null));
      return () => {
        activo = false;
      };
    }
    renderMapaRecorrido({ geometria: c.kmlGeometria, perimetro: normalizarPerimetro(c.aspersion?.finca?.perimetro), ancho: 800, alto: 550 })
      .then((url) => activo && setMapa(url))
      .catch(() => activo && setMapa(null));
    return () => {
      activo = false;
    };
  }, [c?.kmlGeometria, c?.aspersion?.finca?.perimetro]);

  async function subir(file) {
    if (!file) return;
    setError("");
    setTrabajando("Leyendo el archivo...");
    try {
      const { kmlTexto, nombreKml, geometria } = await leerArchivoRecorrido(file);
      setTrabajando("Guardando...");
      const fd = new FormData();
      fd.append("kml", new Blob([kmlTexto], { type: "application/vnd.google-earth.kml+xml" }), nombreKml);
      fd.append("geometria", JSON.stringify({ lineas: geometria.lineas, poligonos: geometria.poligonos, puntos: geometria.puntos }));
      const actualizado = await apiFetchFormData(`/comprobantes-aspersion/${c.uuid}/kml`, fd, { method: "PUT" });
      onCambio?.(actualizado);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function quitar() {
    if (!confirm("¿Quitar el recorrido (KML) de este comprobante?")) return;
    setTrabajando("Quitando...");
    try {
      onCambio?.(await apiFetch(`/comprobantes-aspersion/${c.uuid}/kml`, { method: "DELETE" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando("");
    }
  }

  async function descargar() {
    try {
      const blob = await apiFetchBlob(`/comprobantes-aspersion/${c.uuid}/kml`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = c.kmlNombre || `${c.numero}.kml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  const tiene = Boolean(c?.kmlGeometria || c?.kmlNombre);
  if (!tiene && !editable) return null;

  return (
    <div className="border rounded-3 p-2" style={{ borderColor: "#e2e8f0" }}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <span className="small fw-semibold d-flex align-items-center gap-1" style={{ color: "#166534" }}>
          <FiMap /> Recorrido de la aplicación (KML)
        </span>
        {tiene && <span className="small text-secondary text-truncate" style={{ maxWidth: "16rem" }}>{c.kmlNombre}</span>}
        <span className="ms-auto d-flex gap-1">
          {tiene && (
            <button type="button" className="btn btn-sm btn-link p-1 text-secondary d-inline-flex" title="Descargar el KML original" onClick={descargar}>
              <FiDownload />
            </button>
          )}
          {editable && tiene && (
            <button type="button" className="btn btn-sm btn-link p-1 text-danger d-inline-flex" title="Quitar el recorrido" disabled={Boolean(trabajando)} onClick={quitar}>
              <FiTrash2 />
            </button>
          )}
          {editable && (
            <button type="button" className="btn btn-sm btn-outline-success rounded-3 d-flex align-items-center gap-1" disabled={Boolean(trabajando)} onClick={() => inputRef.current?.click()}>
              <FiUpload /> {tiene ? "Cambiar" : "Subir KML / KMZ"}
            </button>
          )}
        </span>
      </div>
      <input ref={inputRef} type="file" accept=".kml,.kmz" className="d-none" onChange={(e) => subir(e.target.files?.[0])} />
      {trabajando && <div className="small text-secondary">{trabajando}</div>}
      {error && <div className="small text-danger">{error}</div>}
      {tiene ? (
        mapa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mapa} alt="Mapa del recorrido" className="w-100 rounded-2" style={{ maxHeight: 340, objectFit: "contain", backgroundColor: "#e5e7eb" }} />
        ) : (
          <div className="small text-secondary">Generando el mapa...</div>
        )
      ) : (
        <div className="small text-secondary">Sube el KML o KMZ del vuelo: su mapa saldrá en la segunda hoja del PDF del comprobante.</div>
      )}
    </div>
  );
}
