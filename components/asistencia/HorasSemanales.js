"use client";

import { useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { SelectorUbicacion, aParametros } from "./ubicaciones";

const hoyBogota = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const restarDias = (fecha, n) => new Date(new Date(`${fecha}T12:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10);
const horas = (min) => (min ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}` : "—");
const horasDecimal = (min) => Math.round((min / 60) * 100) / 100;

// Informe de horas trabajadas por semana y colaborador: suma el tiempo en lugares de cada jornada.
export default function HorasSemanales({ fincas, lugares = [], veTodo = true, modulo = null }) {
  const vacios = () => ({ ubicacion: "", search: "", desde: restarDias(hoyBogota(), 27), hasta: hoyBogota() });
  const [filtros, setFiltros] = useState(vacios);
  const [aplicados, setAplicados] = useState(filtros);
  const [datos, setDatos] = useState({ semanas: [], items: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setAplicados((a) => (JSON.stringify(a) === JSON.stringify(filtros) ? a : filtros)), 300);
    return () => clearTimeout(t);
  }, [filtros]);

  useEffect(() => {
    let activo = true;
    const { ubicacion, ...resto } = aplicados;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...resto, ...aParametros(ubicacion) })) if (v) qs.set(k, v);
    if (modulo) qs.set("modulo", modulo);
    apiFetch(`/asistencia/horas-semanales?${qs}`)
      .then((d) => activo && (setDatos(d), setError("")))
      .catch((err) => activo && setError(err.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [aplicados, modulo]);

  const cambiar = (k, v) => {
    setCargando(true);
    setFiltros((f) => ({ ...f, [k]: v }));
  };
  const { semanas = [], items = [] } = datos;
  const totalSemana = (codigo) => items.reduce((s, x) => s + (x.semanas[codigo] || 0), 0);

  async function exportar() {
    const ExcelJS = (await import("exceljs")).default;
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Horas por semana");
    hoja.columns = [
      { header: "Colaborador", key: "nombre", width: 32 },
      { header: "Identificación", key: "documento", width: 16 },
      { header: "Cargo", key: "cargo", width: 22 },
      ...semanas.map((s) => ({ header: `${s.codigo} (h)`, key: s.codigo, width: 12 })),
      { header: "Total (h)", key: "total", width: 12 },
      ...semanas.map((s) => ({ header: `Tránsito ${s.codigo} (h)`, key: `t_${s.codigo}`, width: 16 })),
      { header: "Tránsito total (h)", key: "transito", width: 16 },
      { header: "Días trabajados", key: "dias", width: 14 },
      { header: "Jornadas incompletas", key: "incompletas", width: 18 },
      { header: "Días con novedad", key: "novedades", width: 16 },
    ];
    hoja.getRow(1).font = { bold: true };
    for (const x of items) {
      const fila = { nombre: x.colaborador.nombre, documento: x.colaborador.documento || "", cargo: x.colaborador.cargo || "", total: horasDecimal(x.minutos), transito: horasDecimal(x.transito || 0), dias: x.dias, incompletas: x.incompletas, novedades: x.novedades };
      for (const s of semanas) {
        fila[s.codigo] = horasDecimal(x.semanas[s.codigo] || 0);
        fila[`t_${s.codigo}`] = horasDecimal(x.transitoSemanas?.[s.codigo] || 0);
      }
      hoja.addRow(fila);
    }
    const blob = new Blob([await libro.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `horas-por-semana-${aplicados.desde}-a-${aplicados.hasta}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="card border-0 rounded-2 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Ubicación</label>
              <SelectorUbicacion fincas={fincas} lugares={lugares} value={filtros.ubicacion} onChange={(v) => cambiar("ubicacion", v)} />
            </div>
            {veTodo && (
              <div className="col-6 col-md">
                <label className="form-label small fw-medium">Colaborador</label>
                <input type="search" className="form-control form-control-sm rounded-3" placeholder="Nombre o identificación" value={filtros.search} onChange={(e) => cambiar("search", e.target.value)} />
              </div>
            )}
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Desde</label>
              <input type="date" className="form-control form-control-sm rounded-3" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} />
            </div>
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Hasta</label>
              <input type="date" className="form-control form-control-sm rounded-3" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} />
            </div>
            <div className="col-12 col-md-auto">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" disabled={!items.length} onClick={exportar}>
                <FiDownload /> Excel
              </button>
            </div>
          </div>
          <div className="small text-secondary mt-2">Horas en formato h:mm, por semana del calendario. En morado, el tránsito entre lugares (no se suma al total). Una jornada incompleta (sin entrada o sin salida) no suma horas. Rango máximo: 62 días.</div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.72rem" }}>
            <thead className="table-light">
              <tr>
                <th className="fw-medium">Colaborador</th>
                <th className="fw-medium">Cargo</th>
                {semanas.map((s) => (
                  <th key={s.codigo} className="fw-medium text-center text-nowrap" title={s.desde ? `${s.desde} a ${s.hasta}` : undefined}>
                    {s.codigo}
                  </th>
                ))}
                <th className="fw-medium text-center">Total</th>
                <th className="fw-medium text-center" title="Tiempo entre la salida de un lugar y la entrada al siguiente">Tránsito</th>
                <th className="fw-medium text-center">Días</th>
                <th className="fw-medium text-center" title="Jornadas sin entrada o sin salida: no suman horas">Incompletas</th>
                <th className="fw-medium text-center" title="Días con vacaciones, incapacidad, permiso...">Novedades</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={semanas.length + 7} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={semanas.length + 7} className="text-center text-secondary py-4">
                    No hay jornadas en este rango.
                  </td>
                </tr>
              ) : (
                <>
                  {items.map((x) => (
                    <tr key={x.colaborador.uuid}>
                      <td className="fw-medium text-nowrap">{x.colaborador.nombre}</td>
                      <td className="text-secondary">{x.colaborador.cargo || "—"}</td>
                      {semanas.map((s) => (
                        <td key={s.codigo} className="text-center">
                          {horas(x.semanas[s.codigo])}
                          {x.transitoSemanas?.[s.codigo] > 0 && (
                            <div style={{ color: "#7c3aed", fontSize: "0.66rem" }} title="Tránsito">
                              +{horas(x.transitoSemanas[s.codigo])}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="text-center fw-semibold">{horas(x.minutos)}</td>
                      <td className="text-center" style={{ color: x.transito ? "#7c3aed" : undefined }}>
                        {horas(x.transito)}
                      </td>
                      <td className="text-center">{x.dias}</td>
                      <td className="text-center" style={{ color: x.incompletas ? "#b45309" : undefined }}>
                        {x.incompletas || "—"}
                      </td>
                      <td className="text-center">{x.novedades || "—"}</td>
                    </tr>
                  ))}
                  <tr className="table-light fw-semibold">
                    <td colSpan={2}>Total</td>
                    {semanas.map((s) => (
                      <td key={s.codigo} className="text-center">
                        {horas(totalSemana(s.codigo))}
                      </td>
                    ))}
                    <td className="text-center">{horas(items.reduce((s, x) => s + x.minutos, 0))}</td>
                    <td className="text-center" style={{ color: "#7c3aed" }}>
                      {horas(items.reduce((s, x) => s + (x.transito || 0), 0))}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
