"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FiUploadCloud, FiDownload, FiArrowRight, FiAlertTriangle, FiX } from "react-icons/fi";
import { apiUploadConProgreso, apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

export default function CargueMasivoPage() {
  return (
    <RequirePermission anyOf={["finca.crear", "lote.crear", "racimo_movimiento.crear", "motivo_repique.crear", "motivo_recuse.crear", "produccion.crear"]}>
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
            description="Columnas esperadas: fincaCodigo, loteCodigo, tipo (EMBOLSE/REPIQUE/RECUSE/PROCESADO), semanaEmbolseCodigo, semanaRegistroCodigo (opcional, por defecto = semanaEmbolseCodigo), motivo (nombre, requerido para REPIQUE/RECUSE — debe existir en el maestro correspondiente), cantidad, fecha (AAAA-MM-DD), observacion (opcional). Se procesa en el orden del archivo, para validar el saldo de cada cohorte correctamente. Máximo 15,000 filas por archivo — si tenés más, dividilo por semana o por año y subí cada parte por separado."
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
            chunkSize={10000}
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

        {hasPermission("produccion.crear") && (
          <BulkUploadCard
            title="Cargue masivo de Producción Semanal"
            description="Columnas esperadas: semana (código de semana, ej: S30-2026), fincaCodigo, cajas (cajas de 20 kg producidas). Si ya existe un registro para la misma semana y finca, se omite. Máximo 15,000 filas por archivo — si tenés más, dividilo por año y subí cada parte por separado."
            endpoint="/produccion-semanal/bulk-upload"
            templateHeaders={["semana", "fincaCodigo", "cajas"]}
            templateExampleRow={["S30-2026", "525", "1500"]}
            templateFilename="plantilla_produccion.xlsx"
            chunkSize={10000}
            renderResult={(r) => (
              <>
                <p className="mb-1">
                  {r.totalFilas} fila(s) procesadas: <strong>{r.creados}</strong> registro(s) creado(s)
                  {r.saltados > 0 && <>, <strong>{r.saltados}</strong> omitido(s) por duplicado</>}.
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

function ErrorList({ errores, rawFileRows, templateHeaders }) {
  if (!errores || errores.length === 0) return null;

  const filaLookup = {};
  if (rawFileRows) {
    for (const r of rawFileRows) filaLookup[r.fila] = r.datos;
  }

  const getMsg = (e) => e.mensaje || e.error || "";

  return (
    <div className="mt-2">
      <p className="small text-danger fw-medium mb-1">{errores.length} fila(s) con errores:</p>
      <div className="table-responsive" style={{ maxHeight: "16rem", overflowY: "auto" }}>
        <table className="table table-sm table-bordered small mb-0">
          <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th>#</th>
              {templateHeaders && templateHeaders.map((h) => <th key={h}>{h}</th>)}
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {errores.map((e, i) => {
              const datos = filaLookup[e.fila] || {};
              return (
                <tr key={i}>
                  <td className="text-secondary">{e.fila}</td>
                  {templateHeaders && templateHeaders.map((h) => (
                    <td key={h} className="text-danger">{datos[h] !== undefined ? String(datos[h]) : "—"}</td>
                  ))}
                  <td className="text-danger">{getMsg(e)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkUploadCard({ title, description, endpoint, templateHeaders, templateExampleRow, templateFilename, renderResult, chunkSize }) {
  const [rawFileRows, setRawFileRows] = useState([]);
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
  const [requireConfirmation, setRequireConfirmation] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [chunkInfo, setChunkInfo] = useState(null); // { actual, total } mientras se sube en partes
  const [failedChunk, setFailedChunk] = useState(null); // datos para poder reanudar tras un fallo a mitad de camino
  const inputRef = useRef(null);
  const pollRef = useRef(null);
  const chunkConfirmResolver = useRef(null); // resuelve la pausa por saldo negativo en medio del chunking

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

  // Solo el endpoint de movimientos de racimos reporta progreso en vivo
  // (fase/porcentaje) del lado del servidor — los demás cargues son
  // sincrónicos (responden al terminar), así que para esos no tiene sentido
  // consultar este endpoint: se saltea y el usuario solo ve el % de subida
  // del archivo (XHR) y, si aplica, "Parte X de N" del troceo.
  const soportaProgreso = endpoint === "/racimo-movimientos/bulk-upload";

  const startPolling = (token) => {
    if (!soportaProgreso) return;
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

  const handleFile = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setError("");
    setResult(null);
    setPreview(null);
    setRequireConfirmation(null);
    setFailedChunk(null);
    setUploadPct(0);
    setProcPct(0);
    setProcFase("");
    setRawFileRows([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setRawFileRows(json.map((r, i) => ({ fila: i + 2, datos: r })));
    } catch { setRawFileRows([]); }
  };

  // Sube el archivo una sola vez. El servidor valida primero; si no hay
  // errores inserta todo en una transacción (mode=auto). Si hay errores,
  // los devuelve sin escribir nada — el usuario decide si corregir o forzar.
  // Si el admin tiene saldos negativos, pide confirmación antes de insertar.
  const handleUpload = async () => {
    if (!selectedFile) return;
    setError("");
    setResult(null);
    setPreview(null);
    setRequireConfirmation(null);
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
      if (data.requireConfirmation) {
        setRequireConfirmation(data);
        setProcFase("completado");
        setProcPct(100);
      } else if (!data.errores?.length) {
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

  // Construye un archivo .xlsx solo con un pedazo de filas (mismo header),
  // para subirlo como si fuera un cargue independiente.
  const buildChunkFile = (rowsSlice, baseName, idx, totalChunks) => {
    const worksheet = XLSX.utils.json_to_sheet(rowsSlice, { header: templateHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const nombre = `${baseName.replace(/\.(xlsx|csv)$/i, "")}_parte${idx + 1}de${totalChunks}.xlsx`;
    return new File([blob], nombre, { type: blob.type });
  };

  // Para archivos con más filas de las que el backend puede procesar en una
  // sola petición (se corta por el límite de tiempo de la función
  // serverless): el navegador arma partes de `chunkSize` filas cada una,
  // reutilizando el header, y las sube en secuencia (nunca en paralelo,
  // porque el orden importa para validar el saldo de cada cohorte). Si una
  // parte pide confirmación por saldo negativo, se pausa y se le pregunta al
  // usuario antes de seguir con la siguiente.
  const handleUploadChunked = async (resumeFrom) => {
    if (!selectedFile || rawFileRows.length === 0) return;
    setError("");
    setResult(null);
    setPreview(null);
    setRequireConfirmation(null);
    setFailedChunk(null);
    setUploadPct(0);
    setProcPct(0);
    setUploading(true);

    const rows = rawFileRows.map((r) => r.datos);
    const totalChunks = Math.ceil(rows.length / chunkSize);
    // Al reanudar, se retoma desde la parte que falló — las anteriores ya
    // quedaron insertadas en la BD, no hace falta (ni conviene) repetirlas.
    const acumulado = resumeFrom ? resumeFrom.acumulado : { totalFilas: 0, errores: [] };
    let filaOffset = resumeFrom ? resumeFrom.filaOffset : 0;
    const idxInicial = resumeFrom ? resumeFrom.idx : 0;

    // El backend numera las filas relativas a CADA parte subida (empieza en
    // 2 en cada chunk). Para mostrarlas/buscarlas contra `rawFileRows`
    // (que tiene los números de fila del archivo ORIGINAL completo), hay
    // que sumarles cuántas filas ya pasaron en partes anteriores.
    const ajustarFilas = (arr) =>
      (arr || []).map((e) => ({ ...e, fila: e.fila != null ? e.fila + filaOffset : e.fila }));

    for (let idx = idxInicial; idx < totalChunks; idx += 1) {
      setChunkInfo({ actual: idx + 1, total: totalChunks });
      const chunkRows = rows.slice(idx * chunkSize, idx * chunkSize + chunkSize);
      const chunkFile = buildChunkFile(chunkRows, selectedFile.name, idx, totalChunks);
      const token = `${progressToken.current}-p${idx}`;
      setProcPct(0);
      setProcFase("validando");
      startPolling(token);

      try {
        let data = await apiUploadConProgreso(endpoint, chunkFile, setUploadPct, { progressToken: token });
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }

        if (data.requireConfirmation) {
          const confirmar = await new Promise((resolve) => {
            chunkConfirmResolver.current = resolve;
            setRequireConfirmation({
              ...data,
              errores: ajustarFilas(data.errores),
              warnings: ajustarFilas(data.warnings),
            });
          });
          setRequireConfirmation(null);
          if (!confirmar) {
            setError(
              `Carga detenida en la parte ${idx + 1} de ${totalChunks} (filas ${filaOffset + 1}-${filaOffset + chunkRows.length}). Las partes anteriores ya se cargaron correctamente — podés reanudar desde acá.`,
            );
            setFailedChunk({ idx, totalChunks, acumulado, filaOffset });
            setUploading(false);
            setChunkInfo(null);
            return;
          }
          setProcFase("validando");
          setProcPct(0);
          startPolling(token);
          data = await apiUploadConProgreso(endpoint, null, setUploadPct, { progressToken: token, forceNegativeSaldos: "true" });
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }

        acumulado.totalFilas += data.totalFilas || chunkRows.length;
        for (const key of Object.keys(data)) {
          if (["errores", "warnings", "totalFilas", "requireConfirmation"].includes(key)) continue;
          if (typeof data[key] === "number") acumulado[key] = (acumulado[key] || 0) + data[key];
        }
        if (data.errores?.length) {
          acumulado.errores.push(...ajustarFilas(data.errores));
        }
      } catch (err) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setError(
          `Falló en la parte ${idx + 1} de ${totalChunks} (filas ${filaOffset + 1}-${filaOffset + chunkRows.length}): ${err.message}. Las partes anteriores ya se cargaron correctamente — podés reanudar desde acá.`,
        );
        setFailedChunk({ idx, totalChunks, acumulado, filaOffset });
        setUploading(false);
        setChunkInfo(null);
        return;
      }

      filaOffset += chunkRows.length;
    }

    setResult(acumulado);
    setSelectedFile(null);
    setFailedChunk(null);
    setUploading(false);
    setChunkInfo(null);
    setProcFase("completado");
    setProcPct(100);
  };

  // El admin confirma la carga ignorando saldos negativos. No hace falta
  // volver a mandar el archivo: el backend ya tiene cacheada la validación
  // de la primera pasada (asociada al mismo progressToken) y la reutiliza.
  const handleForceNegativeSaldos = async () => {
    setError("");
    setUploadPct(100);
    setProcPct(0);
    setProcFase("validando");
    setUploading(true);
    const token = progressToken.current;
    startPolling(token);
    try {
      const data = await apiUploadConProgreso(endpoint, null, setUploadPct, { progressToken: token, forceNegativeSaldos: "true" });
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setResult(data);
      setSelectedFile(null);
      setRequireConfirmation(null);
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
      // Sin mode="auto": así el backend inserta las filas válidas y omite
      // las que tienen error, en vez de abortar todo por completo.
      const data = await apiUploadConProgreso(endpoint, selectedFile, setUploadPct, { progressToken: token });
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
    const filas = [["Fila", "Error"], ...preview.errores.map((e) => [e.fila, e.mensaje || e.error])];
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

      {selectedFile && chunkSize && rawFileRows.length > chunkSize && !uploading && !result && !preview && (
        <p className="small text-secondary mt-2 mb-0">
          El archivo tiene {rawFileRows.length.toLocaleString("es")} filas — se subirá automáticamente en{" "}
          {Math.ceil(rawFileRows.length / chunkSize)} partes de hasta {chunkSize.toLocaleString("es")} filas cada una,
          en orden. No hace falta que lo dividas vos.
        </p>
      )}

      {selectedFile && !uploading && !result && !preview && (
        <button
          type="button"
          className="btn btn-brand rounded-3 w-100 mt-3 d-flex align-items-center justify-content-center gap-2"
          onClick={() => (chunkSize && rawFileRows.length > chunkSize ? handleUploadChunked() : handleUpload())}
        >
          <FiUploadCloud /> Iniciar carga
        </button>
      )}

      {uploading && (
        <div className="mt-3">
          {chunkInfo && (
            <p className="small fw-medium text-brand mb-2">
              Parte {chunkInfo.actual} de {chunkInfo.total}
            </p>
          )}
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
            <FiAlertTriangle /> Se encontraron {preview.errores?.length ?? 0} fila(s) con error de {preview.totalFilas} totales.
          </p>
          <p className="small mb-3">
            Puedes cargar solo las {preview.totalFilas - (preview.errores?.length ?? 0)} fila(s) válida(s) (las que tienen
            error se omitirán), cancelar la carga por completo, o descargar el detalle de errores para corregirlos.
          </p>
          <ErrorList errores={preview.errores} rawFileRows={rawFileRows} templateHeaders={templateHeaders} />
          <div className="d-flex flex-wrap gap-2 mt-3">
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

      {requireConfirmation && (
        <div className="alert alert-warning mt-3 mb-0">
          <p className="d-flex align-items-center gap-2 fw-medium mb-2">
            <FiAlertTriangle /> Se encontraron {requireConfirmation.warnings.length} movimiento(s) con saldo negativo.
          </p>
          <p className="small mb-3">
            Como administrador puedes forzar la carga para que estos movimientos se inserten de todas formas,
            o cancelar y corregir el archivo.
            {requireConfirmation.errores.length > 0 && (
              <> Aparte de esto, {requireConfirmation.errores.length} fila(s) tienen error y se omitirán de
              todas formas (no se pueden forzar).</>
            )}
          </p>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={() => {
                if (chunkConfirmResolver.current) {
                  const resolve = chunkConfirmResolver.current;
                  chunkConfirmResolver.current = null;
                  resolve(true);
                } else {
                  handleForceNegativeSaldos();
                }
              }}
            >
              <FiUploadCloud /> Sí, cargar de todas formas ({(requireConfirmation.errores?.length ? requireConfirmation.totalFilas - requireConfirmation.errores.length : requireConfirmation.totalFilas)} movimientos)
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={() => {
                if (chunkConfirmResolver.current) {
                  const resolve = chunkConfirmResolver.current;
                  chunkConfirmResolver.current = null;
                  resolve(false);
                } else {
                  setRequireConfirmation(null);
                }
              }}
            >
              <FiX /> Cancelar
            </button>
          </div>
          {requireConfirmation.warnings?.length > 0 && (
            <div className="mt-2">
              <p className="small text-danger fw-medium mb-1">{requireConfirmation.warnings.length} advertencia(s) de saldo negativo:</p>
              <ErrorList errores={requireConfirmation.warnings} rawFileRows={rawFileRows} templateHeaders={templateHeaders} />
            </div>
          )}
          {requireConfirmation.errores?.length > 0 && (
            <div className="mt-2">
              <p className="small text-danger fw-medium mb-1">{requireConfirmation.errores.length} fila(s) con error (se omitirán):</p>
              <ErrorList errores={requireConfirmation.errores} rawFileRows={rawFileRows} templateHeaders={templateHeaders} />
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="alert alert-danger py-2 small mt-3 mb-0">
          <p className="mb-0">{error}</p>
          {failedChunk && !uploading && (
            <button
              type="button"
              className="btn btn-brand btn-sm rounded-3 d-inline-flex align-items-center gap-2 mt-2"
              onClick={() => handleUploadChunked(failedChunk)}
            >
              <FiUploadCloud /> Reanudar desde la parte {failedChunk.idx + 1} de {failedChunk.totalChunks}
            </button>
          )}
        </div>
      )}
      {result && <div className="alert alert-success py-2 small mt-3 mb-0">{renderResult(result)}</div>}
    </div>
  );
}
