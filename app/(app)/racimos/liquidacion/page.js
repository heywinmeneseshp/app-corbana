"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheckCircle, FiLock, FiUnlock } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import SemanaAutocomplete from "@/components/SemanaAutocomplete";

export default function LiquidacionRacimosPage() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [resumen, setResumen] = useState(null);
  const [semanas, setSemanas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [semanaHastaMasivoUuid, setSemanaHastaMasivoUuid] = useState("");
  const [liquidandoMasivo, setLiquidandoMasivo] = useState(false);
  const [resultadoMasivo, setResultadoMasivo] = useState(null);
  const [errorMasivo, setErrorMasivo] = useState("");

  const esAdmin = esAdministrador();

  useEffect(() => {
    apiFetch("/fincas?limit=100&soloOperativas=true")
      .then((res) => setFincas(res.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    if (esAdministrador()) {
      // Trae TODAS las semanas registradas (paginando de a 100, el máximo
      // del backend) — el autocompletar de abajo (SemanaAutocomplete) es el
      // que evita mostrarlas todas de una, filtrando por lo que se escribe
      // y mostrando como máximo 50 sugerencias a la vez.
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
          // sin bloquear el resto de la pantalla si esto falla
        }
      })();
    }
  }, []);

  const cargarSemanas = useCallback(() => {
    if (!fincaUuid) {
      setResumen(null);
      return;
    }
    setError("");
    apiFetch(`/estimaciones/resumen-finca?fincaUuid=${fincaUuid}`)
      .then((res) => setResumen(res))
      .catch((err) => setError(err.message));
  }, [fincaUuid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarSemanas();
  }, [cargarSemanas]);

  async function liquidar(semanaUuid) {
    setAccionando(semanaUuid);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/estimaciones/liquidar-semana", {
        method: "POST",
        body: JSON.stringify({ fincaUuid, semanaUuid }),
      });
      setSuccess("Semana liquidada correctamente.");
      cargarSemanas();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccionando("");
    }
  }

  async function reabrir(semanaUuid) {
    if (!confirm("¿Reabrir esta semana? Los usuarios normales podrán volver a registrar/editar movimientos de racimos en ella.")) return;
    setAccionando(semanaUuid);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/estimaciones/liquidar-semana", {
        method: "DELETE",
        body: JSON.stringify({ fincaUuid, semanaUuid }),
      });
      setSuccess("Semana reabierta correctamente.");
      cargarSemanas();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccionando("");
    }
  }

  async function liquidarMasivo() {
    const semanaHasta = semanas.find((s) => s.uuid === semanaHastaMasivoUuid);
    if (
      !confirm(
        `¿Liquidar TODAS las semanas pendientes hasta ${semanaHasta?.codigo} (inclusive) para TODAS las fincas operativas? ` +
          "Esto bloqueará el registro/edición de movimientos de racimos de esas semanas para todo el mundo, salvo un Administrador.",
      )
    ) {
      return;
    }
    setLiquidandoMasivo(true);
    setErrorMasivo("");
    setResultadoMasivo(null);
    try {
      const res = await apiFetch("/estimaciones/liquidar-semana-masivo", {
        method: "POST",
        body: JSON.stringify({ semanaHastaUuid: semanaHastaMasivoUuid }),
      });
      setResultadoMasivo(res);
      cargarSemanas();
    } catch (err) {
      setErrorMasivo(err.message);
    } finally {
      setLiquidandoMasivo(false);
    }
  }

  return (
    <RequirePermission code="menu.racimos.liquidacion">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiCheckCircle className="text-primary" /> Liquidación de semanas
          </h1>
          <p className="text-secondary mb-0">
            Liquidar una semana cierra el registro de movimientos de racimos de esa semana para esa finca — nadie
            (salvo un Administrador) puede seguir registrando, editando o eliminando movimientos de una semana
            liquidada. Solo un Administrador puede reabrirla.
          </p>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {success && <div className="alert alert-success py-2 small">{success}</div>}

        {esAdmin && (
          <div className="card border-0 shadow-sm rounded-4 p-3 mb-3" style={{ borderLeft: "4px solid #dc2626" }}>
            <h2 className="h6 fw-bold mb-1" style={{ color: "#dc2626" }}>
              Liquidación masiva — todas las fincas
            </h2>
            <p className="text-secondary small mb-3">
              Liquida de una sola vez todas las semanas de un rango, para todas las fincas operativas. Útil para
              ponerse al día con semanas atrasadas sin liquidar de a una. Solo Administrador.
            </p>

            {errorMasivo && <div className="alert alert-danger py-2 small">{errorMasivo}</div>}
            {resultadoMasivo && (
              <div className="alert alert-success py-2 small">
                Listo: {resultadoMasivo.fincas} finca(s) × {resultadoMasivo.semanas} semana(s) ={" "}
                {resultadoMasivo.combinacionesTotales} combinaciones — {resultadoMasivo.creadas} nueva(s),{" "}
                {resultadoMasivo.reabiertas} reabierta(s) que estaban borradas, {resultadoMasivo.yaLiquidadas} ya
                estaban liquidadas.
              </div>
            )}

            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-medium">Semana hasta</label>
                <SemanaAutocomplete
                  semanas={semanas}
                  value={semanaHastaMasivoUuid}
                  onChange={setSemanaHastaMasivoUuid}
                  placeholder="Buscar semana (ej. S33-2026)..."
                  width="100%"
                  limit={50}
                />
              </div>
              <div className="col-12 col-md-6">
                <button
                  type="button"
                  className="btn btn-danger rounded-3 w-100"
                  disabled={!semanaHastaMasivoUuid || liquidandoMasivo}
                  onClick={liquidarMasivo}
                >
                  {liquidandoMasivo ? "Liquidando..." : "Liquidar pendientes hasta esta semana"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-5 col-lg-4">
              <label className="form-label small fw-medium">Finca</label>
              <select
                className="form-select rounded-3"
                value={fincaUuid}
                onChange={(e) => setFincaUuid(e.target.value)}
                disabled={loading}
              >
                <option value="">Selecciona una finca...</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.codigo} — {f.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!fincaUuid && (
          <div className="alert alert-info py-2 small">Selecciona una finca para ver el estado de sus semanas.</div>
        )}

        {fincaUuid && resumen && (
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Semana</th>
                    <th className="text-center">Estado</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.semanasRecientes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-secondary py-3">
                        No hay semanas recientes para mostrar.
                      </td>
                    </tr>
                  )}
                  {resumen.semanasRecientes.map((s) => (
                    <tr key={s.uuid}>
                      <td className="fw-medium">{s.codigo}</td>
                      <td className="text-center">
                        {s.liquidada ? (
                          <span className="badge rounded-pill text-bg-success d-inline-flex align-items-center gap-1">
                            <FiLock size={11} /> Liquidada
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary d-inline-flex align-items-center gap-1">
                            <FiUnlock size={11} /> Abierta
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        {!s.liquidada && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary rounded-3"
                            onClick={() => liquidar(s.uuid)}
                            disabled={accionando === s.uuid}
                          >
                            {accionando === s.uuid ? "Liquidando..." : "Liquidar"}
                          </button>
                        )}
                        {s.liquidada && esAdmin && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-3"
                            onClick={() => reabrir(s.uuid)}
                            disabled={accionando === s.uuid}
                          >
                            {accionando === s.uuid ? "Reabriendo..." : "Reabrir"}
                          </button>
                        )}
                        {s.liquidada && !esAdmin && (
                          <span className="text-secondary" title="Solo un Administrador puede reabrir una semana liquidada">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
