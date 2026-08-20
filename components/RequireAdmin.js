"use client";

import { useEffect, useState } from "react";
import { esAdministrador } from "@/lib/laborEstados";

// Igual que RequirePermission, pero para pantallas reservadas al rol
// Administrador sin que exista (ni deba existir) un permiso granular
// asignable a otros roles — ej. Configuración del sistema (credenciales de
// integraciones). El backend vuelve a exigirlo (requireAdmin.middleware.js).
export default function RequireAdmin({ children }) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    setAllowed(esAdministrador());
  }, []);

  if (allowed === null) return null;

  if (!allowed) {
    return (
      <div className="p-4 p-md-5">
        <div className="alert alert-warning">Solo un usuario con rol de Administrador puede acceder a esta sección.</div>
      </div>
    );
  }

  return children;
}
