"use client";

import { useEffect, useState } from "react";
import { FiEye, FiX } from "react-icons/fi";
import { getPreviewRol, stopPreviewRol, isImpersonating, getImpersonationOriginal, stopImpersonation, getCurrentUser } from "@/lib/auth";

// Banner fijo que avisa cuando el admin está en modo "Ver como rol"
// (simulación de frontend) o suplantando de verdad a un usuario (ver
// lib/auth.js) — sin esto sería fácil olvidarse de que lo que se está
// viendo no es la sesión propia. Se calcula por fuera de RequirePermission
// a propósito: tiene que seguir visible/funcionando aunque la suplantación
// haya dejado a la sesión actual sin acceso a la pantalla donde está parado
// (es el único botón para volver a la sesión real desde ahí).
export default function PreviewRolBanner() {
  const [previewRol, setPreviewRol] = useState(null);
  const [impersonando, setImpersonando] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);

  useEffect(() => {
    setPreviewRol(getPreviewRol());
    setImpersonando(isImpersonating());
    setUsuarioActual(getCurrentUser());
  }, []);

  if (!previewRol && !impersonando) return null;

  const salir = () => {
    if (impersonando) {
      stopImpersonation();
      window.location.assign("/maestros/usuarios");
    } else {
      stopPreviewRol();
      window.location.assign("/maestros/roles");
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-between gap-3 px-4 py-2 text-white small"
      // position + z-index explícitos: sin esto, este banner (estático, sin
      // stacking context propio) queda TAPADO por cualquier modal fixed que
      // se abra después en el DOM (ej. PrecipitacionDiariaModal/AreaLoteModal,
      // z-index 2000, o ModalShell, 1050) aunque el banner esté primero en
      // la pantalla — necesita quedar arriba de TODOS para poder salir de
      // la vista previa/suplantación sin importar qué modal esté abierto.
      style={{ backgroundColor: "var(--brand-800)", position: "relative", zIndex: 2100 }}
    >
      <span className="d-flex align-items-center gap-2">
        <FiEye />{" "}
        {impersonando ? (
          <>
            Viendo como: <strong>{usuarioActual?.nombre} {usuarioActual?.apellido}</strong> (@{usuarioActual?.usuario}) —
            ves y podés hacer exactamente lo mismo que ella (selectores, listados, todo filtrado como lo vería esa
            persona), pero cualquier acción que hagas queda registrada a tu nombre de administrador, no al de ella.
          </>
        ) : (
          <>
            Viendo como rol: <strong>{previewRol.rolNombre}</strong> — esto solo simula el menú y el acceso a
            pantallas; las acciones que hagas se siguen registrando con tu usuario real.
          </>
        )}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-light rounded-3 d-flex align-items-center gap-1 text-nowrap flex-shrink-0"
        onClick={salir}
      >
        <FiX /> Salir de vista previa
      </button>
    </div>
  );
}
