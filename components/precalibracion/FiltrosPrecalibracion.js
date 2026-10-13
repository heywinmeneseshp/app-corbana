"use client";

import { useState } from "react";
import { FiCheck } from "react-icons/fi";

// La semana es obligatoria: por defecto la actual (opciones.semanaActualId).
export const filtrosPorDefecto = (opciones) => ({ semanaId: opciones.semanaActualId || "", fincaId: "", valorId: "" });

// Barra de filtros con estado borrador: "Aplicar filtros" confirma,
// El padre pasa key={JSON.stringify(aplicados)} para reiniciar el borrador (sin efectos de sincronización).
export default function FiltrosPrecalibracion({ opciones, aplicados, onAplicar }) {
  // Semana y finca son campos de texto con sugerencias (datalist): se escribe "S41-2026" o el nombre de la finca
  // y se resuelve al id al aplicar. Un texto que no coincide con ninguna opción deshabilita "Aplicar".
  const [borrador, setBorrador] = useState({
    semana: opciones.semanas.find((s) => s.id === aplicados.semanaId)?.codigo || "",
    finca: opciones.fincas.find((f) => f.id === aplicados.fincaId)?.nombre || "",
    valorId: aplicados.valorId,
  });

  function cambiar(campo, valor) {
    setBorrador((prev) => ({ ...prev, [campo]: valor }));
  }

  const normalizar = (t) => t.trim().toLowerCase();
  const semanaEncontrada = borrador.semana.trim() ? opciones.semanas.find((s) => normalizar(s.codigo) === normalizar(borrador.semana)) : null;
  const fincaEncontrada = borrador.finca.trim() ? opciones.fincas.find((f) => normalizar(f.nombre) === normalizar(borrador.finca)) : null;
  const semanaInvalida = !semanaEncontrada;
  const fincaInvalida = borrador.finca.trim() !== "" && !fincaEncontrada;

  function aplicar() {
    onAplicar({ semanaId: semanaEncontrada.id, fincaId: fincaEncontrada?.id || "", valorId: borrador.valorId });
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="row g-2 align-items-end">
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium">Semana</label>
          <input
            type="text"
            className={`form-control form-control-sm rounded-3 ${semanaInvalida ? "is-invalid" : ""}`}
            list="precal-semanas"
            placeholder="Ej. S41-2026"
            required
            value={borrador.semana}
            onChange={(e) => cambiar("semana", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !semanaInvalida && !fincaInvalida && aplicar()}
          />
          <datalist id="precal-semanas">
            {opciones.semanas.map((s) => (
              <option key={s.id} value={s.codigo} />
            ))}
          </datalist>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium">Finca</label>
          <input
            type="text"
            className={`form-control form-control-sm rounded-3 ${fincaInvalida ? "is-invalid" : ""}`}
            list="precal-fincas"
            placeholder="Todas"
            value={borrador.finca}
            onChange={(e) => cambiar("finca", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !semanaInvalida && !fincaInvalida && aplicar()}
          />
          <datalist id="precal-fincas">
            {opciones.fincas.map((f) => (
              <option key={f.id} value={f.nombre} />
            ))}
          </datalist>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium">Valor de precalibración</label>
          <select className="form-select form-select-sm rounded-3" value={borrador.valorId} onChange={(e) => cambiar("valorId", e.target.value)}>
            <option value="">Todos</option>
            {opciones.valores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2 d-grid">
          <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center justify-content-center gap-1" disabled={semanaInvalida || fincaInvalida}
            onClick={aplicar}>
            <FiCheck /> Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
