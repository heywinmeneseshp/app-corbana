"use client";

import { useEffect, useState } from "react";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";

const fecha = (iso) => new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" });

// Semáforo del parecido entre las capturas nuevas y el rostro actual (distancia: menor = más parecido).
function Parecido({ valor }) {
  if (valor === null || valor === undefined) return <span className="text-secondary">—</span>;
  const [texto, estilo] =
    valor <= 0.45
      ? ["Parecido", { backgroundColor: "#d1fae5", color: "#047857" }]
      : valor <= 0.55
        ? ["Dudoso", { backgroundColor: "#fef3c7", color: "#b45309" }]
        : ["Distinto ⚠", { backgroundColor: "#fee2e2", color: "#b91c1c" }];
  return (
    <span className="badge rounded-pill" style={estilo} title="Distancia con el rostro actual: menor es más parecido">
      {texto} · {valor.toFixed(2)}
    </span>
  );
}

// Solicitudes para volver a registrar un rostro: las aprueba (reemplaza el rostro) o rechaza otro usuario con permiso.
export default function SolicitudesRostroModal({ onClose, onCambio }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(null);

  const cargar = () =>
    apiFetch("/asistencia/rostros/solicitudes")
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
  }, []);

  async function resolver(s, aprobar) {
    let nota = null;
    if (aprobar) {
      if (!window.confirm(`¿Aprobar el nuevo rostro de ${s.colaborador.nombre}? Reemplaza el rostro actual.`)) return;
    } else {
      nota = window.prompt(`Motivo del rechazo para ${s.colaborador.nombre} (opcional):`, "");
      if (nota === null) return;
    }
    setOcupado(s.uuid);
    setError("");
    try {
      await apiFetch(`/asistencia/rostros/solicitudes/${s.uuid}/${aprobar ? "aprobar" : "rechazar"}`, { method: "POST", body: JSON.stringify({ nota }) });
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <ModalShell title="Solicitudes de nuevo registro de rostro" onClose={onClose} size="lg" height="auto">
      <p className="small text-secondary mb-3">
        Cuando alguien con rostro ya registrado lo vuelve a registrar, las capturas nuevas esperan aquí. Al aprobar reemplazan el rostro; al rechazar se descartan. El
        <strong> parecido</strong> compara las capturas nuevas con el rostro actual: si dice «Distinto», verifica que sea la misma persona. Nadie aprueba su propia solicitud.
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {cargando ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-secondary small mb-0">No hay solicitudes pendientes.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.8rem" }}>
            <thead className="table-light">
              <tr>
                <th className="fw-medium">Colaborador</th>
                <th className="fw-medium">Lo pidió</th>
                <th className="fw-medium text-center">Fecha</th>
                <th className="fw-medium text-center">Parecido</th>
                <th className="fw-medium text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.uuid}>
                  <td className="fw-medium">
                    {s.colaborador.nombre}
                    {s.colaborador.documento && <div className="text-secondary fw-normal">{s.colaborador.documento}</div>}
                  </td>
                  <td>{s.solicitante || "—"}</td>
                  <td className="text-center text-nowrap">{fecha(s.fecha)}</td>
                  <td className="text-center">
                    <Parecido valor={s.parecido} />
                  </td>
                  <td className="text-center text-nowrap">
                    {s.propia ? (
                      <span className="text-secondary">Otro usuario debe aprobarla</span>
                    ) : (
                      <>
                        <button type="button" className="btn btn-brand btn-sm rounded-3 me-1" disabled={ocupado === s.uuid} onClick={() => resolver(s, true)}>
                          Aprobar
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" disabled={ocupado === s.uuid} onClick={() => resolver(s, false)}>
                          Rechazar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
