"use client";

import { useEffect, useState } from "react";
import { FiSave, FiX } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";
import { apiFetch, apiFetchTodos } from "@/lib/api";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Configuración de las estimaciones de fincas (solo Administrador): quién recibe copia de los correos y el límite de envío de la semana.
export default function ConfigEstimacionModal({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [rolesSel, setRolesSel] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosSel, setUsuariosSel] = useState([]);
  const [limite, setLimite] = useState({ activo: false, dia: 3, hora: "15:00" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/roles?limit=100"), apiFetchTodos("/users?limit=100"), apiFetch("/estimaciones/configuracion")])
      .then(([{ items }, us, cfg]) => {
        const listaRoles = (items || []).map((r) => ({ uuid: r.uuid, label: r.nombre }));
        setRoles(listaRoles);
        setRolesSel(listaRoles.filter((r) => (cfg?.rolesUuids || []).includes(r.uuid)));
        const listaUs = (us?.items || us || [])
          .filter((u) => u.estado !== false)
          .map((u) => ({ uuid: u.uuid, label: `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario, sublabel: u.email || "Sin correo" }));
        setUsuarios(listaUs);
        setUsuariosSel(listaUs.filter((u) => (cfg?.usuariosUuids || []).includes(u.uuid)));
        if (cfg?.limite) setLimite(cfg.limite);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      await apiFetch("/estimaciones/configuracion", {
        method: "PUT",
        body: JSON.stringify({ rolesUuids: rolesSel.map((r) => r.uuid), usuariosUuids: usuariosSel.map((u) => u.uuid), limite: { ...limite, dia: Number(limite.dia) } }),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Configuración de estimaciones" onClose={onClose}>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {cargando ? (
        <p className="small text-secondary mb-0">Cargando...</p>
      ) : (
        <>
          <div className="fw-semibold small mb-1">Límite de envío</div>
          <p className="small text-secondary mb-2">
            Para la semana actual, las estimaciones deben enviarse a más tardar el día y la hora elegidos (hora de Bogotá). Si se envían después, se guardan igual,
            pero le llega una alerta por correo a quien estimó y a quienes están en copia.
          </p>
          <div className="form-check form-switch mb-2">
            <input className="form-check-input" type="checkbox" id="limite-activo" checked={limite.activo} onChange={(e) => setLimite((l) => ({ ...l, activo: e.target.checked }))} />
            <label className="form-check-label small" htmlFor="limite-activo">
              Activar límite de envío
            </label>
          </div>
          <div className="row g-2 mb-3">
            <div className="col-7">
              <label className="form-label small fw-medium mb-1">Día límite</label>
              <select className="form-select form-select-sm" disabled={!limite.activo} value={limite.dia} onChange={(e) => setLimite((l) => ({ ...l, dia: Number(e.target.value) }))}>
                {DIAS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-5">
              <label className="form-label small fw-medium mb-1">Hora</label>
              <input type="time" className="form-control form-control-sm" disabled={!limite.activo} value={limite.hora} onChange={(e) => setLimite((l) => ({ ...l, hora: e.target.value }))} />
            </div>
          </div>

          <div className="fw-semibold small mb-1">Copias de los correos</div>
          <p className="small text-secondary mb-2">
            Los roles y usuarios elegidos reciben copia cuando se vuelve a estimar una finca (queda pendiente de aprobación) y cuando se envía fuera del límite. Quien
            estima siempre recibe el aviso.
          </p>
          <div className="small fw-medium mb-1">Roles</div>
          <TagPicker items={roles} selected={rolesSel} onChange={setRolesSel} placeholder="Buscar rol para agregar..." />
          <div className="small fw-medium mb-1 mt-3">Usuarios</div>
          <TagPicker items={usuarios} selected={usuariosSel} onChange={setUsuariosSel} placeholder="Buscar usuario para agregar..." />
        </>
      )}
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={onClose}>
          <FiX /> Cancelar
        </button>
        <button type="button" className="btn btn-brand btn-sm d-flex align-items-center gap-1" disabled={cargando || guardando} onClick={guardar}>
          <FiSave /> {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}
