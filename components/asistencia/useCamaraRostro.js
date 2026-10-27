"use client";

import { useEffect, useRef, useState } from "react";
import { cargarMotorFacial } from "@/lib/faceDescriptor";

// Webcam + motor facial listos para capturar: carga los modelos, pide la cámara frontal y la apaga al desmontar.
export function useCamaraRostro() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [listo, setListo] = useState(false);
  const [errorCamara, setErrorCamara] = useState("");

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
        setErrorCamara(err?.name === "NotAllowedError" ? "No diste permiso para usar la cámara." : err.message || "No se pudo iniciar la cámara.");
      }
    })();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, listo, errorCamara };
}

// Vista de la cámara (espejada, como un espejo) con aviso mientras carga.
export function VistaCamara({ videoRef, listo, errorCamara }) {
  return (
    <div className="position-relative rounded-3 overflow-hidden bg-dark mb-3" style={{ aspectRatio: "4 / 3" }}>
      <video ref={videoRef} playsInline muted className="w-100 h-100" style={{ objectFit: "cover", transform: "scaleX(-1)" }} />
      {!listo && !errorCamara && <div className="position-absolute top-50 start-50 translate-middle text-white small">Cargando cámara y modelos...</div>}
    </div>
  );
}
