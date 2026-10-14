"use client";

import { useRef, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import { cargarAreasMasivo } from "@/lib/proyeccion/api";

// Plan de hectáreas nuevas del escenario: cada fila es una finca, la semana y las hectáreas (negativo = baja). Para las altas la
// semana que se elige es la de PRIMERA COSECHA; el sistema calcula la semana de entrada (cuando se empieza a embolsar) restando
// 7 semanas. Las hectáreas reales de los lotes no se tocan. Las altas entran con la rampa del escenario.
const SEMANAS_A_PRIMER_CORTE = 7; // edad mínima de corte de 8 semanas: el primer racimo se corta 7 semanas después del embolse
export default function PlanHectareas({ escenarioUuid, areas, onChange, fincas, semanas, deshabilitado, onCargado, rampaPorDefecto = { pct: 50, semanas: 12 } }) {
  const inputArchivo = useRef(null);
  const vacio = () => ({ fincaUuid: "", semanaUuid: "", hectareas: "", nota: "", cierre: false, rampaPct: String(rampaPorDefecto.pct), rampaSemanas: String(rampaPorDefecto.semanas) });
  const [nueva, setNueva] = useState(vacio);
  const [error, setError] = useState("");
  const [carga, setCarga] = useState(null); // { total, validas, errores, aplicado }
  const [cargando, setCargando] = useState(false);
  // Fila del plan que se está editando (sus datos se cargan en el formulario); null = se está agregando una nueva.
  const [editando, setEditando] = useState(null); // { uuid, semanaCodigo }

  function editar(a) {
    setError("");
    setEditando({ uuid: a.uuid, semanaCodigo: a.semanaCodigo });
    setNueva({ fincaUuid: a.fincaUuid, semanaUuid: a.semanaUuid, hectareas: a.hectareas === 0 ? "" : String(a.hectareas), nota: a.nota || "", cierre: a.hectareas === 0, rampaPct: String(a.rampaPct ?? rampaPorDefecto.pct), rampaSemanas: String(a.rampaSemanas ?? rampaPorDefecto.semanas) });
  }

  function cancelarEdicion() {
    setEditando(null);
    setError("");
    setNueva(vacio());
  }

  function agregar() {
    setError("");
    // "La finca deja de producir": entrada con 0 hectáreas (desde esa semana no se embolsa más).
    const ha = nueva.cierre ? 0 : Number(String(nueva.hectareas).replace(",", "."));
    if (!nueva.fincaUuid || !nueva.semanaUuid) return setError("Elige la finca y la semana.");
    if (!nueva.cierre && (!Number.isFinite(ha) || ha === 0)) return setError("Escribe las hectáreas (un número distinto de 0; negativo = baja) o marca «Deja de producir».");
    const finca = fincas.find((f) => f.uuid === nueva.fincaUuid);
    // Se guarda la semana de ENTRADA (embolse); la de primera cosecha es 7 semanas después y siempre va enlazada.
    const semana = semanas.find((s) => s.uuid === nueva.semanaUuid);
    const codigo = semana?.codigo || (editando && nueva.semanaUuid === areas.find((x) => x.uuid === editando.uuid)?.semanaUuid ? editando.semanaCodigo : undefined);
    // Rampa de esta entrada (solo para altas): arranque en % del embolse por hectárea y semanas hasta el 100 %.
    const pct = Number(nueva.rampaPct);
    const semRampa = Number(nueva.rampaSemanas);
    if (ha > 0 && (!(pct >= 0 && pct <= 100) || !(Number.isInteger(semRampa) && semRampa >= 0 && semRampa <= 104))) {
      return setError("El arranque va de 0 a 100 % y las semanas hasta el 100 % son un entero de 0 a 104.");
    }
    const fila = { fincaUuid: nueva.fincaUuid, fincaNombre: finca?.nombre, semanaUuid: nueva.semanaUuid, semanaCodigo: codigo, hectareas: ha, rampaPct: ha > 0 ? pct : null, rampaSemanas: ha > 0 ? semRampa : null, nota: nueva.nota || null };
    if (editando) {
      // Reemplaza la fila editada conservando su identificador.
      onChange(areas.map((x) => (x.uuid === editando.uuid ? { ...x, ...fila } : x)));
      setEditando(null);
      setNueva(vacio());
      return;
    }
    onChange([...areas, { uuid: `nuevo-${Date.now()}`, ...fila }]);
    setNueva({ ...nueva, hectareas: "", nota: "", cierre: false, rampaPct: String(rampaPorDefecto.pct), rampaSemanas: String(rampaPorDefecto.semanas) });
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

  // Primera cosecha de unas hectáreas nuevas: 7 semanas después de la semana de embolse. Las bajas y los cierres no tienen.
  const modoAlta = !nueva.cierre && !(Number(String(nueva.hectareas).replace(",", ".")) < 0);
  const semanasForm = editando && nueva.semanaUuid && !semanas.some((x) => x.uuid === nueva.semanaUuid) ? [{ uuid: nueva.semanaUuid, codigo: `${editando.semanaCodigo} (actual)` }, ...semanas] : semanas;
  const entradaIdx = semanas.findIndex((s) => s.uuid === nueva.semanaUuid);
  const cosechaUuid = entradaIdx >= 0 ? semanas[entradaIdx + SEMANAS_A_PRIMER_CORTE]?.uuid || "" : "";
  // Elegir la primera cosecha fija la entrada 7 semanas antes (y al revés): los dos campos van enlazados.
  const elegirCosecha = (uuid) => {
    const i = semanas.findIndex((s) => s.uuid === uuid);
    setNueva({ ...nueva, semanaUuid: i >= SEMANAS_A_PRIMER_CORTE ? semanas[i - SEMANAS_A_PRIMER_CORTE].uuid : "" });
  };
  const primeraCosecha = (a) => {
    if (!(a.hectareas > 0)) return null;
    const i = semanas.findIndex((s) => s.uuid === a.semanaUuid);
    if (i < 0) return null;
    const destino = i + SEMANAS_A_PRIMER_CORTE;
    if (destino < semanas.length) return semanas[destino].codigo;
    // Cae en el año siguiente: se arma el código con la numeración consecutiva.
    const anio = Number(String(semanas[i].codigo).split("-")[1]) || 0;
    return `S${String(destino - semanas.length + 1).padStart(2, "0")}-${anio + 1}`;
  };
  const ordenadas = [...areas].sort((a, b) => String(a.fincaNombre).localeCompare(String(b.fincaNombre), "es") || String(a.semanaCodigo).localeCompare(String(b.semanaCodigo)));

  return (
    <div>
      <p className="small text-secondary mb-3">
        Hectáreas que una finca habilita en el futuro. Eliges la semana de <strong>embolse</strong> (cuando se empieza a embolsar) o la de <strong>primera cosecha</strong>: están enlazadas, la cosecha es 7 semanas después del embolse, y el embolse puede caer en el año anterior. Entran con la rampa del escenario; un valor negativo es una baja. Con «Deja de producir» (0 hectáreas) la finca ya no saca cajas desde esa semana: no embolsa ni cosecha (racimos y cajas en 0).
      </p>

      {!deshabilitado && (
        <div className="d-flex flex-nowrap align-items-end gap-2 mb-2" style={{ overflowX: "auto" }}>
          <div style={{ flex: "1 1 150px", minWidth: 130 }}>
            <label className="form-label small mb-1 text-nowrap">Finca</label>
            <select className="form-select form-select-sm" value={nueva.fincaUuid} onChange={(e) => setNueva({ ...nueva, fincaUuid: e.target.value })}>
              <option value="">Elige...</option>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 112px" }}>
            <label className="form-label small mb-1 text-nowrap">{modoAlta ? "Semana de embolse" : "Desde la semana"}</label>
            <select className="form-select form-select-sm" value={nueva.semanaUuid} onChange={(e) => setNueva({ ...nueva, semanaUuid: e.target.value })}>
              <option value="">Elige...</option>
              {semanasForm.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </div>
          {modoAlta && (
            <div style={{ flex: "0 0 112px" }}>
              <label className="form-label small mb-1 text-nowrap" title="Primera semana en que se corta un racimo: 7 semanas después de la entrada (edad mínima de corte de 8 semanas)">
                Primera cosecha
              </label>
              <select className="form-select form-select-sm" value={cosechaUuid} onChange={(e) => elegirCosecha(e.target.value)}>
                <option value="">Elige...</option>
                {semanas.slice(SEMANAS_A_PRIMER_CORTE).map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ flex: "0 0 auto" }}>
            <label className="form-label small mb-1 text-nowrap">Hectáreas</label>
            <div className="d-flex align-items-center gap-2">
              <input type="number" step="0.01" className="form-control form-control-sm" style={{ width: 78 }} disabled={nueva.cierre} placeholder={nueva.cierre ? "0" : ""} value={nueva.cierre ? "" : nueva.hectareas} onChange={(e) => setNueva({ ...nueva, hectareas: e.target.value })} />
              <div className="form-check mb-0 text-nowrap">
                <input type="checkbox" className="form-check-input" id="plan-cierre" checked={nueva.cierre} onChange={(e) => setNueva({ ...nueva, cierre: e.target.checked })} />
                <label className="form-check-label small" htmlFor="plan-cierre">
                  Deja de producir
                </label>
              </div>
            </div>
          </div>
          {modoAlta && !nueva.cierre && (
            <>
              <div style={{ flex: "0 0 82px" }}>
                <label className="form-label small mb-1 text-nowrap" title="Con qué % del embolse por hectárea de la finca arranca esta entrada">
                  Arranque (%)
                </label>
                <input type="number" min="0" max="100" className="form-control form-control-sm" value={nueva.rampaPct} onChange={(e) => setNueva({ ...nueva, rampaPct: e.target.value })} />
              </div>
              <div style={{ flex: "0 0 96px" }}>
                <label className="form-label small mb-1 text-nowrap" title="Semanas que tarda esta entrada en llegar al 100 % del embolse por hectárea">
                  Semanas al 100 %
                </label>
                <input type="number" min="0" max="104" className="form-control form-control-sm" value={nueva.rampaSemanas} onChange={(e) => setNueva({ ...nueva, rampaSemanas: e.target.value })} />
              </div>
            </>
          )}
          <div style={{ flex: "1 1 110px", minWidth: 90 }}>
            <label className="form-label small mb-1 text-nowrap">Nota (opcional)</label>
            <input type="text" maxLength={255} className="form-control form-control-sm" value={nueva.nota} onChange={(e) => setNueva({ ...nueva, nota: e.target.value })} />
          </div>
          <div className="d-flex gap-2 flex-nowrap" style={{ flex: "0 0 auto" }}>
            <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={agregar}>
              {editando ? (
                <>
                  <FiCheck /> Guardar cambios
                </>
              ) : (
                <>
                  <FiPlus /> Agregar
                </>
              )}
            </button>
            {editando && (
              <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={cancelarEdicion}>
                <FiX /> Cancelar
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" disabled={cargando} onClick={() => inputArchivo.current?.click()} title="Excel o CSV con las columnas: finca, semana, hectareas, nota y, opcionales, arranque (%) y semanas100. Con hectareas positivas, semana = primera cosecha (la entrada se calcula 7 semanas antes); con negativas o 0 (la finca deja de producir), semana = desde cuándo">
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
              <th title="Semana en que se empieza a embolsar (7 semanas antes de la primera cosecha)">Semana de embolse</th>
              <th title="Primera semana en que se corta el primer racimo: 7 semanas después de la entrada (edad mínima de corte de 8 semanas)">Primera cosecha</th>
              <th className="text-end">Hectáreas</th>
              <th className="text-center" title="% del embolse por hectárea con el que arranca la entrada">Arranque</th>
              <th className="text-center" title="Semanas hasta llegar al 100 % del embolse por hectárea">Semanas al 100 %</th>
              <th>Nota</th>
              <th style={{ width: "4rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-secondary py-3">
                  Sin hectáreas nuevas: la proyección usa las hectáreas actuales de cada finca.
                </td>
              </tr>
            )}
            {ordenadas.map((a) => (
              <tr key={a.uuid} style={editando?.uuid === a.uuid ? { background: "#fff7e0" } : undefined}>
                <td>{a.fincaNombre}</td>
                <td>{a.semanaCodigo}</td>
                <td>{primeraCosecha(a) || <span className="text-secondary">—</span>}</td>
                <td className={`text-end ${a.hectareas < 0 ? "text-danger" : ""}`}>
                  {a.hectareas === 0 ? <span className="badge text-bg-danger fw-normal">Deja de producir (0 ha)</span> : `${a.hectareas > 0 ? "+" : ""}${a.hectareas}`}
                </td>
                <td className="text-center small">{a.hectareas > 0 ? `${a.rampaPct ?? rampaPorDefecto.pct} %` : <span className="text-secondary">—</span>}</td>
                <td className="text-center small">{a.hectareas > 0 ? (a.rampaSemanas ?? rampaPorDefecto.semanas) : <span className="text-secondary">—</span>}</td>
                <td className="small text-secondary">{a.nota || "—"}</td>
                <td className="text-end">
                  {!deshabilitado && (
                    <span className="d-inline-flex gap-2">
                      <button type="button" className="btn btn-sm btn-link text-secondary p-0" title="Editar" onClick={() => editar(a)}>
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger p-0"
                        title="Quitar"
                        onClick={() => {
                          if (editando?.uuid === a.uuid) cancelarEdicion();
                          onChange(areas.filter((x) => x.uuid !== a.uuid));
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </span>
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
