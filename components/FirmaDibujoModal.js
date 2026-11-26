"use client";

import { useEffect, useRef, useState } from "react";
import ModalShell from "@/components/ModalShell";

// Ventana para dibujar la firma (mouse o dedo). Devuelve un PNG (data URL) con fondo transparente.
// `onGuardar(dataUrl)`, `onCancelar()`.
export default function FirmaDibujoModal({ titulo = "Tu firma", texto, onGuardar, onCancelar, guardando = false }) {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const c = canvasRef.current;
    const r = window.devicePixelRatio || 1;
    c.width = c.clientWidth * r;
    c.height = c.clientHeight * r;
    const ctx = c.getContext("2d");
    ctx.scale(r, r);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const punto = (e) => {
    const b = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const iniciar = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    setHayTrazo(true);
  };
  const mover = (e) => {
    if (!dibujando.current) return;
    e.preventDefault();
    const { x, y } = punto(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const terminar = () => {
    dibujando.current = false;
  };
  const limpiar = () => {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
    setError("");
  };
  const guardar = () => {
    if (!hayTrazo) return setError("Dibuja tu firma antes de guardar.");
    onGuardar(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <ModalShell title={titulo} onClose={onCancelar}>
      {texto && <p className="small text-secondary">{texto}</p>}
      <div className="border rounded-3 position-relative" style={{ height: 200, background: "#fff" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", touchAction: "none", cursor: "crosshair", display: "block" }}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
        />
        <div className="position-absolute border-bottom" style={{ left: 24, right: 24, bottom: 40, pointerEvents: "none" }} />
      </div>
      {error && <div className="text-danger small mt-2">{error}</div>}
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={limpiar} disabled={guardando}>
          Limpiar
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar firma"}
        </button>
      </div>
    </ModalShell>
  );
}
