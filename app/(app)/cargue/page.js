"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FiUploadCloud, FiDownload, FiArrowRight } from "react-icons/fi";
import { apiUpload } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

export default function CargueMasivoPage() {
  return (
    <RequirePermission anyOf={["finca.crear", "lote.crear"]}>
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Cargue Masivo</h1>
        <p className="text-secondary mb-0">Sube archivos .csv o .xlsx para crear fincas o lotes en lote.</p>
      </div>

      <div className="d-flex flex-column gap-4">
        {hasPermission("finca.crear") && (
          <BulkUploadCard
            title="Cargue masivo de Fincas"
            description="Columnas esperadas: codigo, nombre, estado (opcional: activo/inactivo)."
            endpoint="/fincas/bulk-upload"
            templateHeaders={["codigo", "nombre", "estado"]}
            templateExampleRow={["F-99", "Finca Ejemplo", "activo"]}
            templateFilename="plantilla_fincas.xlsx"
            renderResult={(r) => (
              <>
                <p className="mb-1">
                  {r.totalFilas} fila(s) procesadas: <strong>{r.fincasCreadas}</strong> creada(s),{" "}
                  <strong>{r.fincasActualizadas}</strong> actualizada(s), <strong>{r.fincasRestauradas}</strong> restaurada(s).
                </p>
                <ErrorList errores={r.errores} />
              </>
            )}
          />
        )}

        {hasPermission("lote.crear") && (
          <BulkUploadCard
            title="Cargue masivo de Lotes"
            description="Columnas esperadas: fincaCodigo, nombre, area (opcional), estado (opcional). El código del lote se genera automáticamente."
            endpoint="/lotes/bulk-upload"
            templateHeaders={["fincaCodigo", "nombre", "area", "estado"]}
            templateExampleRow={["F-99", "Lote Ejemplo", "12.5", "activo"]}
            templateFilename="plantilla_lotes.xlsx"
            renderResult={(r) => (
              <>
                <p className="mb-1">
                  {r.totalFilas} fila(s) procesadas: <strong>{r.lotesCreados}</strong> lote(s) creado(s).
                </p>
                <ErrorList errores={r.errores} />
              </>
            )}
          />
        )}
      </div>
    </div>
    </RequirePermission>
  );
}

function ErrorList({ errores }) {
  if (!errores || errores.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="small text-danger fw-medium mb-1">{errores.length} fila(s) con errores:</p>
      <ul className="small text-danger mb-0" style={{ maxHeight: "10rem", overflowY: "auto" }}>
        {errores.map((e, i) => (
          <li key={i}>
            Fila {e.fila}: {e.mensaje}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulkUploadCard({ title, description, endpoint, templateHeaders, templateExampleRow, templateFilename, renderResult }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setError("");
    setResult(null);
    setUploading(true);
    try {
      const data = await apiUpload(endpoint, file);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders, templateExampleRow || []]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4">
      <h2 className="h5 fw-bold mb-1">{title}</h2>
      <p className="small text-secondary mb-3">{description}</p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className="d-flex flex-column align-items-center justify-content-center text-center rounded-4 py-4 px-3 mb-3"
        style={{
          border: `2px dashed ${dragOver ? "var(--brand-700)" : "rgba(21,128,61,0.4)"}`,
          backgroundColor: dragOver ? "#f0fdf4" : "var(--brand-50)",
          cursor: "pointer",
        }}
      >
        <div className="mb-2 text-brand">
          <FiUploadCloud size={36} />
        </div>
        <p className="fw-medium mb-1 small">
          {fileName || "Arrastra aquí tu archivo Excel o CSV, o haz clic para explorar"}
        </p>
        <p className="small text-secondary mb-0">Formatos soportados: .xlsx, .csv. Máximo 10MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="d-none"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      <div className="d-flex align-items-center justify-content-between">
        <button type="button" className="btn btn-link text-brand text-decoration-none p-0 small d-inline-flex align-items-center gap-1" onClick={() => inputRef.current?.click()}>
          Elegir archivo <FiArrowRight />
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" onClick={downloadTemplate}>
          <FiDownload size={14} />
          Descargar Plantilla (.xlsx)
        </button>
      </div>

      {uploading && <p className="small text-secondary mt-3 mb-0">Procesando archivo...</p>}
      {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
      {result && <div className="alert alert-success py-2 small mt-3 mb-0">{renderResult(result)}</div>}
    </div>
  );
}
