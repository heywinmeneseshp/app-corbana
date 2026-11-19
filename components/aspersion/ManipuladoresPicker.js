"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// Manipuladores de plaguicidas del comprobante: se eligen de su propia tabla (no son colaboradores) y, si la persona no existe,
// se crea aquí mismo. `valor`: [{ manipuladorUuid?, nombre, documento }].
export default function ManipuladoresPicker({ valor, onChange }) {
  const [manipuladores, setManipuladores] = useState([]);
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(null); // { nombre, apellido, documento } mientras se crea uno nuevo
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/sanidad-vegetal/manipuladores")
      .then((d) => setManipuladores(d || []))
      .catch(() => setManipuladores([]));
  }, []);

  const etiqueta = (c) => `${c.nombre}${c.documento ? ` · CC ${c.documento}` : ""}`;
  const elegidos = new Set(valor.map((m) => m.manipuladorUuid).filter(Boolean));
  const opciones = manipuladores.filter((c) => !elegidos.has(c.uuid));

  function elegir(t) {
    setTexto(t);
    const c = opciones.find((x) => etiqueta(x) === t);
    if (!c) return;
    onChange([...valor, { manipuladorUuid: c.uuid, nombre: c.nombre, documento: c.documento || "" }]);
    setTexto("");
  }

  async function crear() {
    if (!creando.nombre.trim()) return setError("Escribe el nombre.");
    setGuardando(true);
    setError("");
    try {
      const nombre = [creando.nombre.trim(), creando.apellido.trim()].filter(Boolean).join(" ");
      const nuevo = await apiFetch("/sanidad-vegetal/manipuladores", { method: "POST", body: JSON.stringify({ nombre, documento: creando.documento.trim() || null }) });
      setManipuladores((l) => [...l, nuevo]);
      onChange([...valor, { manipuladorUuid: nuevo.uuid, nombre: nuevo.nombre, documento: nuevo.documento || "" }]);
      setCreando(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      {valor.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {valor.map((m, i) => (
            <span key={`${m.manipuladorUuid || m.nombre}-${i}`} className="badge rounded-pill d-inline-flex align-items-center gap-1 fw-normal" style={{ backgroundColor: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0" }}>
              {m.nombre}
              {m.documento ? ` · CC ${m.documento}` : ""}
              <button type="button" className="btn btn-link p-0 text-danger d-inline-flex" title="Quitar" onClick={() => onChange(valor.filter((_, j) => j !== i))}>
                <FiX size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="d-flex gap-2 align-items-center">
        <input list="manipuladores-opciones" className="form-control form-control-sm rounded-3" placeholder="Busca un manipulador por nombre o identificación..." value={texto} onChange={(e) => elegir(e.target.value)} />
        <datalist id="manipuladores-opciones">
          {opciones.map((c) => (
            <option key={c.uuid} value={etiqueta(c)} />
          ))}
        </datalist>
        {!creando && (
          <button type="button" className="btn btn-sm btn-outline-success rounded-3 text-nowrap d-flex align-items-center gap-1" onClick={() => setCreando({ nombre: texto, apellido: "", documento: "" })} title="Crear un manipulador nuevo">
            <FiPlus /> Crear
          </button>
        )}
      </div>
      {creando && (
        <div className="border rounded-3 p-2 mt-2" style={{ backgroundColor: "#f8faf9" }}>
          <div className="small fw-semibold mb-1">Nuevo manipulador de plaguicidas</div>
          <div className="row g-2">
            <div className="col-md-4">
              <input className="form-control form-control-sm rounded-3" placeholder="Nombre" value={creando.nombre} onChange={(e) => setCreando((c) => ({ ...c, nombre: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <input className="form-control form-control-sm rounded-3" placeholder="Apellido" value={creando.apellido} onChange={(e) => setCreando((c) => ({ ...c, apellido: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <input className="form-control form-control-sm rounded-3" placeholder="Identificación" value={creando.documento} onChange={(e) => setCreando((c) => ({ ...c, documento: e.target.value }))} />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setCreando(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-sm btn-brand rounded-3" disabled={guardando} onClick={crear}>
              {guardando ? "Creando..." : "Crear y agregar"}
            </button>
          </div>
        </div>
      )}
      {error && <div className="small text-danger mt-1">{error}</div>}
    </div>
  );
}
