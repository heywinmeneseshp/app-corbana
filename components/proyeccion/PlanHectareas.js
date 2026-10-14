"use client";

import { useRef, useState } from "react";
import { FiPlus, FiTrash2, FiUpload } from "react-icons/fi";
import { cargarAreasMasivo } from "@/lib/proyeccion/api";

// Plan de hectáreas nuevas del escenario: cada fila es una finca, la semana desde la que entra y las hectáreas
// (negativo = baja). Las hectáreas reales de los lotes no se tocan. Las altas entran con la rampa del escenario.
export default function PlanHectareas({ escenarioUuid, areas, onChange, fincas, semanas, deshabilitado, onCargado }) {
  const inputArchivo = useRef(null);
  const [nueva, setNueva] = useState({ fincaUuid: "", semanaUuid: "", hectareas: "", nota: "", cierre: false });
  const [error, setError] = useState("");
  const [carga, setCarga] = useState(null); // { total, validas, errores, aplicado }
  const [cargando, setCargando] = useState(false);

  function agregar() {
    setError("");
    // "La finca deja de producir": entrada con 0 hectáreas (desde esa semana no se embolsa más).
    const ha = nueva.cierre ? 0 : Number(String(nueva.hectareas).replace(",", "."));
    if (!nueva.fincaUuid || !nueva.semanaUuid) return setError("Elige la finca y la semana.");
    if (!nueva.cierre && (!Number.isFinite(ha) || ha === 0)) return setError("Escribe las hectáreas (un número distinto de 0; negativo = baja) o marca «Deja de producir».");
    const finca = fincas.find((f) => f.uuid === nueva.fincaUuid);
    const semana = semanas.find((s) => s.uuid === nueva.semanaUuid);
    onChange([
      ...areas,
      { uuid: `nuevo-${Date.now()}`, fincaUuid: nueva.fincaUuid, fincaNombre: finca?.nombre, semanaUuid: nueva.semanaUuid, semanaCodigo: semana?.codigo, hectareas: ha, nota: nueva.nota || null },
    ]);
    setNueva({ ...nueva, hectareas: "", nota: "", cierre: false });
  }

  async function subir(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    setCargando(true);
    try {
      const previo = await cargarAreasMasivo(escenarioUuid, archivo, true);
      setCarga(previo);
      if (previo.errores.length === 0 && previo.validas > 0) {
        if (window.confirm(`Se reemplazará el plan actual por ${previo.validas} fila(s) del archivo. ¿Continuar?`)) {
          const aplicado = await cargarAreasMasivo(escenarioUuid, archivo, false);
          setCarga(aplicado);
          onCargado?.();
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const ordenadas = [...areas].sort((a, b) => String(a.fincaNombre).localeCompare(String(b.fincaNombre), "es") || String(a.semanaCodigo).localeCompare(String(b.semanaCodigo)));

  return (
    <div>
      <p className="small text-secondary mb-3">
        Hectáreas que una finca habilita en el futuro. Entran en la semana indicada con la rampa del escenario; un valor negativo es una baja.
        Con «Deja de producir» (0 hectáreas) la finca ya no saca cajas desde esa semana: no embolsa ni cosecha (racimos y cajas en 0).
      </p>

      {!deshabilitado && (
        <div className="row g-2 align-items-end mb-2">
          <div className="col-12 col-md-3">
            <label className="form-label small mb-1">Finca</label>
            <select className="form-select form-select-sm" value={nueva.fincaUuid} onChange={(e) => setNueva({ ...nueva, fincaUuid: e.target.value })}>
              <option value="">Elige...</option>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">{nueva.cierre ? "Desde la semana" : "Semana de entrada"}</label>
            <select className="form-select form-select-sm" value={nueva.semanaUuid} onChange={(e) => setNueva({ ...nueva, semanaUuid: e.target.value })}>
              <option value="">Elige...</option>
              {semanas.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small mb-1">Hectáreas</label>
            <div className="d-flex align-items-center gap-2">
              <input type="number" step="0.01" className="form-control form-control-sm" style={{ minWidth: 80 }} disabled={nueva.cierre} placeholder={nueva.cierre ? "0" : ""} value={nueva.cierre ? "" : nueva.hectareas} onChange={(e) => setNueva({ ...nueva, hectareas: e.target.value })} />
              <div className="form-check mb-0 text-nowrap">
                <input type="checkbox" className="form-check-input" id="plan-cierre" checked={nueva.cierre} onChange={(e) => setNueva({ ...nueva, cierre: e.target.checked })} />
                <label className="form-check-label small" htmlFor="plan-cierre">
                  Deja de producir (0 ha)
                </label>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small mb-1">Nota (opcional)</label>
            <input type="text" maxLength={255} className="form-control form-control-sm" value={nueva.nota} onChange={(e) => setNueva({ ...nueva, nota: e.target.value })} />
          </div>
          <div className="col-12 col-md-2 d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={agregar}>
              <FiPlus /> Agregar
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" disabled={cargando} onClick={() => inputArchivo.current?.click()} title="Excel o CSV con las columnas: finca, semana, hectareas, nota (hectareas 0 = la finca deja de producir)">
              <FiUpload /> {cargando ? "..." : "Excel"}
            </button>
            <input ref={inputArchivo} type="file" accept=".xlsx,.xls,.csv" className="d-none" onChange={subir} />
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {carga && (
        <div className={`alert py-2 small ${carga.errores.length ? "alert-warning" : "alert-success"}`}>
          {carga.aplicado ? `Se cargaron ${carga.validas} fila(s).` : `${carga.validas} de ${carga.total} fila(s) válidas.`}
          {carga.errores.length > 0 && (
            <ul className="mb-0 mt-1">
              {carga.errores.slice(0, 8).map((e) => (
                <li key={e.fila}>
                  Fila {e.fila}: {e.error}
                </li>
              ))}
              {carga.errores.length > 8 && <li>y {carga.errores.length - 8} más...</li>}
            </ul>
          )}
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Finca</th>
              <th>Semana de entrada</th>
              <th className="text-end">Hectáreas</th>
              <th>Nota</th>
              <th style={{ width: "2.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-secondary py-3">
                  Sin hectáreas nuevas: la proyección usa las hectáreas actuales de cada finca.
                </td>
              </tr>
            )}
            {ordenadas.map((a) => (
              <tr key={a.uuid}>
                <td>{a.fincaNombre}</td>
                <td>{a.semanaCodigo}</td>
                <td className={`text-end ${a.hectareas < 0 ? "text-danger" : ""}`}>
                  {a.hectareas === 0 ? <span className="badge text-bg-danger fw-normal">Deja de producir (0 ha)</span> : `${a.hectareas > 0 ? "+" : ""}${a.hectareas}`}
                </td>
                <td className="small text-secondary">{a.nota || "—"}</td>
                <td className="text-end">
                  {!deshabilitado && (
                    <button type="button" className="btn btn-sm btn-link text-danger p-0" title="Quitar" onClick={() => onChange(areas.filter((x) => x.uuid !== a.uuid))}>
                      <FiTrash2 />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
