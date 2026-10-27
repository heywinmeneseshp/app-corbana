"use client";

import { useEffect, useRef, useState } from "react";
import { FiCamera } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import { descriptorDeElemento } from "@/lib/faceDescriptor";
import { useCamaraRostro, VistaCamara } from "./useCamaraRostro";

const FINCA_KEY = "asistencia.fincaSeleccionada";

const leerFinca = () => {
  try {
    return localStorage.getItem(FINCA_KEY) || "";
  } catch {
    return "";
  }
};

// Marcar entrada/salida con el rostro desde el navegador (lo mismo que la app de campo). Solo se envía el vector
// facial (128 números, no la foto); el servidor identifica a la persona. La cámara queda abierta para marcar a varios.
export default function MarcarAsistenciaModal({ onClose, onCambio }) {
  const { videoRef, listo, errorCamara } = useCamaraRostro();
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [tipo, setTipo] = useState("ENTRADA");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [gps, setGps] = useState(() => (typeof navigator !== "undefined" && navigator.geolocation ? "buscando" : "sin"));
  const ubicacion = useRef(null);

  useEffect(() => {
    apiFetch("/asistencia/rostros-estado")
      .then(({ fincas: lista = [] }) => {
        setFincas(lista);
        const guardada = leerFinca();
        if (guardada && lista.some((f) => f.uuid === guardada)) setFincaUuid(guardada);
        else if (lista.length === 1) setFincaUuid(lista[0].uuid);
      })
      .catch((err) => setMensaje({ texto: err.message, ok: false }));

    if (!navigator.geolocation) {
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        ubicacion.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        setGps("ok");
      },
      () => setGps("sin"),
      { enableHighAccuracy: true, maximumAge: 60000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const etiqueta = tipo === "ENTRADA" ? "Entrada" : "Salida";
  const agregarReciente = (texto, ok) => setRecientes((r) => [{ id: `${Date.now()}`, texto, ok }, ...r].slice(0, 8));

  async function marcar() {
    if (!fincaUuid || !videoRef.current) return;
    setMensaje(null);
    setProcesando(true);
    try {
      const { descriptor } = await descriptorDeElemento(videoRef.current);
      const uuid = crypto.randomUUID();
      const { resultados = [] } = await apiFetch("/asistencia/marcaciones", {
        method: "POST",
        body: JSON.stringify({
          marcaciones: [
            {
              uuid,
              fincaUuid,
              tipo,
              fechaHora: new Date().toISOString(),
              lat: ubicacion.current?.lat ?? null,
              lng: ubicacion.current?.lng ?? null,
              descriptor,
            },
          ],
        }),
      });
      try {
        localStorage.setItem(FINCA_KEY, fincaUuid);
      } catch {
        /* sin almacenamiento local: solo no se recuerda la finca */
      }
      const r = resultados.find((x) => x.uuid === uuid) || resultados[0];
      if (r?.estado === "CREADA" && r.colaborador) {
        setMensaje({ texto: `${etiqueta} registrada: ${r.colaborador.nombre}`, ok: true });
        agregarReciente(`${etiqueta} · ${r.colaborador.nombre}`, true);
        onCambio?.();
      } else if (r?.estado === "DUPLICADA") {
        setMensaje({ texto: `${r.colaborador?.nombre ?? "Esta persona"} ya marcó hace un momento.`, ok: true });
      } else {
        const texto =
          r?.estado === "NO_RECONOCIDA"
            ? "No se reconoció el rostro. Intenta de nuevo con más luz."
            : r?.estado === "AMBIGUA"
              ? "El rostro se parece a más de una persona. Intenta de nuevo."
              : r?.mensaje || "No se pudo registrar.";
        setMensaje({ texto, ok: false });
        agregarReciente(`${etiqueta} · no registrada`, false);
      }
    } catch (err) {
      setMensaje({ texto: err.message || "No se pudo procesar el rostro.", ok: false });
    } finally {
      setProcesando(false);
    }
  }

  return (
    <ModalShell title="Marcar asistencia" onClose={onClose} width="34rem" height="auto">
      <div className="d-flex flex-wrap gap-2 mb-3 small">
        <span className="badge rounded-pill" style={listo ? { backgroundColor: "#d1fae5", color: "#047857" } : { backgroundColor: "#fef3c7", color: "#b45309" }}>
          {listo ? "Reconocimiento listo" : "Preparando reconocimiento..."}
        </span>
        <span className="badge rounded-pill" style={gps === "ok" ? { backgroundColor: "#d1fae5", color: "#047857" } : { backgroundColor: "#fef3c7", color: "#b45309" }}>
          {gps === "ok" ? "GPS" : gps === "buscando" ? "Buscando GPS..." : "Sin ubicación"}
        </span>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-7">
          <label className="form-label small fw-medium">Finca</label>
          <select className="form-select form-select-sm rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
            <option value="">Selecciona la finca</option>
            {fincas.map((f) => (
              <option key={f.uuid} value={f.uuid}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-5">
          <label className="form-label small fw-medium">Tipo</label>
          <div className="btn-group btn-group-sm w-100" role="group">
            {["ENTRADA", "SALIDA"].map((t) => (
              <button key={t} type="button" className={`btn ${tipo === t ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => setTipo(t)}>
                {t === "ENTRADA" ? "Entrada" : "Salida"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <VistaCamara videoRef={videoRef} listo={listo} errorCamara={errorCamara} />
      <div className="fw-medium mb-2">Mira de frente a la cámara</div>

      {errorCamara && <div className="alert alert-danger py-2 small">{errorCamara}</div>}
      {mensaje && <div className={`alert py-2 small ${mensaje.ok ? "alert-success" : "alert-danger"}`}>{mensaje.texto}</div>}

      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
          Cerrar
        </button>
        <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" disabled={!listo || !fincaUuid || procesando} onClick={marcar}>
          <FiCamera /> {procesando ? "Verificando..." : `Marcar ${etiqueta.toLowerCase()}`}
        </button>
      </div>
      {!fincaUuid && fincas.length > 0 && <p className="small text-secondary text-end mb-0 mt-2">Elige la finca para empezar.</p>}

      {recientes.length > 0 && (
        <div className="border-top mt-3 pt-2">
          <div className="small fw-medium mb-1">Últimas marcaciones</div>
          {recientes.map((r) => (
            <div key={r.id} className="small" style={{ color: r.ok ? undefined : "#dc2626" }}>
              {r.texto}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
