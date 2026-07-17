"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { FiRefreshCw, FiTrash2, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getFirstMonday(year) {
  const jan1 = new Date(year, 0, 1);
  const day = jan1.getDay();
  const diff = day <= 1 ? 1 - day : 8 - day;
  return new Date(year, 0, 1 + diff);
}

function getDefaultTotalWeeks(year) {
  const jan1 = new Date(year, 0, 1);
  const day = jan1.getDay();
  return day === 1 || day === 2 ? 53 : 52;
}

const TOTAL_WEEKS_OPTIONS = [
  { value: 52, label: "52 semanas" },
  { value: 53, label: "53 semanas" },
];

const COLOR_HEX = {
  Azul: "#2563eb",
  Blanco: "#f8fafc",
  Amarillo: "#eab308",
  Morado: "#7c3aed",
  Rojo: "#dc2626",
  Café: "#78350f",
  Negro: "#111827",
  Verde: "#16a34a",
  Gris: "#6b7280",
};

export default function SemanasPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [fechaInicio, setFechaInicio] = useState("");
  const [totalSemanas, setTotalSemanas] = useState(52);

  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const [filterYear, setFilterYear] = useState(year);
  const [page, setPage] = useState(1);

  const pad = (n) => String(n).padStart(2, "0");

  const resetFormToYear = useCallback((y) => {
    setYear(y);
    setFechaInicio(toLocalDateStr(getFirstMonday(y)));
    setTotalSemanas(getDefaultTotalWeeks(y));
  }, []);

  useEffect(() => {
    resetFormToYear(year);
  }, [year, resetFormToYear]);

  async function loadWeeks(y) {
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/semanas?limit=55&anio=${y}`);
      setWeeks(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeeks(filterYear);
  }, [filterYear]);

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");
    setGenerating(true);
    try {
      await apiFetch("/semanas/generar-anio", {
        method: "POST",
        body: JSON.stringify({
          anio: year,
          fechaInicioSemana1: fechaInicio,
          totalSemanas,
        }),
      });
      setFilterYear(year);
      await loadWeeks(year);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteOne(uuid) {
    if (!confirm("¿Eliminar esta semana?")) return;
    try {
      await apiFetch(`/semanas/${uuid}`, { method: "DELETE" });
      loadWeeks(filterYear);
    } catch (err) {
      setError(err.message);
    }
  }

  const weeksPaged = weeks.slice((page - 1) * 20, page * 20);
  const totalPages = Math.max(1, Math.ceil(weeks.length / 20));

  return (
    <RequirePermission code="semana.ver">
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Semanas</h1>
        <p className="text-secondary mb-0">Configura las semanas por año. Cada semana empieza en lunes y dura 7 días.</p>
      </div>

      {/* Generate form */}
      <form onSubmit={handleGenerate} className="card border-0 shadow-sm rounded-4 p-4 mb-4">
        <h6 className="fw-bold mb-3">Generar año</h6>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-sm-3">
            <label className="form-label small fw-medium">Año</label>
            <input
              type="number"
              min={2000}
              max={2100}
              required
              className="form-control rounded-3"
              value={year}
              onChange={(e) => resetFormToYear(Number(e.target.value))}
            />
          </div>
          <div className="col-12 col-sm-4">
            <label className="form-label small fw-medium">Primer lunes de semana 1</label>
            <input
              type="date"
              required
              className="form-control rounded-3"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="col-12 col-sm-3">
            <label className="form-label small fw-medium">Total de semanas</label>
            <select
              className="form-select rounded-3"
              value={totalSemanas}
              onChange={(e) => setTotalSemanas(Number(e.target.value))}
            >
              {TOTAL_WEEKS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="form-text small mb-0 mt-1">
              Sugerido: {getDefaultTotalWeeks(year)} para {year}
            </p>
          </div>
          <div className="col-12 col-sm-2">
            <button
              type="submit"
              disabled={generating}
              className="btn btn-brand rounded-3 w-100 d-flex align-items-center justify-content-center gap-1"
            >
              <FiRefreshCw /> {generating ? "Generando..." : "Generar"}
            </button>
          </div>
        </div>
        {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
      </form>

      {/* Filter */}
      <div className="d-flex align-items-center gap-3 mb-3">
        <label className="small fw-medium text-nowrap mb-0">Filtrar por año:</label>
        <input
          type="number"
          min={2000}
          max={2100}
          className="form-control rounded-3"
          style={{ width: "7rem" }}
          value={filterYear}
          onChange={(e) => {
            setFilterYear(Number(e.target.value));
            setPage(1);
          }}
        />
        <span className="small text-secondary">{weeks.length} semana(s)</span>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Semana</th>
                <th>Código</th>
                <th>Color</th>
                {weeks.length > 0 && <th>Fecha inicio</th>}
                {weeks.length > 0 && <th>Fecha fin</th>}
                <th>Estado</th>
                <th className="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && weeks.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    No hay semanas para {filterYear}. Usa el formulario de arriba para generar el año.
                  </td>
                </tr>
              )}
              {!loading &&
                weeksPaged.map((semana) => (
                  <tr key={semana.uuid}>
                    <td>
                      <span className="fw-medium">Semana {semana.numeroSemana}</span>
                    </td>
                    <td>
                      <code className="small">{semana.codigo}</code>
                    </td>
                    <td>
                      <span className="d-inline-flex align-items-center gap-2">
                        <span
                          style={{
                            width: "0.85rem",
                            height: "0.85rem",
                            borderRadius: "50%",
                            display: "inline-block",
                            backgroundColor: COLOR_HEX[semana.color] || "#94a3b8",
                            border: semana.color === "Blanco" ? "1px solid #cbd5e1" : "none",
                          }}
                        />
                        <span className="small">{semana.color}</span>
                      </span>
                    </td>
                    <td>{semana.fechaInicio}</td>
                    <td>{semana.fechaFin}</td>
                    <td>
                      {semana.estado ? (
                        <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                          Activo
                        </span>
                      ) : (
                        <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-2 flex-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Eliminar"
                          onClick={() => handleDeleteOne(semana.uuid)}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <FiChevronLeft /> Anterior
          </button>
          <span className="small text-secondary">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente <FiChevronRight />
          </button>
        </div>
      )}
    </div>
    </RequirePermission>
  );
}
