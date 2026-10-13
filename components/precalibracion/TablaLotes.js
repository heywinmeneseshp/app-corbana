"use client";

import { Fragment } from "react";
import { FiMap } from "react-icons/fi";

// Tabla consolidada por lote, con el mismo diseño de
// racimos/saldos-lotes-cintas: tabla bordered densa, primera columna
// sticky, encabezados de cinta con fondo de color y fila TOTAL sombreada.
// Cada cinta se abre en 3 sub-columnas: Saldo actual del lote, Aptos
// (cumplen calibración). Las cintas son dinámicas.
// Clic en la fila abre el detalle del lote.
function textoSobre(fondoHex) {
  const h = fondoHex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#111827" : "#ffffff";
}

const SUBCOLUMNAS = ["Saldo", "Aptos"];

// `porFinca`: con la finca en "Todas" no se discrimina por lote, cada fila es una finca (sin detalle ni mapa).
export default function TablaLotes({ filas, totales, cintas, porFinca = false, onVerLote, onVerRuta }) {
  const columnas = 6 + cintas.length * 2;

  function formato(valor, totalColumna) {
    return Number(valor).toLocaleString("es");
  }

  // Ancho por concepto (ch): el mínimo que exige la sub-columna con más
  // contenido entre las 4 cintas (más la columna de totales). Todas las
  // sub-columnas del mismo concepto quedan uniformes y ajustadas.
  const anchos = (() => {
    const max = { saldo: "Saldo".length, aptos: "Aptos".length };
    const medir = (concepto, valor, total) => {
      max[concepto] = Math.max(max[concepto], formato(valor, total).length);
    };
    for (const f of filas) {
      for (const c of cintas) {
        medir("saldo", f.saldos[c.id] || 0, totales.saldoPorCinta[c.id]);
        medir("aptos", f.porCinta[c.id] || 0, totales.porCinta[c.id]);
      }
      medir("saldo", f.totalSaldo, totales.totalSaldo);
      medir("aptos", f.total, totales.total);
    }
    for (const c of cintas) {
      medir("saldo", totales.saldoPorCinta[c.id] || 0, totales.saldoPorCinta[c.id]);
      medir("aptos", totales.porCinta[c.id] || 0, totales.porCinta[c.id]);
    }
    medir("saldo", totales.totalSaldo, totales.totalSaldo);
    medir("aptos", totales.total, totales.total);
    return { saldo: max.saldo + 1, aptos: max.aptos + 1 };
  })();

  // Ancho mínimo del contenedor para el scroll horizontal (estimado).
  const PX_POR_CH = 7;
  const totAncho =
    130 +
    60 +
    64 +
    52 +
    (anchos.saldo + anchos.aptos) * (cintas.length + 1) * PX_POR_CH;

  // Racimos aptos por hectárea (ya es un ratio: no aplica el modo %).
  function racimosPorHa(total, hectareas) {
    if (!hectareas) return "—";
    return (total / hectareas).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="p-2 pb-1 d-flex flex-wrap align-items-start justify-content-between gap-2">
        <div>
          <h2 className="h5 fw-bold mb-0">Resultados por lote</h2>
          <p className="small text-secondary mb-1">
            Cada cinta se abre en 2 columnas: <span className="text-secondary">saldo</span> actual del lote y{" "}
            <span className="fw-medium text-dark">aptos</span> que cumplen calibración. Haz clic en un lote para ver el detalle.
          </p>
        </div>
      </div>
      <div className="p-0 overflow-auto">
        <div style={{ minWidth: `${totAncho}px` }}>
          <table
            className="table table-sm table-bordered mb-0 align-middle"
            style={{ fontSize: "0.72rem", lineHeight: 1.15, "--bs-table-cell-padding-y": "0.05rem", "--bs-table-cell-padding-x": "0.25rem" }}
          >
            <colgroup>
              <col style={{ width: 130 }} />
              <col style={{ width: 60 }} />
              {cintas.map((c) => (
                <Fragment key={c.id}>
                  <col style={{ width: `${anchos.saldo}ch` }} />
                  <col style={{ width: `${anchos.aptos}ch` }} />
                </Fragment>
              ))}
              <col style={{ width: `${anchos.saldo}ch` }} />
              <col style={{ width: `${anchos.aptos}ch` }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 52 }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="sticky-col bg-white text-secondary small fw-semibold align-middle"
                  style={{ minWidth: "130px", left: 0, zIndex: 3 }}
                >
                  {porFinca ? "Finca" : "Lote"}
                </th>
                <th
                  rowSpan={2}
                  className="text-center text-secondary small fw-semibold align-middle"
                  style={{ minWidth: "60px" }}
                >
                  Has
                </th>
                {cintas.map((c) => (
                  <th
                    key={c.id}
                    colSpan={2}
                    className="text-center"
                    style={{ backgroundColor: c.color, color: textoSobre(c.color) }}
                  >
                    <div className="fw-bold" style={{ fontSize: "0.65rem" }}>
                      {c.colorNombre?.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "0.7rem" }} title="Semana de embolse de esta cinta">
                      {c.embolseCodigo || `S${c.embolse}`}
                    </div>
                    <div className="small" style={{ fontSize: "0.65rem", opacity: 0.85 }}>
                      Edad {c.edad}
                    </div>
                  </th>
                ))}
                <th colSpan={2} className="text-center text-secondary small fw-semibold">
                  <div className="fw-bold" style={{ fontSize: "0.65rem" }}>
                    APTOS
                  </div>
                  <div style={{ fontSize: "0.7rem" }}>cosecha</div>
                </th>
                <th
                  rowSpan={2}
                  className="text-center text-secondary small fw-semibold align-middle"
                  style={{ minWidth: "64px" }}
                  title="Racimos aptos por hectárea (aptos ÷ hectáreas)"
                >
                  <div className="fw-bold" style={{ fontSize: "0.65rem" }}>
                    RACIMOS
                  </div>
                  <div style={{ fontSize: "0.7rem" }}>por ha</div>
                </th>
                <th
                  rowSpan={2}
                  className="text-center text-secondary small fw-semibold align-middle"
                  style={{ minWidth: "52px" }}
                >
                  Ruta
                </th>
              </tr>
              <tr>
                {cintas.map((c) => (
                  <SUBENC key={c.id} color={c.color} />
                ))}
                <SUBENC color={null} />
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr>
                  <td colSpan={columnas} className="text-center text-secondary py-4">
                    No hay registros para estos filtros.
                  </td>
                </tr>
              )}
              {filas.map((f) => (
                <tr
                  key={f.loteId || f.fincaId}
                  className={porFinca ? "" : "fila-lote"}
                  onClick={porFinca ? undefined : () => onVerLote(f.loteId)}
                  style={porFinca ? undefined : { cursor: "pointer" }}
                  title={porFinca ? undefined : "Ver detalle del lote"}
                >
                  <td className="sticky-col bg-white" style={{ left: 0, zIndex: 2 }}>
                    {porFinca ? (
                      <span className="fw-semibold">{f.fincaNombre}</span>
                    ) : (
                      <>
                        <span className="fw-semibold">Lote {f.loteNombre}</span>
                        <span className="text-muted small ms-1">— {f.fincaNombre}</span>
                      </>
                    )}
                  </td>
                  <td className="text-center">{f.areaHa.toLocaleString("es", { minimumFractionDigits: 2 })}</td>
                  {cintas.map((c) => (
                    <CeldaLote
                      key={c.id}
                      aptos={f.porCinta[c.id] || 0}
                      saldo={f.saldos[c.id] || 0}
                      totalAptos={totales.porCinta[c.id]}
                      totalSaldo={totales.saldoPorCinta[c.id]}
                      formato={formato}
                      negrita={false}
                      fondo={null}
                    />
                  ))}
                  <CeldaLote
                    aptos={f.total}
                    saldo={f.totalSaldo}
                    totalAptos={totales.total}
                    totalSaldo={totales.totalSaldo}
                    formato={formato}
                    negrita
                    fondo={null}
                  />
                  <td className="text-center fw-bold">{racimosPorHa(f.total, f.areaHa)}</td>
                  <td className="text-center">
                    {!porFinca && (
                    <button
                      type="button"
                      className="btn btn-sm p-0 border-0 text-success"
                      title="Ver recorrido en el mapa"
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerRuta(f.loteId);
                      }}
                    >
                      <FiMap size={14} />
                    </button>
                    )}
                  </td>
                </tr>
              ))}
              {filas.length > 0 && (
                <tr style={{ borderTop: "2px solid #94a3b8", backgroundColor: "#eef2f6" }}>
                  <td className="sticky-col fw-bold" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                    Aptos cosecha
                  </td>
                  <td className="text-center fw-bold" style={{ backgroundColor: "#eef2f6" }}>
                    {totales.hectareas.toLocaleString("es", { minimumFractionDigits: 2 })}
                  </td>
                  {cintas.map((c) => (
                    <CeldaLote
                      key={c.id}
                      aptos={totales.porCinta[c.id] || 0}
                      saldo={totales.saldoPorCinta[c.id] || 0}
                      totalAptos={totales.porCinta[c.id]}
                      totalSaldo={totales.saldoPorCinta[c.id]}
                      formato={formato}
                      negrita
                      fondo="#eef2f6"
                    />
                  ))}
                  <CeldaLote
                    aptos={totales.total}
                    saldo={totales.totalSaldo}
                    totalAptos={totales.total}
                    totalSaldo={totales.totalSaldo}
                    formato={formato}
                    negrita
                    fondo="#eef2f6"
                  />
                  <td className="text-center fw-bold" style={{ backgroundColor: "#eef2f6" }}>
                    {racimosPorHa(totales.total, totales.hectareas)}
                  </td>
                  <td style={{ backgroundColor: "#eef2f6" }} />
                </tr>
              )}
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
          padding: 0.15rem 0.25rem;
        }
        .table tbody th,
        .table tbody td {
          padding-top: 0.05rem;
          padding-bottom: 0.05rem;
          height: 1.35rem;
        }
        .table-bordered th,
        .table-bordered td {
          border: 1px solid #e2e8f0;
        }
        .table tbody tr.fila-lote:hover td {
          background-color: rgba(22, 163, 74, 0.06);
        }
        .table tbody tr.fila-lote:hover td.sticky-col {
          background-color: #f0fdf4;
        }
      `}</style>
    </div>
  );
}

// Sub-encabezados Saldo/Aptos de cada grupo. Tinte suave del color
// del grupo para atar visualmente las 3 columnas a su cinta.
function SUBENC({ color }) {
  return (
    <>
      {SUBCOLUMNAS.map((s) => (
        <th
          key={s}
          className="text-center text-secondary fw-semibold"
          style={{ fontSize: "0.65rem", backgroundColor: color ? `${color}1A` : "#f1f5f9" }}
        >
          {s}
        </th>
      ))}
    </>
  );
}

// Las 2 celdas de un grupo (saldo/aptos) para una fila.
function CeldaLote({ aptos, saldo, totalAptos, totalSaldo, formato, negrita, fondo }) {
  const peso = negrita ? "fw-bold" : "";
  const estilo = fondo ? { backgroundColor: fondo } : undefined;
  return (
    <>
      <td className={`text-center text-secondary ${peso}`} style={estilo}>
        {formato(saldo, totalSaldo)}
      </td>
      <td
        className="text-center fw-bold text-success"
        style={fondo ? estilo : { backgroundColor: "#f0fdf4" }}
      >
        {formato(aptos, totalAptos)}
      </td>
    </>
  );
}
