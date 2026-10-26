"use client";

import { useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

const CONCEPTOS = [
  { key: "saldo", label: "Saldo", fill: "FFDCF3E6" },
  { key: "embolsado", label: "Embolsado", fill: "FFD1FAE5" },
  { key: "repicado", label: "Repicado", fill: "FFFEE2E2" },
  { key: "recusado", label: "Recusado", fill: "FFFFEDD5" },
  { key: "procesado", label: "Procesado", fill: "FFDBEAFE" },
  { key: "cosechado", label: "Cosechado (procesado + recusado)", fill: "FFE0E7FF" },
];

// Escalera de totales acumulados: filas = semana de registro, columnas = cinta (semana de embolse). Cada celda es lo acumulado de esa
// cinta hasta el fin de esa semana, para el concepto elegido (saldo = cómo terminó la cinta esa semana).
export default function EscaleraSaldos({ fincaUuid, anio }) {
  const [concepto, setConcepto] = useState("saldo");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ anio: String(anio), cantidadSemanas: "13" });
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    apiFetch(`/racimo-movimientos/reporte-escalera?${params.toString()}`)
      .then((res) => vivo && setData(res))
      .catch((err) => vivo && setError(err.message))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
  }, [fincaUuid, anio]);

  // La ultima semana con movimientos hace de semana actual (resaltada como en Estimaciones).
  const actual = data?.filas?.[data.filas.length - 1];
  const meta = CONCEPTOS.find((c) => c.key === concepto);
  const valor = (fila, cinta) => data?.celdas?.[`${fila.uuid}|${cinta.uuid}`]?.[concepto];

  async function exportar() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(meta.label.slice(0, 28), { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
    const rell = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + hex.replace("#", "").toUpperCase() } });
    const argb = (hex) => ({ argb: "FF" + hex.replace("#", "").toUpperCase() });
    const borde = { bottom: { style: "thin", color: argb("#F1F3F5") } };
    const head = sheet.addRow(["Semana de registro", ...data.cintas.map((c) => c.codigo)]);
    head.eachCell((cell, n) => {
      const cinta = data.cintas[n - 2];
      cell.fill = rell(cinta ? COLOR_HEX[cinta.color] || "#94a3b8" : "#14532D");
      cell.font = { bold: true, color: argb(cinta ? COLOR_TEXT[cinta.color] || "#111827" : "#FFFFFF") };
      cell.alignment = { horizontal: "center" };
      if (cinta && actual && cinta.uuid === actual.uuid) cell.border = { bottom: { style: "thick", color: argb("#15803D") } };
    });
    data.filas.forEach((fila) => {
      const esFilaActual = actual && fila.uuid === actual.uuid;
      const row = sheet.addRow([fila.codigo, ...data.cintas.map((c) => valor(fila, c) ?? null)]);
      // Semana de registro en verde, como en Estimaciones (clara si es la semana actual).
      row.getCell(1).fill = rell(esFilaActual ? "#DCF3E6" : "#14532D");
      row.getCell(1).font = { bold: true, color: argb(esFilaActual ? "#14532D" : "#FFFFFF") };
      row.getCell(1).alignment = { horizontal: "center" };
      data.cintas.forEach((c, i) => {
        const cell = row.getCell(i + 2);
        const v = valor(fila, c);
        const esDiagonal = c.uuid === fila.uuid;
        const esColActual = actual && c.uuid === actual.uuid;
        let fondo = v === undefined ? "#E9ECEF" : v === 0 ? "#F1F8F4" : "#FFFFFF";
        let color = v < 0 ? "#DC2626" : "#1F2937";
        let negrita = esDiagonal;
        if (esFilaActual && esColActual) {
          fondo = "#DCF3E6";
          color = "#14532D";
          negrita = true;
        } else if (esFilaActual && v !== undefined) fondo = "#E3F2E9";
        cell.fill = rell(fondo);
        cell.font = { size: 10, bold: negrita, color: argb(color) };
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "center" };
        cell.border = borde;
      });
    });
    sheet.getColumn(1).width = 18;
    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `escalera_${concepto}_${data.finca?.codigo || "todas"}_${data.anio}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div>
          <label className="form-label small fw-medium mb-1">Concepto acumulado</label>
          <select className="form-select form-select-sm rounded-3" value={concepto} onChange={(e) => setConcepto(e.target.value)}>
            {CONCEPTOS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {data && (
          <button type="button" className="btn btn-outline-success btn-sm rounded-3 d-flex align-items-center gap-2" onClick={exportar}>
            <FiDownload /> Exportar Excel
          </button>
        )}
      </div>
      <p className="small text-secondary">
        Cada fila es una semana de registro y cada columna una cinta: el número es el {meta.label.toLowerCase()} acumulado de esa cinta al cierre de esa
        semana (solo se muestran las cintas de hasta 13 semanas de edad).
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading && !data && <p className="text-secondary">Cargando...</p>}
      {data && data.filas.length === 0 && <p className="text-secondary text-center py-5">No hay datos para los filtros seleccionados.</p>}
      {data && data.filas.length > 0 && (
        <div className="table-responsive escalera-wrap card border-0 shadow-sm rounded-4 p-0">
          <table className="table table-sm align-middle mb-0 small escalera-table">
            <thead>
              <tr>
                <th className="sticky-col text-center" style={{ minWidth: "5.5rem" }} />
                {data.cintas.map((c) => (
                  <th
                    key={c.uuid}
                    className={`text-center fw-medium ${actual && c.uuid === actual.uuid ? "col-actual" : ""}`}
                    title={`${c.codigo} · ${c.color}`}
                    style={{ minWidth: "4.6rem", backgroundColor: COLOR_HEX[c.color] || "#94a3b8", color: COLOR_TEXT[c.color] || "#111827" }}
                  >
                    {c.codigo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filas.map((fila) => {
                const esFilaActual = actual && fila.uuid === actual.uuid;
                return (
                  <tr key={fila.uuid}>
                    <td
                      className="fw-medium text-center sticky-col"
                      style={{ minWidth: "5.5rem", backgroundColor: esFilaActual ? "#dcf3e6" : "#14532d", color: esFilaActual ? "#14532d" : "#fff" }}
                    >
                      {fila.codigo}
                    </td>
                    {data.cintas.map((c) => {
                      const v = valor(fila, c);
                      const dentro = v !== undefined;
                      const esDiagonal = c.uuid === fila.uuid;
                      const esCruce = esFilaActual && actual && c.uuid === actual.uuid;
                      const clases = [
                        "text-center escalera-valor",
                        esDiagonal ? "fw-medium" : "",
                        !dentro ? "fuera-escalera" : "",
                        dentro && v === 0 ? "dentro-escalera-vacia" : "",
                        esCruce ? "present-cell" : esFilaActual && dentro ? "present-row-cell" : "",
                        v < 0 ? "valor-negativo" : "",
                      ];
                      return (
                        <td key={c.uuid} className={clases.filter(Boolean).join(" ")}>
                          {dentro ? v.toLocaleString("es") : ""}
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
      <style jsx>{`
        .escalera-wrap { overflow: auto; max-height: 70vh; }
        .escalera-table { font-variant-numeric: tabular-nums; border-collapse: collapse; }
        .escalera-table thead { position: sticky; top: 0; z-index: 2; }
        .escalera-table thead th { font-weight: 600; border: none; }
        .escalera-table thead th.col-actual { box-shadow: inset 0 -3px 0 #15803d; }
        .escalera-table td, .escalera-table th { border-left: none; border-right: none; border-top: none; white-space: nowrap; }
        .escalera-table tbody td { border-bottom: 1px solid #f1f3f5; }
        .escalera-table tbody td.escalera-valor { background-color: #fff !important; color: #1f2937 !important; font-size: 0.72rem; }
        .escalera-table tbody td.escalera-valor.fuera-escalera { background-color: #e9ecef !important; }
        .escalera-table tbody td.escalera-valor.dentro-escalera-vacia { background-color: #f1f8f4 !important; }
        .escalera-table tbody td.escalera-valor.present-row-cell { background-color: #e3f2e9 !important; }
        .escalera-table tbody td.escalera-valor.present-cell { background-color: #dcf3e6 !important; color: #14532d !important; font-weight: 700 !important; }
        .escalera-table tbody td.escalera-valor.valor-negativo { color: #dc2626 !important; }
        .escalera-table .sticky-col { position: sticky; left: 0; z-index: 1; font-weight: 600; border: none !important; }
        .escalera-table thead th.sticky-col { z-index: 4; background-color: #14532d; color: #fff; }
      `}</style>
    </div>
  );
}
