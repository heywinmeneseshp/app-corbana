"use client";

import { FiPlus } from "react-icons/fi";
import { formatRangoSemana, celdaKey } from "@/lib/laborCalendarBuilder";
import LaborItem from "@/components/calendario-labores/LaborItem";

// Vista Por lote: una fila por semana real del negocio (mismo maestro
// `Semana` que el resto del módulo), con su código (S01-2026...) y rango de
// fechas en la primera columna — así siempre se ve a qué semana corresponde
// cada franja, cosa que la vista de calendario genérico (react-big-calendar)
// no podía mostrar.
export default function VistaPorLote({ semanas, loteUuid, mapaCeldas, puedeCrear, onEmptyClick, onLaborClick }) {
  if (semanas.length === 0) return null;

  return (
    <div className="border rounded-4 overflow-hidden bg-white">
      <div className="table-responsive">
        <table className="table mb-0 align-middle">
          <thead>
            <tr>
              <th className="text-secondary fw-medium small border-bottom py-2" style={{ minWidth: 160 }}>
                Semana
              </th>
              <th className="text-secondary fw-medium small border-bottom py-2">Labores</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((semana) => {
              const ocurrencias = mapaCeldas.get(celdaKey(semana.uuid, loteUuid)) || [];
              const vacia = ocurrencias.length === 0;
              return (
                <tr key={semana.uuid}>
                  <td className="border-bottom py-2">
                    <div className="fw-medium small">{semana.codigo}</div>
                    <div className="text-secondary" style={{ fontSize: "0.7rem" }}>
                      {formatRangoSemana(semana.fechaInicio, semana.fechaFin)}
                    </div>
                  </td>
                  <td
                    className="border-bottom py-2"
                    style={{ cursor: vacia && puedeCrear ? "pointer" : "default" }}
                    onClick={() => vacia && puedeCrear && onEmptyClick(semana)}
                  >
                    <div className="d-flex flex-wrap gap-2">
                      {ocurrencias.map((oc) => (
                        <LaborItem key={oc.uuid} ocurrencia={oc} onClick={onLaborClick} />
                      ))}
                      {vacia && puedeCrear && (
                        <span className="text-secondary d-flex align-items-center">
                          <FiPlus size={14} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
