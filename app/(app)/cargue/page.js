"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FiUploadCloud, FiDownload, FiArrowRight, FiAlertTriangle, FiX } from "react-icons/fi";
import { apiUploadConProgreso, apiFetch, API_URL } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

export default function CargueMasivoPage() {
  return (
    <RequirePermission anyOf={["finca.crear", "lote.crear", "racimo_movimiento.crear", "motivo_repique.crear", "motivo_recuse.crear"]}>
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

        {hasPermission("racimo_movimiento.crear") && (
          <BulkUploadCard
            title="Cargue masivo de Movimientos de Racimos"
            description="Columnas esperadas: fincaCodigo, loteCodigo, tipo (EMBOLSE/REPIQUE/RECUSE/PROCESADO), semanaEmbolseCodigo, semanaRegistroCodigo (opcional, por defecto = semanaEmbolseCodigo), motivo (nombre, requerido para REPIQUE/RECUSE — debe existir en el maestro correspondiente), cantidad, fecha (AAAA-MM-DD), observacion (opcional). Se procesa en el orden del archivo, para validar el saldo de cada cohorte correctamente."
            endpoint="/racimo-movimientos/bulk-upload"
            templateHeaders={[
              "fincaCodigo",
              "loteCodigo",
              "tipo",
              "semanaEmbolseCodigo",
              "semanaRegistroCodigo",
              "motivo",
              "cantidad",
              "fecha",
              "observacion",
            ]}
            templateExampleRow={["525", "525-01", "EMBOLSE", "S17-2026", "S17-2026", "", "1000", "2026-04-20", ""]}
            templateFilename="plantilla_movimientos_racimos.xlsx"
            renderResult={(r) => (
              <>
                <p className="mb-1">
                  {r.totalFilas} fila(s) procesadas: <strong>{r.movimientosCreados}</strong> movimiento(s) creado(s).
                </p>
                <ErrorList errores={r.errores} />
              </>
            )}
          />
        )}

        {hasPermission("motivo_repique.crear") && (
          <BulkUploadCard
            title="Cargue masivo de Motivos de Repique"
            description="Columnas esperadas: nombre, descripcion (opcional), estado (opcional: activo/inactivo). Si ya existe un motivo con ese nombre, se actualiza en vez de duplicarlo."
            endpoint="/motivos-repique/bulk-upload"
            templateHeaders={["nombre", "descripcion", "estado"]}
            templateExampleRow={["Viento", "Racimo caído por viento", "activo"]}
            templateFilename="plantilla_motivos_repique.xlsx"
            renderResult={(r) => (
              <>
                <p className="mb-1">
                  {r.totalFilas} fila(s) procesadas: <strong>{r.motivosCreados}</strong> creado(s),{" "}
                  <strong>{r.motivosActualizados}</strong> actualizado(s).
                </p>
                <ErrorList errores={r.errores} />
              </>
            )}
          />
        )}

        {hasPermission("motivo_recuse.crear") && (
          <BulkUploadCard
            title="Cargue masivo de Motivos de Recuse"
            description="Columnas esperadas: nombre, descripcion (opcional), estado (opcional: activo/inactivo). Si ya existe un motivo con ese nombre, se actualiza en vez de duplicarlo."
            endpoint="/motivos-recuse/bulk-upload"
            templateHeaders={["nombre", "descripcion", "estado"]}
            templateExampleRow={["Bajo grado", "Fruta de calibre insuficiente", "activo"]}
            templateFilename="plantilla_motivos_recuse.xlsx"
            renderResult={(r) => (
              <>
                <p className="mb-1">
                  {r.totalFilas} fila(s) procesadas: <strong>{r.motivosCreados}</strong> creado(s),{" "}
                  <strong>{r.motivosActualizados}</strong> actualizado(s).
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
  const [uploadPct, setUploadPct] = useState(0);
  const [procPct, setProcPct] = useState(0);
  const [procFase, setProcFase] = useState("");
  const [procFilas, setProcFilas] = useState(0);
  const [procTotal, setProcTotal] = useState(0);
  const [procEta, setProcEta] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  // Genera un token único para seguir el progreso del lado del servidor
  const progressToken = useRef(null);
  if (!progressToken.current) {
    progressToken.current = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (token) => {
    setProcPct(0);
    setProcFase("validando");
    setProcFilas(0);
    setProcTotal(0);
    pollRef.current = setInterval(async () => {
      try {
        const p = await apiFetch(`/racimo-movimientos/bulk-progress/${token}`);
        if (!p) {
          console.log("⏳ Progreso: token aún no disponible en el servidor");
          return;
        }
        console.log(`📊 Progreso: ${p.pct}% - ${p.fase} (${p.filas || 0}/${p.total || 0})${p.eta != null ? ` ETA: ${p.eta}s` : ""}`);
        setProcPct(p.pct);
        setProcFase(p.fase);
        setProcFilas(p.filas || 0);
        setProcTotal(p.total || 0);
        setProcEta(p.eta != null ? p.eta : null);
        if (p.fase === "completado" || p.fase === "error") {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (err) {
        console.error("❌ Error consultando progreso:", err.message);
      }
    }, 1500);
  };

  const handleFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setError("");
    setResult(null);
    setPreview(null);
    setUploadPct(0);
    setProcPct(0);
    setProcFase("");
  };

  // Sube el archivo una sola vez. El servidor valida primero; si no hay
  // errores inserta todo en una transacción (mode=auto). Si hay errores,
  // los devuelve sin escribir nada — el usuario decide si corregir o forzar.
  const handleUpload = async () => {
    if (!selectedFile) return;
    setError("");
    setResult(null);
    setPreview(null);
    setUploadPct(0);
    setProcPct(0);
    setProcFase("validando");
    setUploading(true);
    const token = progressToken.current;
    startPolling(token);
    try {
      const data = await apiUploadConProgreso(endpoint, selectedFile, setUploadPct, { mode: "auto", progressToken: token });
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (data.errores.length === 0) {
        setResult(data);
        setProcFase("completado");
        setProcPct(100);
        setSelectedFile(null);
      } else {
        setPreview(data);
        setProcFase("completado");
        setProcPct(100);
      }
    } catch (err) {
      setError(err.message);
      setProcFase("error");
    } finally {
      setUploading(false);
    }
  };

  const handleCargarSoloValidas = async () => {
    if (!selectedFile) return;
    setError("");
    setUploadPct(0);
    setProcPct(0);
    setProcFase("validando");
    setUploading(true);
    const token = progressToken.current;
    startPolling(token);
    try {
      const data = await apiUploadConProgreso(endpoint, selectedFile, setUploadPct, { mode: "auto", progressToken: token });
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setResult(data);
      setSelectedFile(null);
      setPreview(null);
      setProcFase("completado");
      setProcPct(100);
    } catch (err) {
      setError(err.message);
      setProcFase("error");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelarCarga = () => {
    setPreview(null);
    setSelectedFile(null);
    setUploadPct(0);
    setProcPct(0);
    setProcFase("");
  };

  const descargarErrores = () => {
    if (!preview) return;
    const filas = [["Fila", "Error"], ...preview.errores.map((e) => [e.fila, e.mensaje])];
    const worksheet = XLSX.utils.aoa_to_sheet(filas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Errores");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "errores_cargue.xlsx";
    a.click();
    URL.revokeObjectURL(url);
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
          {selectedFile ? selectedFile.name : "Arrastra aquí tu archivo Excel o CSV, o haz clic para explorar"}
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

      {selectedFile && !uploading && !result && !preview && (
        <button
          type="button"
          className="btn btn-brand rounded-3 w-100 mt-3 d-flex align-items-center justify-content-center gap-2"
          onClick={handleUpload}
        >
          <FiUploadCloud /> Iniciar carga
        </button>
      )}

      {uploading && (
        <div className="mt-3">
          <div className="d-flex justify-content-between small text-secondary mb-1">
            <span>Subiendo archivo...</span>
            <span>{uploadPct}%</span>
          </div>
          <div className="progress rounded-3 mb-2" style={{ height: "0.5rem" }}>
            <div className="progress-bar bg-brand" style={{ width: `${uploadPct}%` }} />
          </div>
          <div className="d-flex justify-content-between small text-secondary mb-1">
            <span>Procesando: {procFase === "validando" ? "Validando datos..." : procFase === "insertando" ? "Insertando en BD..." : procFase === "completado" ? "Completado" : procFase === "error" ? "Error" : "Esperando..."} {procTotal > 0 ? `(${procFilas}/${procTotal} filas)` : ""}</span>
            <span>{procPct}% {procEta != null ? `· ${procEta < 60 ? `${procEta}s` : `${Math.floor(procEta / 60)}m ${procEta % 60}s`} rest.` : ""}</span>
          </div>
          <div className="progress rounded-3" style={{ height: "0.5rem" }}>
            <div
              className="progress-bar"
              style={{ width: `${procPct}%`, backgroundColor: procFase === "error" ? "#dc3545" : "var(--brand-700)", transition: "width .5s" }}
            />
          </div>
        </div>
      )}

      {preview && !uploading && (
        <div className="alert alert-warning mt-3 mb-0">
          <p className="d-flex align-items-center gap-2 fw-medium mb-2">
            <FiAlertTriangle /> Se encontraron {preview.errores.length} fila(s) con error de {preview.totalFilas} totales.
          </p>
          <p className="small mb-3">
            Puedes cargar solo las {preview.totalFilas - preview.errores.length} fila(s) válida(s) (las que tienen
            error se omitirán), cancelar la carga por completo, o descargar el detalle de errores para corregirlos.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleCargarSoloValidas}
            >
              <FiUploadCloud /> Cargar solo las válidas ({preview.totalFilas - preview.errores.length})
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleCancelarCarga}
            >
              <FiX /> Cancelar carga
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={descargarErrores}
            >
              <FiDownload /> Descargar errores (.xlsx)
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
      {result && <div className="alert alert-success py-2 small mt-3 mb-0">{renderResult(result)}</div>}
    </div>
  );
}
