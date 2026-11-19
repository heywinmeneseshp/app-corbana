"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";

// Manipuladores de plaguicidas del comprobante: se eligen de los colaboradores (con su identificación) y, si la persona no
// existe, se crea aquí mismo como colaborador de Sanidad Vegetal. `valor`: [{ colaboradorUuid?, nombre, documento }].
export default function ManipuladoresPicker({ valor, onChange }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(null); // { nombre, apellido, documento } mientras se crea uno nuevo
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const puedeCrear = hasPermission("sanidad_vegetal.colaboradores.crear") || hasPermission("colaborador.crear");

  useEffect(() => {
    apiFetch("/comprobantes-aspersion/participantes-disponibles")
      .then((d) => setColaboradores(d.asistentes || []))
      .catch(() => setColaboradores([]));
  }, []);

  const etiqueta = (c) => `${c.nombre}${c.documento ? ` · CC ${c.documento}` : ""}`;
  const elegidos = new Set(valor.map((m) => m.colaboradorUuid).filter(Boolean));
  const opciones = colaboradores.filter((c) => !elegidos.has(c.uuid));

  function elegir(t) {
    setTexto(t);
    const c = opciones.find((x) => etiqueta(x) === t);
    if (!c) return;
    onChange([...valor, { colaboradorUuid: c.uuid, nombre: c.nombre, documento: c.documento || "" }]);
    setTexto("");
  }

  async function crear() {
    if (!creando.nombre.trim()) return setError("Escribe el nombre.");
    setGuardando(true);
    setError("");
    try {
      const nuevo = await apiFetch("/colaboradores", {
        method: "POST",
        body: JSON.stringify({
          nombre: creando.nombre.trim(),
          apellido: creando.apellido.trim() || null,
          documento: creando.documento.trim() || null,
          cargo: "Manipulador de plaguicidas",
          modulo: "SANIDAD_VEGETAL",
        }),
      });
      const nombre = [nuevo.nombre, nuevo.apellido].filter(Boolean).join(" ");
      setColaboradores((l) => [...l, { uuid: nuevo.uuid, nombre, documento: nuevo.documento || null }]);
      onChange([...valor, { colaboradorUuid: nuevo.uuid, nombre, documento: nuevo.documento || "" }]);
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
            <span key={`${m.colaboradorUuid || m.nombre}-${i}`} className="badge rounded-pill d-inline-flex align-items-center gap-1 fw-normal" style={{ backgroundColor: "#ecfdf3", color: "#166534", border: "1px solid #bbf7d0" }}>
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
        <input list="manipuladores-opciones" className="form-control form-control-sm rounded-3" placeholder="Busca un colaborador por nombre o identificación..." value={texto} onChange={(e) => elegir(e.target.value)} />
        <datalist id="manipuladores-opciones">
          {opciones.map((c) => (
            <option key={c.uuid} value={etiqueta(c)} />
          ))}
        </datalist>
        {puedeCrear && !creando && (
          <button type="button" className="btn btn-sm btn-outline-success rounded-3 text-nowrap d-flex align-items-center gap-1" onClick={() => setCreando({ nombre: texto, apellido: "", documento: "" })} title="Crear el manipulador como colaborador de Sanidad Vegetal">
            <FiPlus /> Crear
          </button>
        )}
      </div>
      {creando && (
        <div className="border rounded-3 p-2 mt-2" style={{ backgroundColor: "#f8faf9" }}>
          <div className="small fw-semibold mb-1">Nuevo manipulador (se guarda en Sanidad Vegetal → Colaboradores)</div>
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
