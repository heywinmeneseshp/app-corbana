"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiTarget, FiSave, FiEye, FiList, FiAlertTriangle, FiUploadCloud, FiDownload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { apiFetch, apiUploadConProgreso } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";

const SEMANAS_DEFAULT = 8;

export default function EstimacionesPage() {
  const [vista, setVista] = useState("cargar");

  // Datos del formulario (próximas semanas + fincas habilitadas + tasa)
  const [semanasAEstimar, setSemanasAEstimar] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [tasaConversion, setTasaConversion] = useState(null);
  const [semanaActual, setSemanaActual] = useState(null);
  const [calendarioIncompleto, setCalendarioIncompleto] = useState(false);

  // Valores del formulario: { [fincaUuid]: { [semanaUuid]: cajas|""} }
  const [valores, setValores] = useState({});
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");

  // Filtro de finca en la grilla de carga ("" = todas)
  const [filtroFincaUuid, setFiltroFincaUuid] = useState("");

  // Escalera (ver)
  const [escaleraColumnas, setEscaleraColumnas] = useState([]);
  const [escaleraFilas, setEscaleraFilas] = useState([]);
  const [escaleraLoading, setEscaleraLoading] = useState(false);
  const [filtroEscaleraFincaUuid, setFiltroEscaleraFincaUuid] = useState("");
  const [semanaActualEscalera, setSemanaActualEscalera] = useState(null);

  // Carga masiva histórica
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkPct, setBulkPct] = useState(0);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkFueSobrescritura, setBulkFueSobrescritura] = useState(false);

  const puedeCrear = hasPermission("estimacion.crear");
  const puedeVer = hasPermission("estimacion.ver");
  const puedeActualizarMasivo = hasPermission("estimacion.actualizar_masivo");

  const cargarSemanas = useCallback(async () => {
    setMsgError("");
    try {
      const res = await apiFetch(`/estimaciones/semanas?semanas=${SEMANAS_DEFAULT}`);
      setSemanasAEstimar(res.semanas || []);
      setFincas(res.fincas || []);
      setTasaConversion(res.tasaConversion);
      setSemanaActual(res.semanaActual || null);
      setCalendarioIncompleto(Boolean(res.calendarioIncompleto));

      // Preinicializar el grid vacío para todas las fincas y semanas
      const nuevo = {};
      for (const finca of res.fincas || []) {
        nuevo[finca.uuid] = {};
        for (const semana of res.semanas || []) {
          nuevo[finca.uuid][semana.uuid] = "";
        }
      }
      setValores(nuevo);
    } catch (err) {
      setMsgError(err.message);
    }
  }, []);

  const cargarEscalera = useCallback(async () => {
    setEscaleraLoading(true);
    setMsgError("");
    try {
      const qs = filtroEscaleraFincaUuid ? `?fincaUuid=${filtroEscaleraFincaUuid}` : "";
      const res = await apiFetch(`/estimaciones/escalera${qs}`);
      setEscaleraColumnas(res.columnas || []);
      setEscaleraFilas(res.filas || []);
      setSemanaActualEscalera(res.semanaActual || null);
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setEscaleraLoading(false);
    }
  }, [filtroEscaleraFincaUuid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarSemanas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (vista === "ver") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarEscalera();
    }
  }, [vista, cargarEscalera]);

  const escaleraWrapRef = useRef(null);
  useEffect(() => {
    if (!escaleraWrapRef.current || !semanaActualEscalera || escaleraColumnas.length === 0) return;
    const t = setTimeout(() => {
      const wrap = escaleraWrapRef.current;
      if (!wrap) return;
      const cell = wrap.querySelector('.present-cell');
      if (cell) {
        cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      } else {
        const col = wrap.querySelector('.present-col');
        if (col) col.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 150);
    return () => clearTimeout(t);
  }, [escaleraColumnas, escaleraFilas, semanaActualEscalera, vista]);

  function cargarValoresExistentes() {
    // Trae las estimaciones propias y las precarga en el grid para poder
    // re-guardarlas / corregirlas (upsert).
    apiFetch(`/estimaciones?limit=100`)
      .then((res) => {
        const nuevo = { ...valores };
        for (const r of res.items || []) {
          if (nuevo[r.finca?.uuid] && nuevo[r.finca?.uuid][r.semana?.uuid] !== undefined) {
            nuevo[r.finca?.uuid][r.semana?.uuid] = r.cajas20kg;
          }
        }
        setValores(nuevo);
      })
      .catch((err) => setMsgError(err.message));
  }

  function setValor(fincaUuid, semanaUuid, valor) {
    setValores((prev) => ({
      ...prev,
      [fincaUuid]: { ...prev[fincaUuid], [semanaUuid]: valor },
    }));
    setGuardado(false);
  }

  async function handleGuardar() {
    if (!puedeCrear) return;
    const itemsGuardar = [];
    for (const fincaUuid of Object.keys(valores)) {
      for (const semanaUuid of Object.keys(valores[fincaUuid] || {})) {
        const raw = valores[fincaUuid][semanaUuid];
        if (raw === "" || raw === null || raw === undefined) continue;
        const cajas = Number(raw);
        if (Number.isNaN(cajas) || cajas < 0) {
          setMsgError("Todos los valores deben ser números mayores o iguales a 0.");
          return;
        }
        itemsGuardar.push({ fincaUuid, semanaUuid, cajas20kg: cajas });
      }
    }

    if (itemsGuardar.length === 0) {
      setMsgError("Ingresa al menos una estimación.");
      return;
    }

    setGuardando(true);
    setMsgError("");
    try {
      const res = await apiFetch("/estimaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsGuardar }),
      });
      if (res.errores?.length) {
        setMsgError(`Se guardaron ${res.guardadas} estimación(es), con ${res.errores.length} fila(s) con error:\n${res.errores
          .map((e) => `- Fila ${e.fila}: ${e.error}`)
          .join("\n")}`);
      } else {
        setGuardado(true);
      }
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // La eliminación en escalera se hace desde el detalle por celda si hace
  // falta — por ahora la vista escalera es solo lectura agregada.

  function descargarPlantillaEstimaciones() {
    const headers = ["Codigo finca", "Semana registro", "Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5", "Semana 6", "Semana 7", "Semana 8"];
    const example = [fincas[0]?.codigo || "525", "S36-2026", "1500", "1250", "1300", "1300", "1200", "1250", "1200", "1400"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_estimaciones.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkUpload(overwrite = false) {
    if (!bulkFile) {
      setBulkError("Selecciona un archivo .xlsx o .csv");
      return;
    }
    setBulkError("");
    setBulkResult(null);
    setBulkPct(0);
    setBulkUploading(true);
    setBulkFueSobrescritura(overwrite);
    try {
      const endpoint = overwrite ? "/estimaciones/bulk-update" : "/estimaciones/bulk-upload";
      const data = await apiUploadConProgreso(endpoint, bulkFile, setBulkPct);
      setBulkResult(data);
      if (!data.errores?.length) setBulkFile(null);
      // refresca escalera si hay datos
      if (vista === "ver") cargarEscalera();
      else cargarSemanas();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkUploading(false);
    }
  }

  const cajasConDecimales = tasaConversion !== null && Number(tasaConversion) % 1 !== 0;

  return (
    <RequirePermission code="menu.estimaciones">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiTarget className="text-primary" /> Estimaciones de Fincas
          </h1>
          <p className="text-secondary mb-0">
            Cajas estimadas (unidad de 20kg equivalente, tasa configurada{" "}
            {tasaConversion !== null ? <strong>{tasaConversion} kg</strong> : "(cargando...)"})
            por finca para las próximas {semanaActual ? "semanas" : "semanas"}.
          </p>
        </div>

        {msgError && <div className="alert alert-danger py-2 small" style={{ whiteSpace: "pre-line" }}>{msgError}</div>}
        {guardado && <div className="alert alert-success py-2 small">Estimaciones guardadas correctamente.</div>}

        <ul className="nav nav-pills mb-3">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${vista === "cargar" ? "active" : ""}`}
              onClick={() => setVista("cargar")}
            >
              <FiSave className="me-1" /> Cargar estimaciones
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${vista === "ver" ? "active" : ""}`}
              onClick={() => setVista("ver")}
            >
              <FiEye className="me-1" /> Ver estimaciones
            </button>
          </li>
        </ul>

        {vista === "cargar" && (
          <div>
            {semanaActual && (
              <div className="small text-secondary mb-2">
                Semana actual: <strong>{semanaActual.codigo}</strong> — se estiman las próximas {semanasAEstimar.length} semanas.
              </div>
            )}

            {calendarioIncompleto && (
              <div className="alert alert-warning py-2 small d-flex align-items-start gap-2">
                <FiAlertTriangle className="flex-shrink-0 mt-1" />
                <span>
                  El calendario solo llega hasta <strong>{semanasAEstimar[semanasAEstimar.length - 1]?.codigo}</strong>.
                  Genera el año siguiente en Maestros → Semanas para estimar más semanas.
                </span>
              </div>
            )}

            {!puedeVer && !puedeCrear && (
              <div className="alert alert-warning py-2 small">
                No tienes permisos para ver ni cargar estimaciones.
              </div>
            )}

            {fincas.length === 0 && !msgError && (
              <div className="alert alert-info py-2 small">
                No tienes fincas habilitadas para estimar.
              </div>
            )}

            {fincas.length > 0 && (
              <>
                {fincas.length > 1 && (
                  <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-md-5 col-lg-4">
                        <label className="form-label small fw-medium">Finca</label>
                        <select
                          className="form-select rounded-3"
                          value={filtroFincaUuid}
                          onChange={(e) => setFiltroFincaUuid(e.target.value)}
                        >
                          <option value="">Todas</option>
                          {fincas.map((f) => (
                            <option key={f.uuid} value={f.uuid}>
                              {f.codigo} — {f.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0 small">
                      <thead className="table-light">
                        <tr>
                          <th className="sticky-col">Finca</th>
                          {semanasAEstimar.map((s) => (
                            <th key={s.uuid} className="text-center">
                              {s.codigo}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fincas
                          .filter((f) => !filtroFincaUuid || f.uuid === filtroFincaUuid)
                          .map((f) => {
                          const fila = valores[f.uuid] || {};
                          return (
                            <tr key={f.uuid}>
                              <td className="fw-medium sticky-col">
                                {f.codigo} — {f.nombre}
                              </td>
                              {semanasAEstimar.map((s) => (
                                <td key={s.uuid} className="text-center" style={{ minWidth: "5.5rem" }}>
                                  {puedeCrear ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step={cajasConDecimales ? "0.5" : "1"}
                                      className="form-control form-control-sm text-center rounded-3"
                                      value={fila[s.uuid] ?? ""}
                                      onChange={(e) => setValor(f.uuid, s.uuid, e.target.value)}
                                    />
                                  ) : (
                                    <span>{fila[s.uuid] === "" ? "—" : Number(fila[s.uuid]).toLocaleString("es")}</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-brand rounded-3 d-flex align-items-center gap-2"
                    onClick={handleGuardar}
                    disabled={!puedeCrear || guardando}
                  >
                    <FiSave /> {guardando ? "Guardando..." : "Guardar estimaciones"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={cargarValoresExistentes}
                    disabled={!puedeVer}
                  >
                    Cargar mis estimaciones guardadas
                  </button>
                </div>

                {puedeCrear && (
                  <div className="card border-0 shadow-sm rounded-4 p-3 mt-3">
                    <h3 className="h6 fw-bold mb-1 d-flex align-items-center gap-2">
                      <FiUploadCloud className="text-primary" /> Carga masiva histórica
                    </h3>
                    <p className="small text-secondary mb-3">
                      Histórico semana a semana por finca. Archivo <strong>.xlsx</strong> o <strong>.csv</strong> con columnas <code>Codigo finca</code>, <code>Semana registro</code> (ej. S36-2026) y <code>Semana 1</code>…<code>Semana 8</code> (las 8 siguientes en cajas 20kg eq.). Ejemplo: <code>525 | S36-2026 | 1500 | 1250 | 1300 | 1300 | 1200 | 1250 | 1200 | 1400</code>. Si la fila ya existe para tu usuario se omite; usa “Sobrescribir” para corregir. Máximo 15.000 filas. También disponible en <span className="text-primary">Configuración → Cargue Masivo</span>.
                    </p>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                      <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" onClick={descargarPlantillaEstimaciones}>
                        <FiDownload size={14} /> Descargar plantilla (.xlsx)
                      </button>
                      <span className="small text-secondary">Plantilla: Codigo finca, Semana registro, Semana 1…8</span>
                    </div>
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-medium">Archivo histórico</label>
                        <input
                          type="file"
                          accept=".xlsx,.csv"
                          className="form-control rounded-3"
                          onChange={(e) => {
                            setBulkFile(e.target.files?.[0] || null);
                            setBulkResult(null);
                            setBulkError("");
                          }}
                        />
                        {bulkFile && <div className="small text-secondary mt-1">{bulkFile.name} — {(bulkFile.size / 1024).toFixed(1)} KB</div>}
                      </div>
                      <div className="col-12 col-md-auto d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-brand rounded-3 d-flex align-items-center gap-2"
                          onClick={() => handleBulkUpload(false)}
                          disabled={!bulkFile || bulkUploading}
                        >
                          <FiUploadCloud /> {bulkUploading && !bulkFueSobrescritura ? `Cargando ${bulkPct}%` : "Cargar histórico"}
                        </button>
                        {puedeActualizarMasivo && (
                          <button
                            type="button"
                            className="btn btn-outline-warning rounded-3 d-flex align-items-center gap-2"
                            onClick={() => {
                              if (!bulkFile) {
                                setBulkError("Selecciona un archivo primero");
                                return;
                              }
                              if (!confirm("¿Sobrescribir las filas que ya existen con los valores del archivo?")) return;
                              handleBulkUpload(true);
                            }}
                            disabled={!bulkFile || bulkUploading}
                          >
                            Sobrescribir si existe
                          </button>
                        )}
                      </div>
                    </div>
                    {bulkUploading && (
                      <div className="progress rounded-3 mt-3" style={{ height: "0.45rem" }}>
                        <div className="progress-bar bg-success" style={{ width: `${bulkPct}%` }} />
                      </div>
                    )}
                    {bulkError && <div className="alert alert-danger py-2 small mt-3 mb-0" style={{ whiteSpace: "pre-line" }}>{bulkError}</div>}
                    {bulkResult && (
                      <div className={`alert ${bulkResult.errores?.length ? "alert-warning" : "alert-success"} py-2 small mt-3 mb-0`}>
                        <p className="mb-1">
                          {bulkResult.totalFilas} fila(s) procesadas: <strong>{bulkResult.creados ?? bulkResult.actualizados ?? 0}</strong> {bulkFueSobrescritura ? "procesadas" : "creada(s)"}
                          {bulkResult.saltados > 0 && <>, <strong>{bulkResult.saltados}</strong> omitida(s) por duplicado</>}
                          {bulkFueSobrescritura && bulkResult.actualizados !== undefined && <>, <strong>{bulkResult.actualizados}</strong> sobrescrita(s), <strong>{bulkResult.creados}</strong> nueva(s)</>}
                          .
                        </p>
                        {bulkResult.errores?.length > 0 && (
                          <div className="mt-2">
                            <p className="fw-medium mb-1">{bulkResult.errores.length} fila(s) con error:</p>
                            <ul className="mb-0 ps-3" style={{ maxHeight: "10rem", overflowY: "auto" }}>
                              {bulkResult.errores.slice(0, 30).map((e, i) => (
                                <li key={i}>Fila {e.fila}: {e.error}</li>
                              ))}
                              {bulkResult.errores.length > 30 && <li>...y {bulkResult.errores.length - 30} más</li>}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {vista === "ver" && (
          <div>
            {/* Filtro finca para la escalera */}
            {fincas.length > 0 && (
              <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-5 col-lg-4">
                    <label className="form-label small fw-medium">Finca (escalera)</label>
                    <select
                      className="form-select rounded-3"
                      value={filtroEscaleraFincaUuid}
                      onChange={(e) => setFiltroEscaleraFincaUuid(e.target.value)}
                    >
                      <option value="">Todas (total)</option>
                      {fincas.map((f) => (
                        <option key={f.uuid} value={f.uuid}>
                          {f.codigo} — {f.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-auto">
                    <button type="button" className="btn btn-outline-secondary rounded-3 btn-sm" onClick={cargarEscalera} disabled={escaleraLoading}>
                      {escaleraLoading ? "Cargando..." : "Actualizar"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
              {escaleraLoading && <div className="text-center text-secondary py-4 small">Cargando escalera...</div>}
              {!escaleraLoading && escaleraColumnas.length === 0 && (
                <div className="text-center text-secondary py-4 small">No hay estimaciones para mostrar en la escalera.</div>
              )}
              {!escaleraLoading && escaleraColumnas.length > 0 && (
                <div ref={escaleraWrapRef} className="table-responsive escalera-wrap">
                  <table className="table table-sm table-hover align-middle mb-0 small escalera-table">
                    <thead>
                      <tr>
                        <th className="sticky-col" style={{ minWidth: "8.5rem" }} />
                        {escaleraColumnas.map((c) => {
                          const isColActual = semanaActualEscalera && c.uuid === semanaActualEscalera.uuid;
                          return (
                            <th
                              key={c.uuid}
                              className={`text-center ${isColActual ? "present-col" : ""}`}
                              title={c.codigo}
                              style={{ minWidth: "4.6rem" }}
                            >
                              {c.numeroSemana}
                            </th>
                          );
                        })}
                      </tr>
                      <tr>
                        <th className="sticky-col text-center small" style={{ fontSize: "0.72rem" }}>
                          Registro \ Objetivo
                        </th>
                        {escaleraColumnas.map((c) => {
                          const isColActual = semanaActualEscalera && c.uuid === semanaActualEscalera.uuid;
                          return (
                            <th
                              key={`sub-${c.uuid}`}
                              className={`text-center small fw-medium ${isColActual ? "present-col" : ""}`}
                              title={c.codigo}
                              style={{ minWidth: "4.6rem" }}
                            >
                              <span className="d-inline-block text-truncate" style={{ maxWidth: "4.5rem" }}>{c.codigo}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {escaleraFilas.map((fila) => {
                        const src = fila.sourceSemana;
                        const isRowActual = semanaActualEscalera && src && src.uuid === semanaActualEscalera.uuid;
                        return (
                          <tr key={src ? src.uuid : fila.sourceFecha} className={isRowActual ? "present-row" : ""}>
                            <td
                              className={`fw-medium text-center sticky-col ${isRowActual ? "present-row" : ""}`}
                              title={src ? `${src.codigo} · ${src.fechaInicio} → ${src.fechaFin}` : fila.sourceFecha}
                              style={{ minWidth: "8.5rem" }}
                            >
                              {src ? src.codigo : fila.sourceFecha}
                            </td>
                            {escaleraColumnas.map((col) => {
                              const raw = fila.valores?.[col.uuid];
                              const hasVal = raw !== undefined && raw !== null && raw !== "";
                              const isDiagonal = src && col.uuid === src.uuid;
                              const isColActual = semanaActualEscalera && col.uuid === semanaActualEscalera.uuid;
                              const isCruceActual = isRowActual && isColActual;
                              return (
                                <td
                                  key={col.uuid}
                                  className={`text-center ${hasVal ? "fw-medium" : "text-secondary"} ${isDiagonal ? "table-active fw-bold" : ""} ${isCruceActual ? "present-cell" : ""} ${isColActual && !isCruceActual ? "present-col-cell" : ""} ${isRowActual && !isCruceActual ? "present-row-cell" : ""}`}
                                  style={{ minWidth: "4.6rem" }}
                                >
                                  {hasVal ? Number(raw).toLocaleString("es") : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!escaleraLoading && escaleraColumnas.length > 0 && (
              <div className="small text-secondary mt-2">
                Cada fila es la <strong>semana de registro</strong> (cuándo se cargó la estimación) y cada columna la <strong>semana objetivo</strong>. El valor es la suma de cajas (20&nbsp;kg eq.) estimada. La diagonal marca el registro de la misma semana.
              </div>
            )}
          </div>
        )}

        <div className="d-flex align-items-center gap-1 mt-4 text-secondary small">
          <FiList /> Solo ves las fincas que tienes habilitadas y tus propias estimaciones.
        </div>
      </div>

      <style jsx>{`
        .btn-brand {
          background-color: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .btn-brand:hover {
          background-color: #15803d;
          border-color: #15803d;
          color: #fff;
        }
        .sticky-col {
          position: sticky;
          left: 0;
          background-color: #fff;
          z-index: 1;
          min-width: 12rem;
        }
        thead .sticky-col {
          background-color: #f8f9fa;
        }
        .escalera-table tbody td {
          background-color: #166534 !important;
          color: #fff !important;
          border: none !important;
        }
        .escalera-table tbody td.has-val {
          background-color: #fff !important;
          color: #1a1a1a !important;
          border: none !important;
        }
        .escalera-table td, .escalera-table th {
          border: none !important;
        }
        .escalera-table .sticky-col {
          background-color: var(--brand-900) !important;
          color: #fff !important;
          border: none !important;
        }
        .present-col {
          background-color: #dcf3e6 !important;
          color: #14532d !important;
          border-color: #86efac !important;
        }
        .escalera-table .present-row td.sticky-col {
          background-color: #dcf3e6 !important;
          color: #14532d !important;
        }
        .present-row {
          background-color: #f0fdf4 !important;
        }
        .present-cell {
          background-color: #86efac !important;
          color: #14532d !important;
          font-weight: 800 !important;
          border: 2px solid #15803d !important;
        }
        .present-col-cell {
          background-color: #ecfdf5 !important;
        }
        .present-row-cell {
          background-color: #ecfdf5 !important;
        }
        @media (max-width: 768px) {
          .sticky-col {
            min-width: 9rem;
          }
        }
        .escalera-wrap {
          overflow: auto;
          max-height: 70vh;
        }
        .escalera-table {
          font-variant-numeric: tabular-nums;
        }
        .escalera-table {
          border-collapse: collapse;
        }
        .escalera-table thead {
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .escalera-table thead th {
          background-color: var(--brand-900);
          color: #fff;
          border: none;
        }
        .escalera-table thead th.sticky-col {
          position: sticky;
          left: 0;
          z-index: 3;
          background-color: var(--brand-900);
        }
        .escalera-table thead th.sticky-col:first-child {
          z-index: 4;
        }
        .escalera-table thead th.sticky-col {
          left: 0;
          z-index: 3;
        }
        .escalera-table thead th.sticky-col:first-child {
          z-index: 4;
        }
      `}</style>
    </RequirePermission>
  );
}