"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiUser } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import EnrolarRostroModal from "./EnrolarRostroModal";

// «Mi registro»: la ficha de colaborador del usuario de la sesión y su rostro (autoservicio). Crear la ficha propia, registrar el
// rostro una vez, reforzarlo y pedir un nuevo registro (que aprueba otro usuario con permiso).
export default function MiRegistro({ fincas }) {
  const [ficha, setFicha] = useState(undefined); // undefined = cargando, null = sin ficha
  const [crear, setCrear] = useState(false);
  const [enrolar, setEnrolar] = useState(false);
  const [error, setError] = useState("");

  const cargar = () =>
    apiFetch("/colaboradores/mio")
      .then((f) => setFicha(f ?? null))
      .catch((err) => {
        setFicha(null);
        setError(err.message);
      });

  useEffect(() => {
    cargar();
  }, []);

  if (ficha === undefined) return null;
  const solicitud = ficha?.solicitudRostro;

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex flex-wrap align-items-center gap-3">
        <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: "#e8f6ee", color: "#15803d" }}>
          <FiUser size={18} />
        </div>
        <div className="flex-grow-1">
          <div className="fw-semibold">Mi registro</div>
          {ficha ? (
            <div className="small text-secondary">
              {`${ficha.nombre} ${ficha.apellido || ""}`.trim()}
              {ficha.documento ? ` · ${ficha.documento}` : ""}
              {ficha.finca ? ` · ${ficha.finca.nombre}` : ""} ·{" "}
              {ficha.rostroEnrolado ? (
                <span style={{ color: "#047857" }}>
                  <FiCheckCircle className="me-1" />
                  Rostro registrado ({ficha.rostroMuestras} capturas)
                </span>
              ) : (
                <span style={{ color: "#b45309" }}>Rostro sin registrar</span>
              )}
              {solicitud?.estado === "PENDIENTE" && (
                <span className="ms-2" style={{ color: "#b45309" }}>
                  <FiClock className="me-1" />
                  Nuevo registro pendiente de aprobación
                </span>
              )}
              {solicitud?.estado === "RECHAZADA" && solicitud.nota && <span className="ms-2 text-danger">Último nuevo registro rechazado: {solicitud.nota}</span>}
            </div>
          ) : (
            <div className="small text-secondary">Aún no tienes ficha de colaborador: créala para registrar tu rostro y marcar tu asistencia.</div>
          )}
          {error && <div className="small text-danger">{error}</div>}
        </div>
        {ficha ? (
          <button type="button" className="btn btn-outline-success btn-sm rounded-3" onClick={() => setEnrolar(true)}>
            {ficha.rostroEnrolado ? "Reforzar o volver a registrar" : "Registrar mi rostro"}
          </button>
        ) : (
          <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={() => setCrear(true)}>
            Crear mi ficha
          </button>
        )}
      </div>

      {crear && (
        <CrearMiFichaModal
          fincas={fincas}
          onClose={() => setCrear(false)}
          onCreada={(f) => {
            setCrear(false);
            setFicha(f);
          }}
        />
      )}
      {enrolar && ficha && (
        <EnrolarRostroModal
          colaborador={{ uuid: ficha.uuid, nombre: `${ficha.nombre} ${ficha.apellido || ""}`.trim(), rostroEnrolado: ficha.rostroEnrolado, rostroMuestras: ficha.rostroMuestras }}
          onClose={() => setEnrolar(false)}
          onCambio={cargar}
        />
      )}
    </div>
  );
}

function CrearMiFichaModal({ fincas, onClose, onCreada }) {
  const [f, setF] = useState({ nombre: "", apellido: "", documento: "", telefono: "", cargo: "", fincaUuid: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const campo = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim ? v.trim() || null : v]));
      onCreada(await apiFetch("/colaboradores/mio", { method: "POST", body: JSON.stringify(body) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Crear mi ficha de colaborador" onClose={onClose} height="auto">
      <form onSubmit={guardar} className="row g-2">
        <div className="col-12 small text-secondary">Queda vinculada a tu usuario. Si dejas el nombre vacío se usa el de tu usuario.</div>
        <div className="col-6">
          <label className="form-label small fw-medium">Nombre</label>
          <input className="form-control form-control-sm rounded-3" maxLength={150} value={f.nombre} onChange={(e) => campo("nombre", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Apellido</label>
          <input className="form-control form-control-sm rounded-3" maxLength={150} value={f.apellido} onChange={(e) => campo("apellido", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Identificación</label>
          <input className="form-control form-control-sm rounded-3" required minLength={3} maxLength={30} value={f.documento} onChange={(e) => campo("documento", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Teléfono</label>
          <input className="form-control form-control-sm rounded-3" maxLength={30} value={f.telefono} onChange={(e) => campo("telefono", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Cargo</label>
          <input className="form-control form-control-sm rounded-3" maxLength={100} value={f.cargo} onChange={(e) => campo("cargo", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Finca predeterminada (opcional)</label>
          <select className="form-select form-select-sm rounded-3" value={f.fincaUuid} onChange={(e) => campo("fincaUuid", e.target.value)}>
            <option value="">Ninguna</option>
            {fincas.map((x) => (
              <option key={x.uuid} value={x.uuid}>
                {x.nombre}
              </option>
            ))}
          </select>
        </div>
        {error && <div className="col-12 alert alert-danger py-2 small mb-0">{error}</div>}
        <div className="col-12 d-flex justify-content-end gap-2 mt-2">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={guardando}>
            {guardando ? "Guardando..." : "Crear mi ficha"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
