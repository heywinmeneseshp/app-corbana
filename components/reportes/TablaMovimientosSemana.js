"use client";

import { Fragment, useState } from "react";
import { FiPlusCircle, FiMinusCircle, FiXCircle, FiCheckCircle, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

export const FILAS_CONCEPTO = [
  { key: "totalEmbolsado", label: "Embolsado", sign: 1, color: "#16a34a", excelFill: "FFD1FAE5", Icon: FiPlusCircle },
  { key: "totalRepicado", label: "Repicado", sign: -1, color: "#dc2626", excelFill: "FFFEE2E2", Icon: FiMinusCircle },
  { key: "totalRecusado", label: "Recusado", sign: -1, color: "#ea580c", excelFill: "FFFFEDD5", Icon: FiXCircle },
  { key: "totalProcesado", label: "Procesado", sign: -1, color: "#2563eb", excelFill: "FFDBEAFE", Icon: FiCheckCircle },
];

// Tabla de Saldo y Movimientos de una semana de registro: columnas = cintas (edad 1 a N), filas = saldo inicial, cada tipo de movimiento
// y saldo final, con el desglose por lote al expandir. Datos de GET /racimo-movimientos/reporte-movimientos-semana. La usan Reportes →
// Saldo y Movimientos y el Resumen semanal.
// `expandidos`: filas que arrancan desplegadas por lote (p. ej. ["saldoFinal"]).
export default function TablaMovimientosSemana({ data, verPorcentajes = false, expandidos = [] }) {
  const [conceptosExpandidos, setConceptosExpandidos] = useState(() => new Set(expandidos));

  const totAncho = 120 + (data?.cohortes?.length || 0) * 68;

  function valorClase(valor) {
    if (valor > 0) return "text-success fw-medium";
    if (valor < 0) return "text-danger fw-medium";
    return "";
  }

  function movimientoClase(valor) {
    return valor < 0 ? "text-danger fw-medium" : "fw-medium";
  }

  function toggleConcepto(key) {
    setConceptosExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function formato(valor, totalEmbolsadoCohorte) {
    if (verPorcentajes) {
      if (!totalEmbolsadoCohorte) return "—";
      const num = Number(valor);
      if (num === 0) return "—";
      return `${((num / totalEmbolsadoCohorte) * 100).toFixed(1)}%`;
    }
    const num = Number(valor);
    if (num === 0) return "—";
    return num.toLocaleString("es");
  }

  return (
    <>
    <div className="card border-0 shadow-sm rounded-4 p-0 overflow-auto">
      <div style={{ minWidth: totAncho + "px" }}>
        <table className="table table-bordered mb-0 align-middle" style={{ fontSize: "0.8125rem" }}>
          <thead>
            <tr>
              <th
                className="sticky-col bg-white text-secondary small fw-semibold"
                style={{ minWidth: "120px", left: 0, zIndex: 3 }}
              >
                Concepto / Lote
              </th>
              {data.cohortes.map((col) => {
                const bg = COLOR_HEX[col.color] || "#94a3b8";
                const fg = COLOR_TEXT[col.color] || "#111827";
                return (
                  <th
                    key={col.semanaUuid}
                    className="text-center"
                    style={{ minWidth: "68px", backgroundColor: bg, color: fg }}
                  >
                    <div className="fw-bold" style={{ fontSize: "0.7rem" }}>
                      {col.color?.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "0.75rem" }}>{col.semanaCodigo}</div>
                    <div className="small" style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                      Edad {col.edadSemanas}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const puedeExpandir = data.lotes.length > 0;
              const expandido = puedeExpandir && conceptosExpandidos.has("saldoInicial");
              const lotesConDato = expandido
                ? data.lotes.filter((lote) => data.cohortes.some((col) => (lote.saldoInicial[col.semanaUuid] || 0) !== 0))
                : [];
              return (
                <Fragment key="saldoInicial">
                  <tr style={{ borderBottom: "2px solid #94a3b8" }}>
                    <td className="sticky-col fw-bold bg-white" style={{ left: 0, zIndex: 2 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 d-flex align-items-center gap-2 fw-bold text-decoration-none text-dark"
                        onClick={() => puedeExpandir && toggleConcepto("saldoInicial")}
                        disabled={!puedeExpandir}
                        title={puedeExpandir ? "Ver por lote" : "Elegí una finca para ver el detalle por lote"}
                      >
                        {puedeExpandir ? expandido ? <FiChevronDown size={13} /> : <FiChevronRight size={13} /> : null}
                        Saldo Inicial
                      </button>
                    </td>
                    {data.cohortes.map((col) => (
                      <td key={col.semanaUuid} className={`text-center fw-bold ${movimientoClase(col.saldoInicial)}`}>
                        {formato(col.saldoInicial, col.totalEmbolsado)}
                      </td>
                    ))}
                  </tr>
                  {expandido && lotesConDato.length === 0 && (
                    <tr>
                      <td
                        className="sticky-col text-secondary small fst-italic"
                        style={{ left: 0, zIndex: 2, backgroundColor: "#fff" }}
                      >
                        Ningún lote tenía saldo inicial en las cohortes visibles.
                      </td>
                      <td colSpan={data.cohortes.length} style={{ backgroundColor: "#fff" }} />
                    </tr>
                  )}
                  {expandido &&
                    lotesConDato.map((lote) => (
                      <tr key={`saldoInicial-${lote.uuid}`}>
                        <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2, paddingLeft: "1.75rem" }}>
                          <span className="text-secondary small">{lote.codigo}</span>
                          <span className="text-muted small ms-1">— {lote.nombre}</span>
                        </td>
                        {data.cohortes.map((col) => {
                          const val = lote.saldoInicial[col.semanaUuid] || 0;
                          return (
                            <td key={col.semanaUuid} className={`text-center ${val ? movimientoClase(val) : "text-secondary"}`}>
                              {formato(val, col.totalEmbolsado)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              );
            })()}

            {FILAS_CONCEPTO.map((fila) => {
              const puedeExpandir = data.lotes.length > 0;
              const expandido = puedeExpandir && conceptosExpandidos.has(fila.key);
              // Solo lotes que tuvieron algo de este concepto en al
              // menos una de las cohortes visibles — no tiene sentido
              // listar lotes en cero en las 14 columnas.
              const lotesConDato = expandido
                ? data.lotes.filter((lote) => data.cohortes.some((col) => (lote.porConcepto[fila.key][col.semanaUuid] || 0) !== 0))
                : [];
              return (
                <Fragment key={fila.key}>
                  <tr style={{ backgroundColor: "#eef2f6" }}>
                    <td className="sticky-col" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 d-flex align-items-center gap-2 fw-semibold text-decoration-none"
                        style={{ color: fila.color }}
                        onClick={() => puedeExpandir && toggleConcepto(fila.key)}
                        disabled={!puedeExpandir}
                        title={puedeExpandir ? "Ver por lote" : "Elegí una finca para ver el detalle por lote"}
                      >
                        {puedeExpandir ? expandido ? <FiChevronDown size={13} /> : <FiChevronRight size={13} /> : null}
                        <fila.Icon /> {fila.label}
                      </button>
                    </td>
                    {data.cohortes.map((col) => {
                      const val = fila.sign * col[fila.key];
                      return (
                        <td
                          key={col.semanaUuid}
                          className={`text-center ${valorClase(val)}`}
                          style={{ backgroundColor: "#eef2f6" }}
                        >
                          {formato(val, col.totalEmbolsado)}
                        </td>
                      );
                    })}
                  </tr>
                  {expandido && lotesConDato.length === 0 && (
                    <tr>
                      <td
                        className="sticky-col text-secondary small fst-italic"
                        style={{ left: 0, zIndex: 2, backgroundColor: "#fff" }}
                      >
                        Ningún lote tuvo {fila.label.toLowerCase()} en las cohortes visibles.
                      </td>
                      <td colSpan={data.cohortes.length} style={{ backgroundColor: "#fff" }} />
                    </tr>
                  )}
                  {expandido &&
                    lotesConDato.map((lote) => (
                      <tr key={`${fila.key}-${lote.uuid}`}>
                        <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2, paddingLeft: "1.75rem" }}>
                          <span className="text-secondary small">{lote.codigo}</span>
                          <span className="text-muted small ms-1">— {lote.nombre}</span>
                        </td>
                        {data.cohortes.map((col) => {
                          const val = fila.sign * (lote.porConcepto[fila.key][col.semanaUuid] || 0);
                          return (
                            <td key={col.semanaUuid} className={`text-center ${val ? "fw-medium" : "text-secondary"}`}>
                              {formato(val, col.totalEmbolsado)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              );
            })}


            {(() => {
              const puedeExpandir = data.lotes.length > 0;
              const expandido = puedeExpandir && conceptosExpandidos.has("saldoFinal");
              const lotesConDato = expandido
                ? data.lotes.filter((lote) => data.cohortes.some((col) => (lote.saldoFinal[col.semanaUuid] || 0) !== 0))
                : [];
              return (
                <Fragment key="saldoFinal">
                  <tr style={{ borderTop: "2px solid #94a3b8" }}>
                    <td className="sticky-col fw-bold bg-white" style={{ left: 0, zIndex: 2 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 d-flex align-items-center gap-2 fw-bold text-decoration-none text-dark"
                        onClick={() => puedeExpandir && toggleConcepto("saldoFinal")}
                        disabled={!puedeExpandir}
                        title={puedeExpandir ? "Ver por lote" : "Elegí una finca para ver el detalle por lote"}
                      >
                        {puedeExpandir ? expandido ? <FiChevronDown size={13} /> : <FiChevronRight size={13} /> : null}
                        Saldo Final
                      </button>
                    </td>
                    {data.cohortes.map((col) => (
                      <td key={col.semanaUuid} className={`text-center fw-bold ${movimientoClase(col.saldoFinal)}`}>
                        {formato(col.saldoFinal, col.totalEmbolsado)}
                      </td>
                    ))}
                  </tr>
                  {expandido && lotesConDato.length === 0 && (
                    <tr>
                      <td
                        className="sticky-col text-secondary small fst-italic"
                        style={{ left: 0, zIndex: 2, backgroundColor: "#fff" }}
                      >
                        Ningún lote tenía saldo final en las cohortes visibles.
                      </td>
                      <td colSpan={data.cohortes.length} style={{ backgroundColor: "#fff" }} />
                    </tr>
                  )}
                  {expandido &&
                    lotesConDato.map((lote) => (
                      <tr key={`saldoFinal-${lote.uuid}`}>
                        <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2, paddingLeft: "1.75rem" }}>
                          <span className="text-secondary small">{lote.codigo}</span>
                          <span className="text-muted small ms-1">— {lote.nombre}</span>
                        </td>
                        {data.cohortes.map((col) => {
                          const val = lote.saldoFinal[col.semanaUuid] || 0;
                          return (
                            <td key={col.semanaUuid} className={`text-center ${val ? movimientoClase(val) : "text-secondary"}`}>
                              {formato(val, col.totalEmbolsado)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
    <style jsx>{`
      .sticky-col {
        position: sticky;
        left: 0;
        z-index: 2;
      }
      .table th,
      .table td {
        white-space: nowrap;
        vertical-align: middle;
        padding: 0.25rem 0.3rem;
      }
      .table tbody th,
      .table tbody td {
        padding-top: 0.2rem;
        padding-bottom: 0.2rem;
      }
      .table-bordered th,
      .table-bordered td {
        border: 1px solid #e2e8f0;
      }
      .spin {
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
    </>
  );
}
