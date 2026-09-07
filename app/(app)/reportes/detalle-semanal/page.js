"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiDownload,
  FiInfo,
  FiRefreshCw,
  FiPercent,
  FiPlusCircle,
  FiMinusCircle,
  FiXCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import SemanaAutocomplete from "@/components/SemanaAutocomplete";
import ReportesTabs from "@/components/ReportesTabs";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

const FILAS_CONCEPTO = [
  { key: "totalEmbolsado", label: "Embolsado", sign: 1, color: "#16a34a", excelFill: "FFD1FAE5", Icon: FiPlusCircle },
  { key: "totalRepicado", label: "Repicado", sign: -1, color: "#dc2626", excelFill: "FFFEE2E2", Icon: FiMinusCircle },
  { key: "totalRecusado", label: "Recusado", sign: -1, color: "#ea580c", excelFill: "FFFFEDD5", Icon: FiXCircle },
  { key: "totalProcesado", label: "Procesado", sign: -1, color: "#2563eb", excelFill: "FFDBEAFE", Icon: FiCheckCircle },
];

// Misma tabla dinámica que "Saldos × Lotes y Cintas" (columnas = cohortes de
// embolse), pero en vez de acumular toda la historia de cada cohorte, cada
// columna muestra solo lo que se movió en UNA semana de registro puntual —
// con su Saldo Inicial (lo acumulado antes de esa semana) y Saldo Final
// (Saldo Inicial + lo movido esa semana), en vez del saldo acumulado a hoy.
export default function MovimientosSemanaPage() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [semanas, setSemanas] = useState([]);
  const [semanaRegistroUuid, setSemanaRegistroUuid] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const cantidadSemanas = 13;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [verPorcentajes, setVerPorcentajes] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [conceptosExpandidos, setConceptosExpandidos] = useState(new Set());

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch((err) => setError(err.message));
    (async () => {
      try {
        let page = 1;
        let todas = [];
        while (true) {
          const res = await apiFetch(`/semanas?limit=100&page=${page}`);
          todas = todas.concat(res.items || []);
          if (page >= (res.meta?.totalPages || 1)) break;
          page += 1;
        }
        setSemanas(todas);
      } catch {
        // no bloquea el resto de la pantalla
      }
    })();
  }, []);

  const anioActual = new Date().getFullYear();
  const anioOpciones = [anioActual - 2, anioActual - 1, anioActual, anioActual + 1];

  async function handleConsultar() {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ anio: String(anio), cantidadSemanas: String(cantidadSemanas) });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (semanaRegistroUuid) params.set("semanaRegistroUuid", semanaRegistroUuid);
      const res = await apiFetch(`/racimo-movimientos/reporte-movimientos-semana?${params.toString()}`);
      setData(res);
      if (!semanaRegistroUuid && res.semanaRegistro) setSemanaRegistroUuid(res.semanaRegistro.uuid);
      setUltimaActualizacion(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handleConsultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaUuid, anio, semanaRegistroUuid]);

  const totAncho = 120 + (data?.cohortes?.length || 0) * 68;

  function valorClase(valor) {
    if (valor > 0) return "text-success fw-medium";
    if (valor < 0) return "text-danger fw-medium";
    return "";
  }

  function movimientoClase(valor) {
    return valor < 0 ? "text-danger fw-medium" : "fw-medium";
  }

  function toggleConcepto(key) {
    setConceptosExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function formato(valor, totalEmbolsadoCohorte) {
    if (verPorcentajes) {
      if (!totalEmbolsadoCohorte) return "—";
      const num = Number(valor);
      if (num === 0) return "—";
      return `${((num / totalEmbolsadoCohorte) * 100).toFixed(1)}%`;
    }
    const num = Number(valor);
    if (num === 0) return "—";
    return num.toLocaleString("es");
  }

  async function handleExportarExcel() {
    if (!data) return;
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const nombreFinca = data.finca ? data.finca.codigo : "todas";
      const sheet = workbook.addWorksheet(`Movimientos ${data.semanaRegistro.codigo}`);

      sheet.mergeCells(1, 1, 1, 2 + data.cohortes.length);
      const title = sheet.getCell(1, 1);
      title.value = `Movimientos por Lotes y Cintas — semana ${data.semanaRegistro.codigo} — ${
        data.finca ? data.finca.nombre : "Todas las fincas"
      }`;
      title.font = { bold: true, size: 14 };
      title.alignment = { horizontal: "center" };

      const headerRow = 3;
      sheet.getCell(headerRow, 1).value = "Concepto / Lote";
      sheet.getCell(headerRow, 1).font = { bold: true };
      sheet.getCell(headerRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

      data.cohortes.forEach((col, i) => {
        const c = sheet.getCell(headerRow, 2 + i);
        c.value = `${col.semanaCodigo} (${col.color}) — Edad ${col.edadSemanas} sem`;
        c.font = { bold: true, size: 9 };
        c.alignment = { wrapText: true, horizontal: "center" };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
      });

      let rowIdx = headerRow + 1;

      sheet.getCell(rowIdx, 1).value = "Saldo Inicial";
      sheet.getCell(rowIdx, 1).font = { bold: true };
      data.cohortes.forEach((col, i) => {
        sheet.getCell(rowIdx, 2 + i).value = col.saldoInicial;
        sheet.getCell(rowIdx, 2 + i).font = { bold: true };
      });
      rowIdx++;

      const lotesConSaldoInicial = data.lotes.filter((lote) =>
        data.cohortes.some((col) => (lote.saldoInicial[col.semanaUuid] || 0) !== 0),
      );
      lotesConSaldoInicial.forEach((lote) => {
        const celda = sheet.getCell(rowIdx, 1);
        celda.value = `    ${lote.codigo} — ${lote.nombre}`;
        celda.font = { italic: true, color: { argb: "FF6B7280" } };
        data.cohortes.forEach((col, i) => {
          sheet.getCell(rowIdx, 2 + i).value = lote.saldoInicial[col.semanaUuid] || 0;
        });
        rowIdx++;
      });

      for (const fila of FILAS_CONCEPTO) {
        const fillConcepto = { type: "pattern", pattern: "solid", fgColor: { argb: fila.excelFill } };
        const celdaLabel = sheet.getCell(rowIdx, 1);
        celdaLabel.value = fila.label;
        celdaLabel.font = { bold: true };
        celdaLabel.fill = fillConcepto;
        data.cohortes.forEach((col, i) => {
          const celda = sheet.getCell(rowIdx, 2 + i);
          celda.value = fila.sign * col[fila.key];
          celda.fill = fillConcepto;
        });
        rowIdx++;

        // Detalle por lote de ESTE concepto puntual (mismo dato que el
        // "expandir" en pantalla) — solo los lotes que tuvieron algo de
        // este tipo de movimiento en alguna de las cohortes visibles.
        const lotesDeEsteConcepto = data.lotes.filter((lote) =>
          data.cohortes.some((col) => (lote.porConcepto[fila.key][col.semanaUuid] || 0) !== 0),
        );
        lotesDeEsteConcepto.forEach((lote) => {
          const celda = sheet.getCell(rowIdx, 1);
          celda.value = `    ${lote.codigo} — ${lote.nombre}`;
          celda.font = { italic: true, color: { argb: "FF6B7280" } };
          data.cohortes.forEach((col, i) => {
            sheet.getCell(rowIdx, 2 + i).value = fila.sign * (lote.porConcepto[fila.key][col.semanaUuid] || 0);
          });
          rowIdx++;
        });
      }

      sheet.getCell(rowIdx, 1).value = "Saldo Final";
      sheet.getCell(rowIdx, 1).font = { bold: true };
      data.cohortes.forEach((col, i) => {
        sheet.getCell(rowIdx, 2 + i).value = col.saldoFinal;
        sheet.getCell(rowIdx, 2 + i).font = { bold: true };
      });
      rowIdx++;

      const lotesConSaldoFinal = data.lotes.filter((lote) =>
        data.cohortes.some((col) => (lote.saldoFinal[col.semanaUuid] || 0) !== 0),
      );
      lotesConSaldoFinal.forEach((lote) => {
        const celda = sheet.getCell(rowIdx, 1);
        celda.value = `    ${lote.codigo} — ${lote.nombre}`;
        celda.font = { italic: true, color: { argb: "FF6B7280" } };
        data.cohortes.forEach((col, i) => {
          sheet.getCell(rowIdx, 2 + i).value = lote.saldoFinal[col.semanaUuid] || 0;
        });
        rowIdx++;
      });

      sheet.getColumn(1).width = 30;
      for (let i = 0; i < data.cohortes.length; i++) {
        sheet.getColumn(2 + i).width = 18;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos_${data.semanaRegistro.codigo}_${nombreFinca}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  const horaActualizacion = useMemo(() => {
    if (!ultimaActualizacion) return "";
    return ultimaActualizacion.toLocaleString("es", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [ultimaActualizacion]);

  return (
    <RequirePermission code="menu.racimos.movimientos_semana">
      <div className="p-4 p-md-5">
        <ReportesTabs />
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiBarChart2 /> Saldo y Movimientos
            </h1>
            <p className="text-secondary mb-0">
              Movimientos de racimos de una semana de registro puntual, por lote y cinta, con saldo inicial y final.
            </p>
          </div>

          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label small fw-medium mb-1">Finca</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={fincaUuid}
                onChange={(e) => setFincaUuid(e.target.value)}
                style={{ minWidth: "10rem" }}
              >
                <option value="">Todas</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label small fw-medium mb-1">Semana de registro</label>
              <SemanaAutocomplete
                semanas={semanas}
                value={semanaRegistroUuid}
                onChange={setSemanaRegistroUuid}
                placeholder="Semana actual"
                width="9rem"
                limit={50}
              />
            </div>
            <div>
              <label className="form-label small fw-medium mb-1">Año</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={anio}
                onChange={(e) => {
                  setAnio(Number(e.target.value));
                  setSemanaRegistroUuid("");
                }}
              >
                {anioOpciones.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            {data && (
              <button
                type="button"
                className="btn btn-outline-success btn-sm rounded-3 d-flex align-items-center gap-2"
                onClick={handleExportarExcel}
                disabled={exporting}
              >
                <FiDownload /> {exporting ? "Generando..." : "Exportar Excel"}
              </button>
            )}
            <button
              type="button"
              className={`btn btn-sm rounded-3 d-flex align-items-center gap-2 ${
                verPorcentajes ? "btn-brand" : "btn-outline-secondary"
              }`}
              onClick={() => setVerPorcentajes((v) => !v)}
            >
              <FiPercent /> Ver porcentajes (%)
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleConsultar}
              disabled={loading}
              title="Actualizar"
            >
              <FiRefreshCw className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {ultimaActualizacion && (
          <p className="small text-secondary mb-2">Última actualización: {horaActualizacion}</p>
        )}

        {loading && !data && <p className="text-secondary">Cargando...</p>}

        {data && (
          <>
            <div className="alert alert-info d-flex align-items-center gap-2 py-2 small mb-3">
              <FiInfo /> Mostrando lo movido en la semana <strong>{data.semanaRegistro.codigo}</strong>, para{" "}
              {data.cohortes.length} cohortes desde edad 1 (izquierda) hasta edad {data.cohortes.length} (derecha)
              {data.finca ? (
                <>
                  {" "}
                  — finca <strong>{data.finca.nombre}</strong>.
                </>
              ) : (
                <> — todas las fincas (sin desglose por lote).</>
              )}
            </div>

            <div className="card border-0 shadow-sm rounded-4 p-0 overflow-auto">
              <div style={{ minWidth: totAncho + "px" }}>
                <table className="table table-bordered mb-0 align-middle" style={{ fontSize: "0.8125rem" }}>
                  <thead>
                    <tr>
                      <th
                        className="sticky-col bg-white text-secondary small fw-semibold"
                        style={{ minWidth: "120px", left: 0, zIndex: 3 }}
                      >
                        Concepto / Lote
                      </th>
                      {data.cohortes.map((col) => {
                        const bg = COLOR_HEX[col.color] || "#94a3b8";
                        const fg = COLOR_TEXT[col.color] || "#111827";
                        return (
                          <th
                            key={col.semanaUuid}
                            className="text-center"
                            style={{ minWidth: "68px", backgroundColor: bg, color: fg }}
                          >
                            <div className="fw-bold" style={{ fontSize: "0.7rem" }}>
                              {col.color?.toUpperCase()}
                            </div>
                            <div style={{ fontSize: "0.75rem" }}>{col.semanaCodigo}</div>
                            <div className="small" style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                              Edad {col.edadSemanas}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const puedeExpandir = data.lotes.length > 0;
                      const expandido = puedeExpandir && conceptosExpandidos.has("saldoInicial");
                      const lotesConDato = expandido
                        ? data.lotes.filter((lote) => data.cohortes.some((col) => (lote.saldoInicial[col.semanaUuid] || 0) !== 0))
                        : [];
                      return (
                        <Fragment key="saldoInicial">
                          <tr style={{ borderBottom: "2px solid #94a3b8" }}>
                            <td className="sticky-col fw-bold bg-white" style={{ left: 0, zIndex: 2 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0 d-flex align-items-center gap-2 fw-bold text-decoration-none text-dark"
                                onClick={() => puedeExpandir && toggleConcepto("saldoInicial")}
                                disabled={!puedeExpandir}
                                title={puedeExpandir ? "Ver por lote" : "Elegí una finca para ver el detalle por lote"}
                              >
                                {puedeExpandir ? expandido ? <FiChevronDown size={13} /> : <FiChevronRight size={13} /> : null}
                                Saldo Inicial
                              </button>
                            </td>
                            {data.cohortes.map((col) => (
                              <td key={col.semanaUuid} className={`text-center fw-bold ${movimientoClase(col.saldoInicial)}`}>
                                {formato(col.saldoInicial, col.totalEmbolsado)}
                              </td>
                            ))}
                          </tr>
                          {expandido && lotesConDato.length === 0 && (
                            <tr>
                              <td
                                className="sticky-col text-secondary small fst-italic"
                                style={{ left: 0, zIndex: 2, backgroundColor: "#fff" }}
                              >
                                Ningún lote tenía saldo inicial en las cohortes visibles.
                              </td>
                              <td colSpan={data.cohortes.length} style={{ backgroundColor: "#fff" }} />
                            </tr>
                          )}
                          {expandido &&
                            lotesConDato.map((lote) => (
                              <tr key={`saldoInicial-${lote.uuid}`}>
                                <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2, paddingLeft: "1.75rem" }}>
                                  <span className="text-secondary small">{lote.codigo}</span>
                                  <span className="text-muted small ms-1">— {lote.nombre}</span>
                                </td>
                                {data.cohortes.map((col) => {
                                  const val = lote.saldoInicial[col.semanaUuid] || 0;
                                  return (
                                    <td key={col.semanaUuid} className={`text-center ${val ? movimientoClase(val) : "text-secondary"}`}>
                                      {formato(val, col.totalEmbolsado)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })()}

                    {FILAS_CONCEPTO.map((fila) => {
                      const puedeExpandir = data.lotes.length > 0;
                      const expandido = puedeExpandir && conceptosExpandidos.has(fila.key);
                      // Solo lotes que tuvieron algo de este concepto en al
                      // menos una de las cohortes visibles — no tiene sentido
                      // listar lotes en cero en las 14 columnas.
                      const lotesConDato = expandido
                        ? data.lotes.filter((lote) => data.cohortes.some((col) => (lote.porConcepto[fila.key][col.semanaUuid] || 0) !== 0))
                        : [];
                      return (
                        <Fragment key={fila.key}>
                          <tr style={{ backgroundColor: "#eef2f6" }}>
                            <td className="sticky-col" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0 d-flex align-items-center gap-2 fw-semibold text-decoration-none"
                                style={{ color: fila.color }}
                                onClick={() => puedeExpandir && toggleConcepto(fila.key)}
                                disabled={!puedeExpandir}
                                title={puedeExpandir ? "Ver por lote" : "Elegí una finca para ver el detalle por lote"}
                              >
                                {puedeExpandir ? expandido ? <FiChevronDown size={13} /> : <FiChevronRight size={13} /> : null}
                                <fila.Icon /> {fila.label}
                              </button>
                            </td>
                            {data.cohortes.map((col) => {
                              const val = fila.sign * col[fila.key];
                              return (
                                <td
                                  key={col.semanaUuid}
                                  className={`text-center ${valorClase(val)}`}
                                  style={{ backgroundColor: "#eef2f6" }}
                                >
                                  {formato(val, col.totalEmbolsado)}
                                </td>
                              );
                            })}
                          </tr>
                          {expandido && lotesConDato.length === 0 && (
                            <tr>
                              <td
                                className="sticky-col text-secondary small fst-italic"
                                style={{ left: 0, zIndex: 2, backgroundColor: "#fff" }}
                              >
                                Ningún lote tuvo {fila.label.toLowerCase()} en las cohortes visibles.
                              </td>
                              <td colSpan={data.cohortes.length} style={{ backgroundColor: "#fff" }} />
                            </tr>
                          )}
                          {expandido &&
                            lotesConDato.map((lote) => (
                              <tr key={`${fila.key}-${lote.uuid}`}>
                                <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2, paddingLeft: "1.75rem" }}>
                                  <span className="text-secondary small">{lote.codigo}</span>
                                  <span className="text-muted small ms-1">— {lote.nombre}</span>
                                </td>
                                {data.cohortes.map((col) => {
                                  const val = fila.sign * (lote.porConcepto[fila.key][col.semanaUuid] || 0);
                                  return (
                                    <td key={col.semanaUuid} className={`text-center ${val ? "fw-medium" : "text-secondary"}`}>
                                      {formato(val, col.totalEmbolsado)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}


                    {(() => {
                      const puedeExpandir = data.lotes.length > 0;
                      const expandido = puedeExpandir && conceptosExpandidos.has("saldoFinal");
                      const lotesConDato = expandido
                        ? data.lotes.filter((lote) => data.cohortes.some((col) => (lote.saldoFinal[col.semanaUuid] || 0) !== 0))
                        : [];
                      return (
                        <Fragment key="saldoFinal">
                          <tr style={{ borderTop: "2px solid #94a3b8" }}>
                            <td className="sticky-col fw-bold bg-white" style={{ left: 0, zIndex: 2 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0 d-flex align-items-center gap-2 fw-bold text-decoration-none text-dark"
                                onClick={() => puedeExpandir && toggleConcepto("saldoFinal")}
                                disabled={!puedeExpandir}
                                title={puedeExpandir ? "Ver por lote" : "Elegí una finca para ver el detalle por lote"}
                              >
                                {puedeExpandir ? expandido ? <FiChevronDown size={13} /> : <FiChevronRight size={13} /> : null}
                                Saldo Final
                              </button>
                            </td>
                            {data.cohortes.map((col) => (
                              <td key={col.semanaUuid} className={`text-center fw-bold ${movimientoClase(col.saldoFinal)}`}>
                                {formato(col.saldoFinal, col.totalEmbolsado)}
                              </td>
                            ))}
                          </tr>
                          {expandido && lotesConDato.length === 0 && (
                            <tr>
                              <td
                                className="sticky-col text-secondary small fst-italic"
                                style={{ left: 0, zIndex: 2, backgroundColor: "#fff" }}
                              >
                                Ningún lote tenía saldo final en las cohortes visibles.
                              </td>
                              <td colSpan={data.cohortes.length} style={{ backgroundColor: "#fff" }} />
                            </tr>
                          )}
                          {expandido &&
                            lotesConDato.map((lote) => (
                              <tr key={`saldoFinal-${lote.uuid}`}>
                                <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2, paddingLeft: "1.75rem" }}>
                                  <span className="text-secondary small">{lote.codigo}</span>
                                  <span className="text-muted small ms-1">— {lote.nombre}</span>
                                </td>
                                {data.cohortes.map((col) => {
                                  const val = lote.saldoFinal[col.semanaUuid] || 0;
                                  return (
                                    <td key={col.semanaUuid} className={`text-center ${val ? movimientoClase(val) : "text-secondary"}`}>
                                      {formato(val, col.totalEmbolsado)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!data && !loading && (
          <p className="text-secondary text-center py-5">No hay datos para los filtros seleccionados.</p>
        )}
      </div>

      <style jsx>{`
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 2;
        }
        .table th,
        .table td {
          white-space: nowrap;
          vertical-align: middle;
          padding: 0.25rem 0.3rem;
        }
        .table tbody th,
        .table tbody td {
          padding-top: 0.2rem;
          padding-bottom: 0.2rem;
        }
        .table-bordered th,
        .table-bordered td {
          border: 1px solid #e2e8f0;
        }
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </RequirePermission>
  );
}
