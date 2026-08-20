"use client";

import { FiDatabase } from "react-icons/fi";
import RequireAdmin from "@/components/RequireAdmin";
import BackupDatabaseForm from "@/components/configuracion/BackupDatabaseForm";

export default function ConfiguracionBackupPage() {
  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiDatabase className="text-primary" /> Base de Datos
          </h1>
          <p className="text-secondary mb-0">Exportar o restaurar un backup completo de la base de datos.</p>
        </div>

        <BackupDatabaseForm />
      </div>
    </RequireAdmin>
  );
}
