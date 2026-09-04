"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2, FiSave, FiRotateCcw, FiPackage, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// El backend reporta el error de una línea puntual como "Línea N: mensaje"
// (ver crearMovimientosEnLote) — se parsea para marcar esa fila en la tabla
// en vez de dejar el mensaje solo en el cartel de arriba.
function parseLineaError(mensaje) {
  const m = /^Línea (\d+):\s*([\s\S]*)$/.exec(mensaje || "");
  return m ? { numero: Number(m[1]), mensaje: m[2] } : null;
}

function emptyRow() {
  return { key: Math.random().toString(36).slice(2), loteUuid: "", cantidad: "" };
}

export default function RegistrarEmbolsePage() {
  const [fincas, setFincas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [semanas, setSemanas] = useState([]);

  const [fincaUuid, setFincaUuid] = useState("");
  const [semanaEmbolseUuid, setSemanaEmbolseUuid] = useState("");
  const [fechaRegistro, setFechaRegistro] = useState(todayIso());

  const [rows, setRows] = useState([emptyRow()]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const year = new Date().getFullYear();
        const [fincasRes, semanasRes] = await Promise.all([
          apiFetch("/fincas?limit=100&soloOperativas=true"),
          apiFetch(`/semanas?limit=55&anio=${year}`),
        ]);
        setFincas(fincasRes.items);
        setSemanas(semanasRes.items);

        const hoy = todayIso();
        const semanaHoy = semanasRes.items.find((s) => hoy >= s.fechaInicio && hoy <= s.fechaFin);
        if (semanaHoy) setSemanaEmbolseUuid(semanaHoy.uuid);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!fincaUuid) {
      setLotes([]);
      return;
    }
    apiFetch(`/lotes?fincaUuid=${fincaUuid}&limit=100`)
      .then((res) => setLotes(res.items))
      .catch((err) => setError(err.message));
  }, [fincaUuid]);

  function updateRow(key, patch) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length > 0 ? next : [emptyRow()];
    });
  }

  function handleLimpiar() {
    setRows([emptyRow()]);
    setError("");
    setSuccess("");
  }

  const totalRacimos = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0),
    [rows],
  );

  const filaConError = useMemo(() => parseLineaError(error), [error]);

  const camposFaltantes = useMemo(() => {
    const faltan = [];
    if (!fincaUuid) faltan.push("Finca");
    if (!semanaEmbolseUuid) faltan.push("Semana de embolse");
    if (!fechaRegistro) faltan.push("Fecha de registro");
    rows.forEach((r, idx) => {
      const n = idx + 1;
      if (!r.loteUuid) faltan.push(`Línea ${n}: lote`);
      if (!(Number(r.cantidad) > 0)) faltan.push(`Línea ${n}: cantidad`);
    });
    return faltan;
  }, [fincaUuid, semanaEmbolseUuid, fechaRegistro, rows]);

  const puedeRegistrar = camposFaltantes.length === 0;

  async function handleSubmit() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const resultado = await apiFetch("/racimo-movimientos/lote", {
        method: "POST",
        body: JSON.stringify({
          fincaUuid,
          semanaRegistroUuid: semanaEmbolseUuid,
          fecha: fechaRegistro,
          movimientos: rows.map((r) => ({
            tipo: "EMBOLSE",
            loteUuid: r.loteUuid,
            semanaEmbolseUuid,
            cantidad: Number(r.cantidad),
          })),
        }),
      });

      if (resultado.requiereLiquidarSemana) {
        const s = resultado.requiereLiquidarSemana;
        if (confirm(`Para continuar debes liquidar la semana ${s.codigo}. ¿Deseas liquidarla ahora?`)) {
          await apiFetch("/estimaciones/liquidar-semana", {
            method: "POST",
            body: JSON.stringify({ fincaUuid, semanaUuid: s.uuid }),
          });
          await handleSubmit();
        }
        return;
      }

      setSuccess(`${rows.length} embolse(s) registrado(s) correctamente (${totalRacimos} racimos).`);
      setRows([emptyRow()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequirePermission code="menu.racimos.registrar">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Registrar Embolse</h1>
          <p className="text-secondary mb-0">Registre los racimos embolsados por lote.</p>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {success && (
          <div className="alert alert-success py-2 small d-flex align-items-center gap-2">
            <FiCheckCircle /> {success}
          </div>
        )}
        {loading && <p className="text-secondary">Cargando...</p>}

        {!loading && (
          <div className="row g-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                <h6 className="fw-bold mb-3">Información general</h6>
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-medium">
                      Semana de embolse <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select rounded-3"
                      value={semanaEmbolseUuid}
                      onChange={(e) => setSemanaEmbolseUuid(e.target.value)}
                    >
                      <option value="">Seleccione una semana</option>
                      {semanas.map((s) => (
                        <option key={s.uuid} value={s.uuid}>
                          {s.codigo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-medium">
                      Finca <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select rounded-3"
                      value={fincaUuid}
                      onChange={(e) => {
                        setFincaUuid(e.target.value);
                        setRows([emptyRow()]);
                      }}
                    >
                      <option value="">Seleccione una finca</option>
                      {fincas.map((f) => (
                        <option key={f.uuid} value={f.uuid}>
                          {f.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-medium">Fecha de registro</label>
                    <input
                      type="date"
                      className="form-control rounded-3"
                      value={fechaRegistro}
                      onChange={(e) => setFechaRegistro(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm rounded-4 p-4">
                <h6 className="fw-bold text-success mb-1">Lotes y cantidades</h6>
                <p className="text-secondary small mb-3">
                  Ingrese los lotes embolsados y la cantidad de racimos por lote.
                </p>

                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr className="small text-secondary">
                        <th>#</th>
                        <th style={{ minWidth: "9rem" }}>Lote</th>
                        <th style={{ minWidth: "8rem" }}>Cantidad de racimos</th>
                        <th className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.key} className={filaConError?.numero === idx + 1 ? "table-danger" : undefined}>
                          <td className="small text-secondary">
                            <span className="d-inline-flex align-items-center gap-1">
                              {idx + 1}
                              {filaConError?.numero === idx + 1 && (
                                <FiAlertTriangle className="text-danger" title={filaConError.mensaje} />
                              )}
                            </span>
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm rounded-3"
                              value={row.loteUuid}
                              onChange={(e) => updateRow(row.key, { loteUuid: e.target.value })}
                              disabled={!fincaUuid}
                            >
                              <option value="">Seleccione</option>
                              {lotes.map((l) => (
                                <option key={l.uuid} value={l.uuid}>
                                  {l.codigo}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              className="form-control form-control-sm rounded-3"
                              value={row.cantidad}
                              onChange={(e) => updateRow(row.key, { cantidad: e.target.value })}
                            />
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeRow(row.key)}
                              title="Eliminar línea"
                            >
                              <FiTrash2 />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="btn btn-link text-decoration-none d-inline-flex align-items-center gap-1 px-0 mt-2"
                  onClick={addRow}
                  style={{ width: "fit-content" }}
                >
                  <FiPlus /> Agregar otro lote
                </button>
              </div>

              <div className="card border-0 shadow-sm rounded-4 p-3 mt-4 d-flex flex-row align-items-center justify-content-between">
                <span className="fw-medium text-success d-flex align-items-center gap-2">
                  <FiPackage /> Total de racimos a registrar
                </span>
                <span className="fs-4 fw-bold">{totalRacimos}</span>
              </div>

              {!puedeRegistrar && (
                <div className="alert alert-warning py-2 small mt-4 mb-0">
                  Falta completar: {camposFaltantes.join(", ")}.
                </div>
              )}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2" onClick={handleLimpiar}>
                  <FiRotateCcw /> Limpiar
                </button>
                <button
                  type="button"
                  className="btn btn-brand rounded-3 d-flex align-items-center gap-2"
                  onClick={handleSubmit}
                  disabled={!puedeRegistrar || saving}
                >
                  <FiSave /> {saving ? "Registrando..." : "Registrar embolses"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
