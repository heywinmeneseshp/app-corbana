"use client";

import { FiImage } from "react-icons/fi";
import RequireAdmin from "@/components/RequireAdmin";
import MarcaForm from "@/components/configuracion/MarcaForm";

export default function ConfiguracionMarcaPage() {
  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiImage className="text-primary" /> Marca de la App
          </h1>
          <p className="text-secondary mb-0">Personaliza el nombre y el logo que se muestran en toda la aplicación.</p>
        </div>

        <MarcaForm />
      </div>
    </RequireAdmin>
  );
}
