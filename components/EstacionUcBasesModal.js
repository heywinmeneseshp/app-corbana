"use client";

import { useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";

const MAX_BASES = 6;

// Bases de las columnas de Unidades Calóricas del histórico diario de la
// Estación Meteorológica: UC = (Tmáx + Tmín) / 2 − base. Cada base crea una
// columna; la configuración es global y solo la edita el Administrador.
export default function EstacionUcBasesModal({ basesActuales, onClose, onGuardado, embebido = false }) {
  const [bases, setBases] = useState((basesActuales || [14]).map(String));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (i, valor) => setBases((b) => b.map((x, idx) => (idx === i ? valor : x)));
  const quitar = (i) => setBases((b) => b.filter((_, idx) => idx !== i));
  const agregar = () => setBases((b) => (b.length < MAX_BASES ? [...b, ""] : b));

  async function handleGuardar(e) {
    e.preventDefault();
    setError("");
    const nums = bases.map((b) => Number(String(b).replace(",", "."))).filter((n, i) => String(bases[i]).trim() !== "" && Number.isFinite(n));
    if (nums.length === 0) {
      setError("Agrega al menos una base.");
      return;
    }
    if (nums.some((n) => n < 0 || n > 50)) {
      setError("Cada base debe estar entre 0 y 50.");
      return;
    }
    setGuardando(true);
    try {
      const guardadas = await apiFetch("/estacion-meteorologica/uc-bases", { method: "PUT", body: JSON.stringify({ bases: nums }) });
      onGuardado(guardadas);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const contenido = (
    <>
      <p className="small text-secondary mb-3">
        Cada base agrega una columna al histórico diario con la fórmula{" "}
        <strong>UC = (Temp. máxima + Temp. mínima) / 2 − base</strong>. Por ejemplo, con las bases 14 y 16 verás dos
        columnas.
      </p>

      <form onSubmit={handleGuardar}>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="d-flex flex-column gap-2 mb-3">
          {bases.map((b, i) => (
            <div key={i} className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                <span className="input-group-text">Base</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  className="form-control"
                  value={b}
                  onChange={(e) => cambiar(i, e.target.value)}
                  autoFocus={i === bases.length - 1 && b === ""}
                />
                <span className="input-group-text">°C</span>
              </div>
              {bases.length > 1 && (
                <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => quitar(i)} title="Quitar base">
                  <FiTrash2 />
                </button>
              )}
            </div>
          ))}
        </div>

        {bases.length < MAX_BASES && (
          <button type="button" className="btn btn-link btn-sm text-decoration-none p-0 d-flex align-items-center gap-1 mb-3" onClick={agregar}>
            <FiPlus size={14} /> Agregar base
          </button>
        )}

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-brand btn-sm rounded-3 flex-grow-1" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </>
  );

  return embebido ? contenido : (
    <ModalShell title="Unidades calóricas" onClose={onClose}>
      {contenido}
    </ModalShell>
  );
}
