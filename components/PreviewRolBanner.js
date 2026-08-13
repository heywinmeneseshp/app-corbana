"use client";

import { useEffect, useState } from "react";
import { FiEye, FiX } from "react-icons/fi";
import { getPreviewRol, stopPreviewRol } from "@/lib/auth";

// Banner fijo que avisa cuando el admin está en modo "Ver como rol" (ver
// lib/auth.js) — sin esto sería fácil olvidarse de que el menú que se está
// viendo no es el propio, y confundirlo con un problema real de permisos.
export default function PreviewRolBanner() {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    setPreview(getPreviewRol());
  }, []);

  if (!preview) return null;

  const salir = () => {
    stopPreviewRol();
    window.location.assign("/");
  };

  return (
    <div
      className="d-flex align-items-center justify-content-between gap-3 px-4 py-2 text-white small"
      style={{ backgroundColor: "var(--brand-800)" }}
    >
      <span className="d-flex align-items-center gap-2">
        <FiEye /> Viendo como: <strong>{preview.rolNombre}</strong> — esto solo simula el menú y el acceso a
        pantallas; las acciones que hagas se siguen registrando con tu usuario real.
      </span>
      <button
        type="button"
        className="btn btn-sm btn-light rounded-3 d-flex align-items-center gap-1 text-nowrap"
        onClick={salir}
      >
        <FiX /> Salir de vista previa
      </button>
    </div>
  );
}
