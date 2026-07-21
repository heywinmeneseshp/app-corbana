"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiDownload,
  FiInfo,
  FiFilter,
  FiRefreshCw,
  FiPercent,
  FiPlusCircle,
  FiMinusCircle,
  FiXCircle,
  FiCheckCircle,
} from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

const FILAS_CONCEPTO = [
  { key: "totalEmbolsado", label: "Total Embolsado", sign: 1, color: "#16a34a", Icon: FiPlusCircle },
  { key: "totalRepicado", label: "Total Repicado", sign: -1, color: "#dc2626", Icon: FiMinusCircle },
  { key: "totalRecusado", label: "Total Recusado", sign: -1, color: "#ea580c", Icon: FiXCircle },
  { key: "totalProcesado", label: "Total Procesado", sign: -1, color: "#2563eb", Icon: FiCheckCircle },
];

export default function SaldosLotesCintasPage() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [semanas, setSemanas] = useState(12);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [verPorcentajes, setVerPorcentajes] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch((err) => setError(err.message));
  }, []);

  const anioActual = new Date().getFullYear();
  const anioOpciones = [anioActual - 2, anioActual - 1, anioActual, anioActual + 1];

  async function handleConsultar() {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ anio: String(anio), cantidadSemanas: String(semanas) });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      const res = await apiFetch(`/racimo-movimientos/reporte-saldos?${params.toString()}`);
      setData(res);
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
  }, [fincaUuid, anio, semanas]);

  const totAncho = 120 + (data?.cohortes?.length || 0) * 68;

  function valorClase(valor) {
    if (valor > 0) return "text-success fw-medium";
    if (valor < 0) return "text-danger fw-medium";
    return "";
  }

  // Para saldos (por lote y el saldo final): negro si es positivo, rojo
  // solo si es negativo (a diferencia de las filas de concepto, que usan
  // verde/rojo para distinguir categorías).
  function saldoClase(valor) {
    return valor < 0 ? "text-danger fw-medium" : "fw-medium";
  }

  function formato(valor, totalEmbolsadoCohorte) {
    if (verPorcentajes) {
      if (!totalEmbolsadoCohorte) return "—";
      return `${((Number(valor) / totalEmbolsadoCohorte) * 100).toFixed(1)}%`;
    }
    return Number(valor).toLocaleString("es");
  }

  async function handleExportarExcel() {
    if (!data) return;
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const nombreFinca = data.finca ? data.finca.codigo : "todas";
      const sheet = workbook.addWorksheet(`Saldos ${nombreFinca} ${anio}`);

      sheet.mergeCells(1, 1, 1, 2 + data.cohortes.length);
      const title = sheet.getCell(1, 1);
      title.value = `Saldos por Lotes y Cintas — ${data.finca ? data.finca.nombre : "Todas las fincas"} (${anio})`;
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
      for (const fila of FILAS_CONCEPTO) {
        sheet.getCell(rowIdx, 1).value = fila.label;
        sheet.getCell(rowIdx, 1).font = { bold: true };
        data.cohortes.forEach((col, i) => {
          sheet.getCell(rowIdx, 2 + i).value = col[fila.key];
        });
        rowIdx++;
      }

      sheet.getCell(rowIdx, 1).value = "";
      rowIdx++;

      data.lotes.forEach((lote) => {
        sheet.getCell(rowIdx, 1).value = `${lote.codigo} — ${lote.nombre}`;
        data.cohortes.forEach((col, i) => {
          sheet.getCell(rowIdx, 2 + i).value = lote.saldos[col.semanaUuid] || 0;
        });
        rowIdx++;
      });

      sheet.getCell(rowIdx, 1).value = "Saldo Final";
      sheet.getCell(rowIdx, 1).font = { bold: true };
      data.cohortes.forEach((col, i) => {
        sheet.getCell(rowIdx, 2 + i).value = col.saldo;
        sheet.getCell(rowIdx, 2 + i).font = { bold: true };
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
      a.download = `saldos_${nombreFinca}_${anio}.xlsx`;
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
    <RequirePermission code="racimo_movimiento.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiBarChart2 /> Saldos por Lotes y Cintas
            </h1>
            <p className="text-secondary mb-0">
              Movimientos y saldos de racimos por cohorte de embolse.
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
              <label className="form-label small fw-medium mb-1">Año</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              >
                {anioOpciones.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label small fw-medium mb-1">Semanas a visualizar</label>
              <input
                type="number"
                min={1}
                max={53}
                className="form-control form-control-sm rounded-3"
                style={{ width: "5.5rem" }}
                value={semanas}
                onChange={(e) => setSemanas(Math.min(53, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={() => setMostrarFiltros((v) => !v)}
              disabled={!fincaUuid}
              title={!fincaUuid ? "Elegí una finca para filtrar por lote" : undefined}
            >
              <FiFilter /> Filtros
            </button>
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

        {mostrarFiltros && fincaUuid && (
          <div className="alert alert-light border small mb-3">
            Filtros adicionales por lote próximamente. Por ahora, el reporte muestra todos los lotes de la finca
            seleccionada.
          </div>
        )}

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {ultimaActualizacion && (
          <p className="small text-secondary mb-2">Última actualización: {horaActualizacion}</p>
        )}

        {loading && !data && <p className="text-secondary">Cargando...</p>}

        {data && (
          <>
            <div className="alert alert-info d-flex align-items-center gap-2 py-2 small mb-3">
              <FiInfo /> Mostrando {data.cohortes.length} cohortes desde la semana{" "}
              <strong>{data.semanaActual.codigo}</strong> (edad 1, izquierda) hasta la semana{" "}
              <strong>{data.cohortes[data.cohortes.length - 1]?.semanaCodigo}</strong> (edad {data.cohortes.length}, derecha)
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
                    {FILAS_CONCEPTO.map((fila) => (
                      <tr key={fila.key} style={{ backgroundColor: "#eef2f6" }}>
                        <td className="sticky-col" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                          <span className="d-flex align-items-center gap-2 fw-semibold" style={{ color: fila.color }}>
                            <fila.Icon /> {fila.label}
                          </span>
                        </td>
                        {data.cohortes.map((col) => {
                          const val = col[fila.key];
                          return (
                            <td
                              key={col.semanaUuid}
                              className={`text-center ${valorClase(fila.sign * val)}`}
                              style={{ backgroundColor: "#eef2f6" }}
                            >
                              {formato(val, col.totalEmbolsado)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    <tr style={{ backgroundColor: "#eef2f6" }}>
                      <td className="sticky-col fw-semibold" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                        Recobros
                      </td>
                      {data.cohortes.map((col) => (
                        <td key={col.semanaUuid} className="text-center fw-medium" style={{ backgroundColor: "#eef2f6" }}>
                          {col.totalEmbolsado
                            ? `${(
                                ((col.totalProcesado + col.totalRecusado + col.totalRepicado) / col.totalEmbolsado) *
                                100
                              ).toFixed(1)}%`
                            : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ backgroundColor: "#eef2f6" }}>
                      <td className="sticky-col fw-semibold" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                        Aprovechamiento
                      </td>
                      {data.cohortes.map((col) => (
                        <td key={col.semanaUuid} className="text-center fw-medium" style={{ backgroundColor: "#eef2f6" }}>
                          {col.totalEmbolsado
                            ? `${(((col.totalRecusado + col.totalProcesado) / col.totalEmbolsado) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td colSpan={data.cohortes.length + 1} style={{ height: "0.5rem", backgroundColor: "#f1f5f9" }} />
                    </tr>

                    {data.lotes.map((lote) => (
                      <tr key={lote.uuid}>
                        <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2 }}>
                          <span className="text-secondary small fw-semibold">{lote.codigo}</span>
                          <span className="text-muted small ms-1">— {lote.nombre}</span>
                        </td>
                        {data.cohortes.map((col) => {
                          const val = lote.saldos[col.semanaUuid] || 0;
                          return (
                            <td key={col.semanaUuid} className={`text-center ${saldoClase(val)}`}>
                              {formato(val, col.totalEmbolsado)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    <tr style={{ borderTop: "2px solid #94a3b8" }}>
                      <td className="sticky-col fw-bold bg-white" style={{ left: 0, zIndex: 2 }}>
                        Saldo
                      </td>
                      {data.cohortes.map((col) => {
                        const val = col.saldo;
                        return (
                          <td key={col.semanaUuid} className={`text-center fw-bold ${saldoClase(val)}`}>
                            {formato(val, col.totalEmbolsado)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-secondary mt-2" style={{ fontSize: "0.7rem" }}>
              <p className="mb-1">
                <FiInfo className="me-1" />
                <strong>Recobros</strong> = (Total Procesado + Total Recusado + Total Repicado) / Total Embolsado — el
                % de racimos embolsados que ya tuvieron algún movimiento de salida (repique, recuse o procesado).
              </p>
              <p className="mb-0">
                <FiInfo className="me-1" />
                <strong>Aprovechamiento</strong> = (Total Recusado + Total Procesado) / Total Embolsado — el % de
                racimos embolsados que llegaron a cosecha (aceptados o no), sin contar los que se repicaron antes.
              </p>
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
