"use client";

import { useEffect, useState } from "react";
import { hasPermission, hasAnyPermission } from "@/lib/auth";

/**
 * Bloquea el contenido de una página si el usuario no tiene el/los
 * permiso(s) requeridos — para que no baste con ocultar el link del menú,
 * también se bloquea si alguien entra directo por la URL.
 */
export default function RequirePermission({ code, anyOf, children }) {
  const [allowed, setAllowed] = useState(null); // null = todavía no se sabe (cliente)

  useEffect(() => {
    setAllowed(anyOf ? hasAnyPermission(anyOf) : hasPermission(code));
  }, [code, anyOf]);

  if (allowed === null) return null;

  if (!allowed) {
    return (
      <div className="p-4 p-md-5">
        <div className="alert alert-warning">No tienes permiso para acceder a esta sección.</div>
      </div>
    );
  }

  return children;
}
