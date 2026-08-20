"use client";

import { FiSmartphone } from "react-icons/fi";
import RequireAdmin from "@/components/RequireAdmin";
import VersionAppForm from "@/components/configuracion/VersionAppForm";

export default function ConfiguracionVersionAppPage() {
  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiSmartphone className="text-primary" /> Versión de la App Móvil
          </h1>
          <p className="text-secondary mb-0">Controla el aviso de actualización que ven los usuarios al abrir la app.</p>
        </div>

        <VersionAppForm />
      </div>
    </RequireAdmin>
  );
}
