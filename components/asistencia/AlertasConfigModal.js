"use client";

import { useEffect, useState } from "react";
import { FiSave, FiX } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";
import { apiFetch } from "@/lib/api";

// Roles que reciben copia de las alertas de asistencia por correo. Solo Administrador.
export default function AlertasConfigModal({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/roles?limit=100"), apiFetch("/asistencia/alertas/destinatarios")])
      .then(([{ items }, cfg]) => {
        const lista = (items || []).map((r) => ({ uuid: r.uuid, label: r.nombre }));
        setRoles(lista);
        setSelected(lista.filter((r) => (cfg?.jornadaIncompleta?.rolesUuids || []).includes(r.uuid)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      await apiFetch("/asistencia/alertas/destinatarios", {
        method: "PUT",
        body: JSON.stringify({ jornadaIncompleta: { rolesUuids: selected.map((r) => r.uuid) } }),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Copias de las alertas" onClose={onClose}>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="fw-semibold small mb-1">Jornada incompleta</div>
      <p className="small text-secondary mb-2">
        Los usuarios de estos roles reciben copia del correo que le llega a cada colaborador con la jornada incompleta.
      </p>
      {cargando ? (
        <p className="small text-secondary mb-0">Cargando...</p>
      ) : (
        <TagPicker items={roles} selected={selected} onChange={setSelected} placeholder="Buscar rol para agregar..." />
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
