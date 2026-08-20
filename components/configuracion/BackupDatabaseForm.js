"use client";

import { useRef, useState } from "react";
import { FiDownload, FiUploadCloud, FiAlertTriangle } from "react-icons/fi";
import { apiFetchBlob, apiUploadConProgreso } from "@/lib/api";

// Frase exacta que exige el backend antes de reemplazar la base completa —
// ver FRASE_CONFIRMACION_IMPORT en api-rest-corbana/src/services/sistema/backup.service.js.
const FRASE_CONFIRMACION = "REEMPLAZAR TODO";

export default function BackupDatabaseForm() {
  const [exportando, setExportando] = useState(false);
  const [exportError, setExportError] = useState("");

  const [archivo, setArchivo] = useState(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [importError, setImportError] = useState("");
  const [importOk, setImportOk] = useState("");
  const inputRef = useRef(null);

  async function handleExportar() {
    setExportando(true);
    setExportError("");
    try {
      const blob = await apiFetchBlob("/sistema/backup/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `corbana_backup_${fecha}.sql`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExportando(false);
    }
  }

  async function handleImportar(e) {
    e.preventDefault();
    setImportError("");
    setImportOk("");
    if (!archivo) {
      setImportError("Selecciona el archivo .sql a importar.");
      return;
    }
    if (confirmacion !== FRASE_CONFIRMACION) {
      setImportError(`Escribe exactamente "${FRASE_CONFIRMACION}" para confirmar.`);
      return;
    }
    if (!confirm("Esto BORRA y reemplaza TODA la base de datos actual con el contenido del archivo. ¿Continuar?")) {
      return;
    }

    setImportando(true);
    setProgreso(0);
    try {
      await apiUploadConProgreso("/sistema/backup/import", archivo, setProgreso, { confirmacion });

      setImportOk("Base de datos importada (reemplazada) correctamente.");
      setArchivo(null);
      setConfirmacion("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        <div className="row g-4">
          <div className="col-12 col-lg-5">
            <h6 className="small fw-semibold mb-2">Exportar</h6>
            <p className="text-secondary small">Descarga un dump completo (.sql) de toda la base de datos actual.</p>
            <button
              type="button"
              className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
              disabled={exportando}
              onClick={handleExportar}
            >
              <FiDownload /> {exportando ? "Generando dump..." : "Descargar backup completo (.sql)"}
            </button>
            {exportError && <div className="alert alert-danger py-2 small mt-2 mb-0">{exportError}</div>}
          </div>

          <div className="col-12 col-lg-1 d-none d-lg-flex justify-content-center">
            <div className="vr h-100" />
          </div>

          <div className="col-12 col-lg-6">
            <h6 className="small fw-semibold mb-2 d-flex align-items-center gap-2 text-danger">
              <FiAlertTriangle /> Importar (reemplaza TODO)
            </h6>
            <p className="text-secondary small">
              Esto borra la base de datos actual y la reemplaza con el contenido del archivo .sql. No se puede
              deshacer — exportá un backup antes si no estás seguro.
            </p>
            <form onSubmit={handleImportar}>
              <div className="row g-2 mb-2">
                <div className="col-12 col-md-6">
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".sql"
                    className="form-control rounded-3"
                    onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <input
                    type="text"
                    className="form-control rounded-3"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value)}
                    placeholder={FRASE_CONFIRMACION}
                  />
                </div>
              </div>
              <p className="form-text small mt-n1 mb-2">
                Escribe <code>{FRASE_CONFIRMACION}</code> en el segundo campo para confirmar.
              </p>
              {importError && <div className="alert alert-danger py-2 small">{importError}</div>}
              {importOk && <div className="alert alert-success py-2 small">{importOk}</div>}
              <button
                type="submit"
                className="btn btn-danger rounded-3 d-flex align-items-center gap-2"
                disabled={importando || !archivo || confirmacion !== FRASE_CONFIRMACION}
              >
                <FiUploadCloud /> {importando ? `Subiendo... ${progreso}%` : "Reemplazar base de datos"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
