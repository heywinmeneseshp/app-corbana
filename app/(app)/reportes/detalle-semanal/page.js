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
import EscaleraSaldos from "@/components/reportes/EscaleraSaldos";
import TablaMovimientosSemana, { FILAS_CONCEPTO } from "@/components/reportes/TablaMovimientosSemana";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";


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
  const [vista, setVista] = useState("semana");

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

        <div className="btn-group btn-group-sm mb-3" role="group">
          <button type="button" className={`btn ${vista === "semana" ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => setVista("semana")}>
            Por semana
          </button>
          <button type="button" className={`btn ${vista === "escalera" ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => setVista("escalera")}>
            Escalera (acumulado)
          </button>
        </div>

        {vista === "escalera" && <EscaleraSaldos fincaUuid={fincaUuid} anio={anio} />}

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {ultimaActualizacion && (
          <p className="small text-secondary mb-2">Última actualización: {horaActualizacion}</p>
        )}

        {loading && !data && <p className="text-secondary">Cargando...</p>}

        {vista === "semana" && data && (
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

            <TablaMovimientosSemana data={data} verPorcentajes={verPorcentajes} />
          </>
        )}

        {vista === "semana" && !data && !loading && (
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
