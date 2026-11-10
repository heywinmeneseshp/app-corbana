"use client";

import { useEffect, useState } from "react";
import { FiUserPlus, FiX } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import EnrolarRostroModal from "./EnrolarRostroModal";
import { SelectorUbicacion, aParametros } from "./ubicaciones";

// Para quien solo registra asistencia: crear un colaborador nuevo y registrar su rostro por primera vez, o registrar el rostro
// de un colaborador que todavía no tiene. No edita colaboradores existentes ni vuelve a registrar rostros.
// `modo`: "nuevo" (crear y enrolar) o "rostro" (elegir uno sin rostro).
export default function RegistrarColaboradorModal({ modo, onClose, onCambio }) {
  const [estado, setEstado] = useState({ fincas: [], lugares: [], colaboradores: [] });
  const [form, setForm] = useState({ nombre: "", apellido: "", documento: "", ubicacion: "" });
  const [elegido, setElegido] = useState("");
  const [enrolar, setEnrolar] = useState(null); // colaborador al que se le registra el rostro
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/asistencia/rostros-estado")
      .then((d) => setEstado({ fincas: d.fincas || [], lugares: d.lugares || [], colaboradores: (d.colaboradores || []).filter((c) => !c.enrolado) }))
      .catch((err) => setError(err.message));
  }, []);

  const campo = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const c = await apiFetch("/colaboradores", {
        method: "POST",
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim() || null,
          documento: form.documento.trim() || null,
          ...aParametros(form.ubicacion),
        }),
      });
      const creado = c?.data || c;
      onCambio?.();
      setEnrolar({ uuid: creado.uuid, nombre: `${creado.nombre} ${creado.apellido || ""}`.trim(), rostroEnrolado: false, rostroMuestras: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (enrolar) return <EnrolarRostroModal colaborador={enrolar} onClose={onClose} onCambio={onCambio} />;

  return (
    <ModalShell title={modo === "nuevo" ? "Nuevo colaborador" : "Registrar rostro"} onClose={onClose}>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {modo === "nuevo" ? (
        <form onSubmit={crear} className="row g-2">
          <p className="small text-secondary mb-1">Registra al colaborador nuevo; después se toma su rostro.</p>
          <div className="col-6">
            <label className="form-label small fw-medium">Nombre *</label>
            <input className="form-control form-control-sm rounded-3" required maxLength={150} value={form.nombre} onChange={(e) => campo("nombre", e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium">Apellido</label>
            <input className="form-control form-control-sm rounded-3" maxLength={150} value={form.apellido} onChange={(e) => campo("apellido", e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium">Identificación</label>
            <input className="form-control form-control-sm rounded-3" maxLength={30} value={form.documento} onChange={(e) => campo("documento", e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium">Lugar predeterminado</label>
            <SelectorUbicacion fincas={estado.fincas} lugares={estado.lugares} value={form.ubicacion} onChange={(v) => campo("ubicacion", v)} vacio="Selecciona" />
          </div>
          <div className="col-12 d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-1" onClick={onClose}>
              <FiX /> Cancelar
            </button>
            <button type="submit" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1" disabled={guardando || !form.nombre.trim()}>
              <FiUserPlus /> {guardando ? "Guardando..." : "Crear y tomar rostro"}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <p className="small text-secondary">Solo aparecen los colaboradores que todavía no tienen rostro registrado.</p>
          <select className="form-select form-select-sm rounded-3 mb-3" value={elegido} onChange={(e) => setElegido(e.target.value)}>
            <option value="">Selecciona el colaborador</option>
            {estado.colaboradores.map((c) => (
              <option key={c.uuid} value={c.uuid}>
                {c.nombre}
                {c.documento ? ` · ${c.documento}` : ""}
              </option>
            ))}
          </select>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-brand btn-sm rounded-3"
              disabled={!elegido}
              onClick={() => {
                const c = estado.colaboradores.find((x) => x.uuid === elegido);
                setEnrolar({ uuid: c.uuid, nombre: c.nombre, rostroEnrolado: false, rostroMuestras: 0 });
              }}
            >
              Tomar rostro
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
