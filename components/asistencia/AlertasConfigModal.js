"use client";

import { useEffect, useState } from "react";
import { FiSave, FiX } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";
import { apiFetch, apiFetchTodos } from "@/lib/api";

// Roles que reciben copia de las alertas de asistencia por correo. Solo Administrador.
export default function AlertasConfigModal({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosSel, setUsuariosSel] = useState([]);
  const [radio, setRadio] = useState("500");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/roles?limit=100"), apiFetchTodos("/users?limit=100"), apiFetch("/asistencia/alertas/destinatarios"), apiFetch("/asistencia/radio-finca")])
      .then(([{ items }, us, cfg, rad]) => {
        setRadio(String(rad?.radioMetros ?? 500));
        const lista = (items || []).map((r) => ({ uuid: r.uuid, label: r.nombre }));
        setRoles(lista);
        setSelected(lista.filter((r) => (cfg?.jornadaIncompleta?.rolesUuids || []).includes(r.uuid)));
        const listaUs = (us?.items || us || [])
          .filter((u) => u.estado !== false)
          .map((u) => ({ uuid: u.uuid, label: `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario, sublabel: u.email || "Sin correo" }));
        setUsuarios(listaUs);
        setUsuariosSel(listaUs.filter((u) => (cfg?.jornadaIncompleta?.usuariosUuids || []).includes(u.uuid)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      await apiFetch("/asistencia/radio-finca", { method: "PUT", body: JSON.stringify({ radioMetros: Number(radio) }) });
      await apiFetch("/asistencia/alertas/destinatarios", {
        method: "PUT",
        body: JSON.stringify({ jornadaIncompleta: { rolesUuids: selected.map((r) => r.uuid), usuariosUuids: usuariosSel.map((u) => u.uuid) } }),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Configuración de asistencia" onClose={onClose}>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="fw-semibold small mb-1">Radio de las fincas sin perímetro</div>
      <p className="small text-secondary mb-2">
        Si una finca no tiene perímetro (KML) cargado, se usa su latitud y longitud: una marcación a más metros que esto queda fuera de la finca.
      </p>
      <div className="d-flex align-items-center gap-2 mb-3">
        <input type="number" min="10" max="50000" step="10" className="form-control form-control-sm" style={{ maxWidth: 120 }} value={radio} onChange={(e) => setRadio(e.target.value)} />
        <span className="small text-secondary">metros a la redonda</span>
      </div>
      <div className="fw-semibold small mb-1">Jornada incompleta</div>
      <p className="small text-secondary mb-2">
        Los usuarios de estos roles y los usuarios elegidos reciben copia del correo que le llega a cada colaborador con la jornada incompleta, según sus fincas y
        lugares asignados (sin ninguno asignado, de todos).
      </p>
      {cargando ? (
        <p className="small text-secondary mb-0">Cargando...</p>
      ) : (
        <>
          <div className="small fw-medium mb-1">Roles</div>
          <TagPicker items={roles} selected={selected} onChange={setSelected} placeholder="Buscar rol para agregar..." />
          <div className="small fw-medium mb-1 mt-3">Usuarios</div>
          <TagPicker items={usuarios} selected={usuariosSel} onChange={setUsuariosSel} placeholder="Buscar usuario para agregar..." />
        </>
      )}
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-1" onClick={onClose}>
          <FiX /> Cancelar
        </button>
        <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1" disabled={cargando || guardando} onClick={guardar}>
          <FiSave /> {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}
