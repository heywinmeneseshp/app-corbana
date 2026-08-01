"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCalendar, FiChevronRight, FiAlertTriangle } from "react-icons/fi";
import { GiFarmTractor } from "react-icons/gi";
import { apiFetch } from "@/lib/api";

export default function LaboresCulturalesPage() {
  const router = useRouter();
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/labores-culturales/visitas?limit=100")
      .then((data) => setVisitas(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Evaluación de Labores</h1>
        <p className="text-secondary mb-0">Visitas de sanidad y labor cultural registradas desde la app móvil.</p>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-secondary">Cargando...</p>
      ) : visitas.length === 0 ? (
        <p className="text-secondary">Todavía no hay visitas registradas.</p>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="text-secondary small">
                  <th className="ps-4">Fecha</th>
                  <th>Finca</th>
                  <th>Semana</th>
                  <th>Lotes</th>
                  <th>Responsable</th>
                  <th>Hallazgos</th>
                  <th className="pe-4"></th>
                </tr>
              </thead>
              <tbody>
                {visitas.map((v) => (
                  <tr
                    key={v.visitaUuid}
                    role="button"
                    onClick={() => router.push(`/labores-culturales/${v.visitaUuid}`)}
                  >
                    <td className="ps-4">
                      <span className="d-flex align-items-center gap-2">
                        <FiCalendar className="text-secondary" size={14} />
                        {v.fecha}
                      </span>
                    </td>
                    <td>
                      <span className="d-flex align-items-center gap-2">
                        <GiFarmTractor className="text-secondary" size={15} />
                        {v.fincaNombre || "—"}
                      </span>
                    </td>
                    <td>{v.semanaCodigo || "—"}</td>
                    <td>{v.totalLotes}</td>
                    <td>{v.usuarioNombre || "—"}</td>
                    <td>
                      {(Number(v.mokoPresente) === 1 || Number(v.fusariumPresente) === 1) ? (
                        <span className="badge rounded-pill text-bg-danger d-inline-flex align-items-center gap-1">
                          <FiAlertTriangle size={11} />
                          {Number(v.mokoPresente) === 1 && "Moko"}
                          {Number(v.mokoPresente) === 1 && Number(v.fusariumPresente) === 1 && " / "}
                          {Number(v.fusariumPresente) === 1 && "Fusarium"}
                        </span>
                      ) : (
                        <span className="badge rounded-pill text-bg-light text-secondary">Sin hallazgos</span>
                      )}
                    </td>
                    <td className="pe-4 text-end">
                      <FiChevronRight className="text-secondary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
