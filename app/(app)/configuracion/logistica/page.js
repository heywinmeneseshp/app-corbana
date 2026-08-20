"use client";

import { FiShare2 } from "react-icons/fi";
import RequireAdmin from "@/components/RequireAdmin";
import ConexionLogisticaForm from "@/components/configuracion/ConexionLogisticaForm";

export default function ConfiguracionLogisticaPage() {
  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiShare2 className="text-primary" /> Conexión con Logística
          </h1>
          <p className="text-secondary mb-0">Enlace y credenciales del API de api-rest-banarica.</p>
        </div>

        <ConexionLogisticaForm />
      </div>
    </RequireAdmin>
  );
}
