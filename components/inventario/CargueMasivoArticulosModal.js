"use client";

import { useRef, useState } from "react";
import { FiDownload, FiUploadCloud } from "react-icons/fi";
import * as XLSX from "xlsx";
import { apiFetchFormData } from "@/lib/api";
import ModalShell from "@/components/ModalShell";

const COLUMNAS = ["nombre", "codigo", "descripcion", "unidadMedida", "costoCompra", "precioVenta", "manejaInventario", "stockMinimo", "stockMaximo", "estado"];

// Cargue masivo de Piezas y repuestos (.xlsx/.csv). Se crean los nuevos y se actualizan los que ya existen (por nombre); la categoría es siempre
// «Piezas y repuestos». Primero se revisa el archivo (sin guardar) y luego se confirma.
export default function CargueMasivoArticulosModal({ endpoint, onClose, onListo }) {
  const [archivo, setArchivo] = useState(null);
  const [revision, setRevision] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function descargarPlantilla() {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNAS, ["Filtro de aceite T100", "REP-001", "Filtro de aceite", "UND", 25000, 0, "si", 2, "", "activo"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Repuestos");
    XLSX.writeFile(wb, "plantilla_repuestos.xlsx");
  }

  async function enviar(dryRun) {
    if (!archivo) return;
    setError("");
    setTrabajando(true);
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("dryRun", dryRun ? "true" : "false");
      const r = await apiFetchFormData(endpoint, fd);
      if (dryRun) setRevision(r);
      else {
        setResultado(r);
        onListo?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  }

  const r = resultado || revision;
  const hayParaCargar = revision && revision.articulosCreados + revision.articulosActualizados > 0;
  const paso = (n, titulo) => (
    <div className="d-flex align-items-center gap-2 mb-2">
      <span className="badge rounded-circle d-inline-flex align-items-center justify-content-center" style={{ background: "#166534", width: "1.5rem", height: "1.5rem" }}>
        {n}
      </span>
      <span className="fw-semibold small">{titulo}</span>
    </div>
  );
  const dato = (valor, etiqueta, color) => (
    <div className="col-4">
      <div className="border rounded-1 text-center py-2" style={{ background: "#f8fafc" }}>
        <div className="fw-bold fs-5" style={{ color }}>
          {valor}
        </div>
        <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
          {etiqueta}
        </div>
      </div>
    </div>
  );

  return (
    <ModalShell title="Cargar repuestos masivamente" onClose={onClose} size="lg">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="row g-3">
        <div className="col-12 col-md-5">
          <div className="border rounded-1 p-3 h-100">
            {paso(1, "Prepara el archivo")}
            <p className="small text-secondary mb-2">
              Una fila por repuesto. Si el nombre ya existe se actualiza; si no, se crea. Todos quedan en la categoría «Piezas y repuestos».
            </p>
            <p className="small mb-2">
              Columnas: <code>{COLUMNAS.join(", ")}</code>. Solo <code>nombre</code> es obligatoria.
            </p>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={descargarPlantilla}>
              <FiDownload /> Descargar plantilla
            </button>
            <div className="form-text small">También puedes partir del Excel que descargas con «Exportar».</div>
          </div>
        </div>

        <div className="col-12 col-md-7">
          <div className="border rounded-1 p-3 mb-3">
            {paso(2, "Elige el archivo y revísalo")}
            <input
              ref={inputRef}
              type="file"
              className="form-control form-control-sm rounded-1 mb-2"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] || null);
                setRevision(null);
                setResultado(null);
                setError("");
              }}
            />
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" disabled={!archivo || trabajando || !!resultado} onClick={() => enviar(true)}>
              {trabajando && !revision ? "Revisando..." : "Revisar archivo"}
            </button>
            <span className="small text-secondary ms-2">No guarda nada todavía.</span>
          </div>

          <div className="border rounded-1 p-3">
            {paso(3, resultado ? "Cargue terminado" : "Revisa y carga")}
            {!r ? (
              <p className="small text-secondary mb-0">Aquí verás cuántas filas son nuevas, cuántas se actualizan y los errores.</p>
            ) : (
              <>
                <div className="row g-2 mb-2">
                  {dato(r.articulosCreados, resultado ? "creados" : "nuevos", "#166534")}
                  {dato(r.articulosActualizados, resultado ? "actualizados" : "por actualizar", "#1d4ed8")}
                  {dato(r.errores.length, "con error", r.errores.length ? "#b91c1c" : "#64748b")}
                </div>
                {r.errores.length > 0 && (
                  <ul className="small mb-2 ps-3" style={{ maxHeight: "9rem", overflowY: "auto" }}>
                    {r.errores.map((e, i) => (
                      <li key={i}>
                        Fila {e.fila}: {e.mensaje}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="d-flex gap-2 justify-content-end mt-2">
              <button type="button" className="btn btn-link btn-sm text-secondary" onClick={onClose}>
                {resultado ? "Cerrar" : "Cancelar"}
              </button>
              {!resultado && (
                <button type="button" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1" disabled={!hayParaCargar || trabajando} onClick={() => enviar(false)}>
                  <FiUploadCloud /> {trabajando && revision ? "Cargando..." : "Cargar"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
