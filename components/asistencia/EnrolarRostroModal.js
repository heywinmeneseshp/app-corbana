"use client";

import { useEffect, useRef, useState } from "react";
import { FiCamera, FiTrash2 } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { cargarMotorFacial, descriptorDeElemento } from "@/lib/faceDescriptor";

// Poses guiadas: varios ángulos de la misma persona dan más información y reconocen mejor aunque llegue de lado.
const POSES = [
  { id: "frente", texto: "Mira de frente a la cámara" },
  { id: "izquierda", texto: "Gira la cabeza un poco a tu izquierda" },
  { id: "derecha", texto: "Gira la cabeza un poco a tu derecha" },
  { id: "arriba", texto: "Levanta un poco la cara" },
  { id: "abajo", texto: "Baja un poco la cara" },
];
const MAX_MUESTRAS = 8; // mismo tope que la API

// Enrola el rostro de un colaborador con la webcam. No se guardan fotos: solo los vectores (128 números por pose).
// Sin rostro: primer registro directo. Con rostro: «Reforzar» agrega capturas sin aprobación; «Volver a registrar» envía las capturas
// nuevas como solicitud que otro usuario con permiso aprueba (mientras tanto el rostro actual sigue funcionando).
export default function EnrolarRostroModal({ colaborador, onClose, onCambio }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const yaTiene = Boolean(colaborador.rostroEnrolado);
  const libres = Math.max(0, MAX_MUESTRAS - Number(colaborador.rostroMuestras || 0));
  const [modo, setModo] = useState(yaTiene ? (libres > 0 ? "reforzar" : "reemplazar") : "nuevo");
  const [listo, setListo] = useState(false);
  const [muestras, setMuestras] = useState([]);
  const [consentimiento, setConsentimiento] = useState(yaTiene);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(null); // mensaje final cuando queda pendiente de aprobación

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        await cargarMotorFacial();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } } });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setListo(true);
      } catch (err) {
        setError(err?.name === "NotAllowedError" ? "No diste permiso para usar la cámara." : err.message || "No se pudo iniciar la cámara.");
      }
    })();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Reforzar: solo las capturas que caben hasta el tope.
  const poses = modo === "reforzar" ? POSES.slice(0, Math.min(POSES.length, libres)) : POSES;
  const poseActual = poses[muestras.length];
  const completo = poses.length > 0 && muestras.length === poses.length;

  const cambiarModo = (m) => {
    setModo(m);
    setMuestras([]);
    setError("");
  };

  async function capturar() {
    if (!poseActual || !videoRef.current) return;
    setError("");
    setProcesando(true);
    try {
      const { descriptor } = await descriptorDeElemento(videoRef.current);
      setMuestras((m) => [...m, { pose: poseActual.id, descriptor }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      const r = await apiFetch(`/asistencia/rostros/${colaborador.uuid}`, {
        method: "PUT",
        body: JSON.stringify({ muestras, consentimiento: true, reforzar: modo === "reforzar" }),
      });
      onCambio?.();
      if (r?.solicitud) {
        setEnviado("Nuevo registro enviado. Queda pendiente hasta que otro usuario con permiso lo apruebe; mientras tanto el rostro actual sigue funcionando.");
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitarRostro() {
    if (!window.confirm(`¿Eliminar el rostro registrado de ${colaborador.nombre}? Tendrá que enrolarse de nuevo para marcar asistencia.`)) return;
    try {
      await apiFetch(`/asistencia/rostros/${colaborador.uuid}`, { method: "DELETE" });
      onCambio?.();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  if (enviado) {
    return (
      <ModalShell title={`Rostro de ${colaborador.nombre}`} onClose={onClose} width="34rem" height="auto">
        <div className="alert alert-success small">{enviado}</div>
        <div className="d-flex justify-content-end">
          <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={onClose}>
            Entendido
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title={`Rostro de ${colaborador.nombre}`} onClose={onClose} width="34rem" height="auto">
      {yaTiene && (
        <div className="btn-group btn-group-sm w-100 mb-3" role="group">
          <button type="button" className={`btn ${modo === "reforzar" ? "btn-brand" : "btn-outline-secondary"}`} disabled={libres === 0} onClick={() => cambiarModo("reforzar")} title={libres === 0 ? `Ya tiene el máximo de ${MAX_MUESTRAS} capturas` : undefined}>
            Reforzar (agregar capturas)
          </button>
          <button type="button" className={`btn ${modo === "reemplazar" ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => cambiarModo("reemplazar")}>
            Volver a registrar
          </button>
        </div>
      )}
      <p className="small text-secondary mb-3">
        {modo === "reforzar"
          ? `Tiene ${colaborador.rostroMuestras} captura(s); se agregan ${poses.length} más para que lo reconozca mejor. No necesita aprobación.`
          : modo === "reemplazar"
            ? "Las capturas nuevas reemplazarán el rostro actual cuando otro usuario con permiso las apruebe."
            : `Se toman ${POSES.length} capturas desde distintos ángulos.`}{" "}
        <strong>No se guarda ninguna foto</strong>: solo números que identifican el rostro.
      </p>

      <div className="position-relative rounded-3 overflow-hidden bg-dark mb-3" style={{ aspectRatio: "4 / 3" }}>
        <video ref={videoRef} playsInline muted className="w-100 h-100" style={{ objectFit: "cover", transform: "scaleX(-1)" }} />
        {!listo && !error && <div className="position-absolute top-50 start-50 translate-middle text-white small">Cargando cámara y modelos...</div>}
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {poses.map((p, i) => (
          <span key={p.id} className={`badge rounded-pill ${i < muestras.length ? "text-bg-success" : i === muestras.length ? "text-bg-primary" : "text-bg-light text-secondary"}`}>
            {i + 1}. {p.id}
          </span>
        ))}
      </div>

      {!completo && poseActual && <div className="fw-medium mb-2">{poseActual.texto}</div>}
      {completo && <div className="fw-medium mb-2 text-success">Listo: {poses.length} capturas tomadas.</div>}

      <div className="form-check mb-3">
        <input type="checkbox" className="form-check-input" id="rostro-consentimiento" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
        <label className="form-check-label small" htmlFor="rostro-consentimiento">
          El colaborador autoriza el tratamiento de su dato biométrico (huella facial) para registrar su asistencia.
        </label>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="d-flex justify-content-between gap-2">
        <div>
          {yaTiene && hasPermission("asistencia.aprobar_rostro") && (
            <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1" style={{ color: "#dc2626" }} onClick={quitarRostro}>
              <FiTrash2 /> Quitar rostro
            </button>
          )}
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
            Cancelar
          </button>
          {!completo ? (
            <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" disabled={!listo || procesando || !consentimiento || !poseActual} onClick={capturar}>
              <FiCamera /> {procesando ? "Procesando..." : "Capturar"}
            </button>
          ) : (
            <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={guardando || !consentimiento} onClick={guardar}>
              {guardando ? "Guardando..." : modo === "reforzar" ? "Agregar capturas" : modo === "reemplazar" ? "Enviar para aprobación" : "Guardar rostro"}
            </button>
          )}
        </div>
      </div>
      {muestras.length > 0 && !completo && (
        <button type="button" className="btn btn-sm btn-link p-0 mt-2" onClick={() => setMuestras([])}>
          Empezar de nuevo
        </button>
      )}
    </ModalShell>
  );
}
