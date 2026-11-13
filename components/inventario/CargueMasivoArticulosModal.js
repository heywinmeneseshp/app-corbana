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
  return (
    <ModalShell title="Cargar repuestos masivamente" onClose={onClose} size="lg">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <p className="small text-secondary">
        Sube un Excel o CSV con una fila por repuesto. Si el nombre ya existe se actualiza; si no, se crea. Todos quedan en la categoría «Piezas y repuestos». Columnas: <code>{COLUMNAS.join(", ")}</code> (solo
        <code> nombre</code> es obligatoria). Puedes partir del Excel que descargas con «Exportar».
      </p>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={descargarPlantilla}>
          <FiDownload /> Descargar plantilla
        </button>
        <input
          ref={inputRef}
          type="file"
          className="form-control form-control-sm rounded-1"
          style={{ maxWidth: "22rem" }}
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
        <button type="button" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1" disabled={!revision || trabajando || !!resultado || revision.articulosCreados + revision.articulosActualizados === 0} onClick={() => enviar(false)}>
          <FiUploadCloud /> {trabajando && revision ? "Cargando..." : "Cargar"}
        </button>
      </div>
      {r && (
        <div className={`alert py-2 small ${resultado ? "alert-success" : "alert-info"}`}>
          {resultado ? "Cargue terminado. " : "Revisión (aún no se guardó nada). "}
          {r.totalFilas} fila(s): <strong>{r.articulosCreados}</strong> nueva(s), <strong>{r.articulosActualizados}</strong> por actualizar, <strong>{r.errores.length}</strong> con error.
          {r.errores.length > 0 && (
            <ul className="mb-0 mt-1 ps-3" style={{ maxHeight: "10rem", overflowY: "auto" }}>
              {r.errores.map((e, i) => (
                <li key={i}>
                  Fila {e.fila}: {e.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ModalShell>
  );
}
