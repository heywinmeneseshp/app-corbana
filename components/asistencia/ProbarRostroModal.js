"use client";

import { useState } from "react";
import { FiCamera } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import { descriptorDeElemento } from "@/lib/faceDescriptor";
import { useCamaraRostro, VistaCamara } from "./useCamaraRostro";

const ETIQUETA = {
  VERIFICADA: { texto: "Reconocido", color: "#047857" },
  NO_RECONOCIDA: { texto: "No reconocido", color: "#dc2626" },
  AMBIGUA: { texto: "Ambiguo (parecido a otra persona)", color: "#b45309" },
  SIN_ENROLADOS: { texto: "No hay colaboradores con rostro registrado", color: "#b45309" },
};

// Prueba de reconocimiento (igual que en la app de campo): identifica el rostro y muestra las distancias al mejor y al
// segundo candidato, SIN guardar ninguna marcación. Sirve para medir qué tan bien reconoce a los trabajadores.
export default function ProbarRostroModal({ onClose }) {
  const { videoRef, listo, errorCamara } = useCamaraRostro();
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  async function probar() {
    if (!videoRef.current) return;
    setError("");
    setResultado(null);
    setProcesando(true);
    try {
      const { descriptor } = await descriptorDeElemento(videoRef.current);
      setResultado(await apiFetch("/asistencia/probar", { method: "POST", body: JSON.stringify({ descriptor }) }));
    } catch (err) {
      setError(err.message || "No se pudo hacer la prueba.");
    } finally {
      setProcesando(false);
    }
  }

  const etiqueta = resultado ? ETIQUETA[resultado.estado] : null;

  return (
    <ModalShell title="Prueba de reconocimiento" onClose={onClose} width="34rem" height="auto">
      <p className="small text-secondary mb-3">No guarda marcaciones. Úsala para medir qué tan bien reconoce a tus trabajadores.</p>
      <VistaCamara videoRef={videoRef} listo={listo} errorCamara={errorCamara} />
      <div className="fw-medium mb-2">Mira de frente a la cámara</div>

      {(errorCamara || error) && <div className="alert alert-danger py-2 small">{errorCamara || error}</div>}

      {resultado && etiqueta && (
        <div className="border rounded-3 p-3 mb-3 small">
          <div className="fw-bold fs-6 mb-1" style={{ color: etiqueta.color }}>
            {etiqueta.texto}
          </div>
          {resultado.mejor && (
            <div>
              1.º {resultado.mejor.nombre} · distancia <strong>{resultado.mejor.distancia.toFixed(3)}</strong>
            </div>
          )}
          {resultado.segundo && (
            <div>
              2.º {resultado.segundo.nombre} · distancia <strong>{resultado.segundo.distancia.toFixed(3)}</strong>
            </div>
          )}
          {resultado.umbral != null && (
            <div className="text-secondary mt-1">
              Umbral: {resultado.umbral}
              {resultado.margen ? ` · margen mínimo entre 1.º y 2.º: ${resultado.margen}` : ""}. Menor distancia = más parecido.
            </div>
          )}
        </div>
      )}

      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
          Cerrar
        </button>
        <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" disabled={!listo || procesando} onClick={probar}>
          <FiCamera /> {procesando ? "Probando..." : "Probar"}
        </button>
      </div>
    </ModalShell>
  );
}
