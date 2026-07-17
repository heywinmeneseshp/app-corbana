"use client";

import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiFileText } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { buildCalendarYear, DIAS } from "@/lib/calendarBuilder";
import { calcularColorSemana, COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

export default function CalendarioPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [semanas, setSemanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [prev, curr, next] = await Promise.all([
          apiFetch(`/semanas?limit=55&anio=${year - 1}`),
          apiFetch(`/semanas?limit=55&anio=${year}`),
          apiFetch(`/semanas?limit=55&anio=${year + 1}`),
        ]);
        const all = [...prev.items, ...curr.items, ...next.items].map((s) => ({
          ...s,
          color: s.color || calcularColorSemana(s.anio, s.numeroSemana),
        }));
        setSemanas(all);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year]);

  const months = useMemo(() => buildCalendarYear(year, semanas), [year, semanas]);
  const hasSemanas = semanas.some((s) => s.anio === year);

  async function handleExportExcel() {
    setExporting("excel");
    try {
      const { downloadCalendarExcel } = await import("@/lib/calendarExport");
      await downloadCalendarExcel(year, months);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting("");
    }
  }

  async function handleExportPdf() {
    setExporting("pdf");
    try {
      const { downloadCalendarPdf } = await import("@/lib/calendarExport");
      downloadCalendarPdf(year, months);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting("");
    }
  }

  return (
    <RequirePermission code="semana.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Calendario</h1>
            <p className="text-secondary mb-0">
              Calendario anual con el número de semana y el color de cinta de embolse de cada semana.
            </p>
          </div>
          <div className="d-flex align-items-end gap-2">
            <div>
              <label className="form-label small fw-medium mb-1">Año</label>
              <input
                type="number"
                min={2000}
                max={2100}
                className="form-control rounded-3"
                style={{ width: "8rem" }}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline-success rounded-3 d-flex align-items-center gap-2"
              onClick={handleExportExcel}
              disabled={!!exporting || loading}
            >
              <FiDownload /> {exporting === "excel" ? "Generando..." : "Excel"}
            </button>
            <button
              type="button"
              className="btn btn-outline-danger rounded-3 d-flex align-items-center gap-2"
              onClick={handleExportPdf}
              disabled={!!exporting || loading}
            >
              <FiFileText /> {exporting === "pdf" ? "Generando..." : "PDF"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {loading && <p className="text-secondary">Cargando...</p>}

        {!loading && !hasSemanas && (
          <div className="alert alert-warning py-2 small">
            No hay semanas generadas para {year}. Ve a Maestros → Semanas y genera el año primero.
          </div>
        )}

        {!loading && hasSemanas && (
          <div className="row g-3">
            {months.map((mes) => (
              <div className="col-12 col-md-6 col-lg-4" key={mes.nombre}>
                <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
                  <h6 className="fw-bold text-center mb-2">{mes.nombre}</h6>
                  <table className="table table-sm mb-0 text-center align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: "1.75rem" }}></th>
                        {DIAS.map((d, i) => (
                          <th key={i} className="small">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mes.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td
                            className="small fw-bold rounded-2"
                            style={{
                              backgroundColor: row.semana ? COLOR_HEX[row.semana.color] || "#94a3b8" : "transparent",
                              color: row.semana ? COLOR_TEXT[row.semana.color] || "#111827" : "inherit",
                            }}
                          >
                            {row.semana?.numeroSemana ?? ""}
                          </td>
                          {row.days.map((day, dIdx) => (
                            <td key={dIdx} className={`small ${day.inMonth ? "" : "text-secondary opacity-50"}`}>
                              {day.day}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
