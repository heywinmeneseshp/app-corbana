"use client";

import { FiAlertTriangle, FiRotateCcw } from "react-icons/fi";

const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);
const num = (v) => Number(v ?? 0).toLocaleString("es", { maximumFractionDigits: 1 });

// Informativo y editable, por finca: aprovechamiento / % no cosechado (histórico vs aplicado) y hectáreas base.
// Un campo vacío usa el valor histórico (% no cosechado) o las hectáreas reales de hoy (hectáreas base).
export default function ParametrosFinca({ filas, params, onChange, deshabilitado }) {
  const pctPorFinca = params.pctNoCosechadoPorFinca || {};
  const haPorFinca = params.hectareasBasePorFinca || {};

  const cambiar = (clave, uuid, valor) => {
    const actual = { ...(params[clave] || {}) };
    if (valor === "" || valor === null) delete actual[uuid];
    else actual[uuid] = Number(valor);
    onChange({ ...params, [clave]: actual });
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div>
          <label className="form-label small mb-1">% no cosechado para todas las fincas</label>
          <div className="input-group input-group-sm" style={{ width: 150 }}>
            <input
              type="number"
              min="0"
              max="90"
              step="0.1"
              className="form-control"
              placeholder="histórico"
              disabled={deshabilitado}
              value={params.pctNoCosechado ?? ""}
              onChange={(e) => onChange({ ...params, pctNoCosechado: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <span className="input-group-text">%</span>
          </div>
        </div>
        <p className="small text-secondary mb-1" style={{ maxWidth: 560 }}>
          Vacío = el histórico de cada finca. Un valor en la fila de una finca tiene prioridad sobre este. Más % no cosechado = menos racimos y cajas
          (escenario más conservador).
        </p>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Finca</th>
              <th className="text-end">Aprov. histórico</th>
              <th className="text-end">No cosechado histórico</th>
              <th style={{ width: 130 }}>No cosechado aplicado (%)</th>
              <th className="text-end">Aprov. aplicado</th>
              <th className="text-end">Ha reales hoy</th>
              <th style={{ width: 120 }}>Ha base (opcional)</th>
              <th className="text-end">Cajas del año</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const tienePct = pctPorFinca[f.fincaUuid] !== undefined && pctPorFinca[f.fincaUuid] !== null;
              const tieneHa = haPorFinca[f.fincaUuid] !== undefined && haPorFinca[f.fincaUuid] !== null;
              return (
                <tr key={f.fincaUuid}>
                  <td className="fw-medium">
                    {f.fincaNombre}
                    {f.fuenteTasas === "global" && <span className="badge text-bg-light border ms-2 fw-normal" title="Pocas cohortes propias: usa las tasas de todas las fincas">tasas globales</span>}
                  </td>
                  <td className="text-end">{pct(f.aprovechamientoHistorico)}</td>
                  <td className="text-end">{pct(f.noCosechadoHistorico)}</td>
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="90"
                        step="0.1"
                        className="form-control form-control-sm"
                        placeholder="histórico"
                        disabled={deshabilitado}
                        value={tienePct ? pctPorFinca[f.fincaUuid] : ""}
                        onChange={(e) => cambiar("pctNoCosechadoPorFinca", f.fincaUuid, e.target.value)}
                      />
                      {tienePct && !deshabilitado && (
                        <button type="button" className="btn btn-sm btn-link p-0 text-secondary" title="Restablecer al histórico" onClick={() => cambiar("pctNoCosechadoPorFinca", f.fincaUuid, "")}>
                          <FiRotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="text-end fw-medium">{pct(f.aprovechamientoAplicado)}</td>
                  <td className="text-end">
                    {num(f.hectareasActuales)}
                    {f.alertaHectareas && (
                      <FiAlertTriangle
                        className="text-warning ms-1"
                        title={`El embolse por hectárea reciente (${f.embolsesPorHaSemanaReciente}/sem) es mucho menor al del año anterior (${f.embolsesPorHaSemanaAnterior}/sem): las hectáreas de hoy podrían estar infladas.`}
                      />
                    )}
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        placeholder="reales"
                        disabled={deshabilitado}
                        value={tieneHa ? haPorFinca[f.fincaUuid] : ""}
                        onChange={(e) => cambiar("hectareasBasePorFinca", f.fincaUuid, e.target.value)}
                      />
                      {tieneHa && !deshabilitado && (
                        <button type="button" className="btn btn-sm btn-link p-0 text-secondary" title="Usar las hectáreas reales" onClick={() => cambiar("hectareasBasePorFinca", f.fincaUuid, "")}>
                          <FiRotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="text-end">{Number(f.cajasAnuales).toLocaleString("es")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
