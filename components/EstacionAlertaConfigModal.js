"use client";

import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

function fmtFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

// Configura quién recibe el correo cuando la Estación Meteorológica lleva
// más de 24 horas sin enviar datos. El sistema lo revisa solo todos los días
// a las 6:00 a.m. (hora Colombia). Mismo patrón de destinatarios que las
// Alertas de Sanidad Vegetal: correos sueltos, roles y usuarios puntuales.
export default function EstacionAlertaConfigModal({ onClose, embebido = false }) {
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [correosTexto, setCorreosTexto] = useState("");
  const [rolesSel, setRolesSel] = useState([]);
  const [usuariosSel, setUsuariosSel] = useState([]);
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/roles?limit=100").catch(() => ({ items: [] })),
      apiFetch("/users?limit=100").catch(() => ({ items: [] })),
      apiFetch("/estacion-meteorologica/alerta-destinatarios"),
      apiFetch("/estacion-meteorologica/estado-conexion").catch(() => null),
    ])
      .then(([rolesRes, usuariosRes, destRes, estadoRes]) => {
        const rolesItems = rolesRes.items || [];
        const usuariosItems = usuariosRes.items || [];
        setRoles(rolesItems);
        setUsuarios(usuariosItems);
        setEstado(estadoRes);
        setCorreosTexto((destRes.correos || []).join(", "));
        // TagPicker trabaja con objetos { uuid, label, sublabel } — se
        // rehidratan los uuids guardados contra la lista completa.
        setRolesSel(
          rolesItems.filter((r) => (destRes.rolesUuids || []).includes(r.uuid)).map((r) => ({ uuid: r.uuid, label: r.nombre })),
        );
        setUsuariosSel(
          usuariosItems
            .filter((u) => (destRes.usuariosUuids || []).includes(u.uuid))
            .map((u) => ({ uuid: u.uuid, label: nombreCompleto(u), sublabel: u.email })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      const correos = correosTexto
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await apiFetch("/estacion-meteorologica/alerta-destinatarios", {
        method: "PUT",
        body: JSON.stringify({
          correos,
          rolesUuids: rolesSel.map((r) => r.uuid),
          usuariosUuids: usuariosSel.map((u) => u.uuid),
        }),
      });
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const contenido = (
    <>
      <p className="small text-secondary mb-3">
        Todos los días a las <strong>6:00 a.m.</strong> el sistema revisa la estación. Si lleva{" "}
        <strong>más de 24 horas sin enviar datos</strong>, manda un correo a las personas de abajo pidiendo que revisen si
        está conectada. Nadie recibe nada mientras no haya al menos un destinatario configurado.
      </p>

      {estado && (
        <div className={`alert py-2 small d-flex align-items-start gap-2 ${estado.sinDatos ? "alert-warning" : "alert-success"}`}>
          {estado.sinDatos ? <FiAlertTriangle className="mt-1 flex-shrink-0" /> : <FiCheckCircle className="mt-1 flex-shrink-0" />}
          <div>
            {estado.sinDatos ? (
              <>
                <strong>Ahora mismo la estación está sin datos</strong>
                {estado.ultimoDato
                  ? ` — último dato: ${fmtFechaHora(estado.ultimoDato)} (hace ${Math.floor(estado.horasSinDatos)} horas).`
                  : ` — ${estado.detalle || "no reportó datos."}`}
              </>
            ) : (
              <>
                <strong>La estación está reportando datos</strong> — último dato: {fmtFechaHora(estado.ultimoDato)}.
              </>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : (
        <form onSubmit={handleGuardar}>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <label className="form-label small fw-medium">Correos sueltos</label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
            value={correosTexto}
            onChange={(e) => {
              setCorreosTexto(e.target.value);
              setGuardado(false);
            }}
          />
          <p className="form-text small text-secondary mb-0">Uno o varios correos separados por coma.</p>

          <div className="mt-3">
            <label className="form-label small fw-medium">Roles</label>
            <TagPicker
              items={roles.map((r) => ({ uuid: r.uuid, label: r.nombre }))}
              selected={rolesSel}
              onChange={(nuevos) => {
                setRolesSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar rol para agregar..."
            />
            <p className="form-text small text-secondary mb-0">Cualquier usuario con este rol recibe la alerta.</p>
          </div>

          <div className="mt-3">
            <label className="form-label small fw-medium">Usuarios</label>
            <TagPicker
              items={usuarios.map((u) => ({ uuid: u.uuid, label: nombreCompleto(u), sublabel: u.email }))}
              selected={usuariosSel}
              onChange={(nuevos) => {
                setUsuariosSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar usuario para agregar..."
            />
          </div>

          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-brand btn-sm rounded-3 flex-grow-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
          {guardado && <p className="small text-success mb-0 mt-2">Guardado.</p>}
        </form>
      )}
    </>
  );

  return embebido ? contenido : (
    <ModalShell title="Alerta de estación sin datos" onClose={onClose} size="lg">
      {contenido}
    </ModalShell>
  );
}
