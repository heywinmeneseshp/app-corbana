"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";

const nombreUsuario = (u) => `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario;

// Quién recibe el Informe semanal cuando se pulsa «Enviar»: correos sueltos, roles y usuarios (solo Administrador).
// Guarda en GET/PUT /dashboard/informe-semanal/destinatarios.
export default function DestinatariosInformeModal({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [correosTexto, setCorreosTexto] = useState("");
  const [rolesSel, setRolesSel] = useState([]);
  const [usuariosSel, setUsuariosSel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/roles?limit=100").catch(() => ({ items: [] })),
      apiFetch("/users?limit=100").catch(() => ({ items: [] })),
      apiFetch("/dashboard/informe-semanal/destinatarios"),
    ])
      .then(([r, u, d]) => {
        const rolesItems = r.items || [];
        const usuariosItems = u.items || [];
        setRoles(rolesItems);
        setUsuarios(usuariosItems);
        setCorreosTexto((d.correos || []).join(", "));
        setRolesSel(rolesItems.filter((x) => (d.rolesUuids || []).includes(x.uuid)).map((x) => ({ uuid: x.uuid, label: x.nombre })));
        setUsuariosSel(
          usuariosItems.filter((x) => (d.usuariosUuids || []).includes(x.uuid)).map((x) => ({ uuid: x.uuid, label: nombreUsuario(x), sublabel: x.email })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      await apiFetch("/dashboard/informe-semanal/destinatarios", {
        method: "PUT",
        body: JSON.stringify({
          correos: correosTexto
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          rolesUuids: rolesSel.map((x) => x.uuid),
          usuariosUuids: usuariosSel.map((x) => x.uuid),
        }),
      });
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Destinatarios del informe semanal" onClose={onClose} size="lg">
      <p className="small text-secondary mb-3">
        Reciben el informe cuando alguien pulsa <strong>Enviar finca</strong> o <strong>Enviar todas</strong> en el Resumen semanal; no se envía solo.
        Cada usuario (por rol o elegido uno a uno) recibe solo el informe de <strong>sus fincas asignadas</strong>; el Administrador y quien no tiene
        fincas asignadas reciben todas. Los correos sueltos reciben todas las fincas.
      </p>
      {loading ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : (
        <form onSubmit={guardar}>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <label className="form-label small fw-medium">Roles</label>
          <TagPicker
            items={roles.map((x) => ({ uuid: x.uuid, label: x.nombre }))}
            selected={rolesSel}
            onChange={(n) => {
              setRolesSel(n);
              setGuardado(false);
            }}
            placeholder="Buscar rol para agregar..."
          />
          <div className="mt-3">
            <label className="form-label small fw-medium">Usuarios</label>
            <TagPicker
              items={usuarios.map((x) => ({ uuid: x.uuid, label: nombreUsuario(x), sublabel: x.email }))}
              selected={usuariosSel}
              onChange={(n) => {
                setUsuariosSel(n);
                setGuardado(false);
              }}
              placeholder="Buscar usuario para agregar..."
            />
          </div>
          <div className="mt-3">
            <label className="form-label small fw-medium">Correos sueltos</label>
            <input
              type="text"
              className="form-control form-control-sm rounded-3"
              placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
              value={correosTexto}
              onChange={(e) => {
                setCorreosTexto(e.target.value);
                setGuardado(false);
              }}
            />
            <p className="form-text small text-secondary mb-0">Uno o varios correos separados por coma.</p>
          </div>
          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-brand btn-sm rounded-3 flex-grow-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={onClose}>
              Cerrar
            </button>
          </div>
          {guardado && <p className="small text-success mb-0 mt-2">Guardado.</p>}
        </form>
      )}
    </ModalShell>
  );
}
