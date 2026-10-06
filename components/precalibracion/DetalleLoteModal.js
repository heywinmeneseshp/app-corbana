"use client";

import ModalShell from "@/components/ModalShell";
import { CINTA_POR_ID, USUARIO_POR_ID } from "@/lib/precalibracion/mockData";

function formatoFecha(fechaIso) {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Detalle de un lote: información, resultados por cinta/edad y registros
// individuales (trazabilidad: fecha, hora, cinta, edad, usuario, GPS).
export default function DetalleLoteModal({ detalle, onClose }) {
  if (!detalle) return null;
  const { lote, finca, valor, resultados, total, totalSaldo, totalRestante, registros } = detalle;

  return (
    <ModalShell title={`Lote ${lote.nombre}`} onClose={onClose} size="lg">
      <div className="row g-2 mb-3 small">
        <div className="col-6 col-md-3">
          <div className="text-secondary">Finca</div>
          <div className="fw-medium">{finca ? finca.nombre : "—"}</div>
        </div>
        <div className="col-6 col-md-3">
          <div className="text-secondary">Área</div>
          <div className="fw-medium">{lote.areaHa.toLocaleString("es", { minimumFractionDigits: 2 })} ha</div>
        </div>
        <div className="col-6 col-md-3">
          <div className="text-secondary">Valor de precalibración</div>
          <div className="fw-medium">{valor ? valor.nombre : "—"}</div>
        </div>
        <div className="col-6 col-md-3">
          <div className="text-secondary">Racimos</div>
          <div className="fw-medium">{total.toLocaleString("es")}</div>
        </div>
      </div>

      <h3 className="h6 fw-bold">Resultados</h3>
      <div className="table-responsive mb-3">
        <table className="table table-sm table-hover mb-0 align-middle small">
          <thead className="table-light">
            <tr>
              <th>Cinta / Edad</th>
              <th className="text-end">Saldo</th>
              <th className="text-end">Aptos</th>
              <th className="text-end">Resto</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.cintaId}>
                <td>
                  <span className="d-inline-block rounded-circle me-1" style={{ width: 10, height: 10, backgroundColor: r.color }} />
                  {r.cinta} <span className="text-secondary small">({r.embolse})</span> / Edad {r.edad}
                </td>
                <td className="text-end">{r.saldo.toLocaleString("es")}</td>
                <td className="text-end fw-medium text-success" style={{ backgroundColor: "#f0fdf4" }}>{r.racimos.toLocaleString("es")}</td>
                <td className={`text-end ${r.restante < 0 ? "text-danger" : "text-warning-emphasis"}`} style={{ backgroundColor: "#fffbeb" }}>
                  {r.restante.toLocaleString("es")}
                </td>
              </tr>
            ))}
            <tr className="table-light fw-bold">
              <td>TOTAL</td>
              <td className="text-end">{(totalSaldo || 0).toLocaleString("es")}</td>
              <td className="text-end">{total.toLocaleString("es")}</td>
              <td className="text-end">{(totalRestante || 0).toLocaleString("es")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="h6 fw-bold">Detalle de registros ({registros.length.toLocaleString("es")})</h3>
      <div className="table-responsive" style={{ maxHeight: 320, overflowY: "auto" }}>
        <table className="table table-sm table-hover mb-0 align-middle small">
          <thead className="table-light" style={{ position: "sticky", top: 0 }}>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Cinta</th>
              <th>Edad</th>
              <th>Usuario</th>
              <th className="text-end">Latitud</th>
              <th className="text-end">Longitud</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id}>
                <td className="text-nowrap">{formatoFecha(r.fecha)}</td>
                <td>{r.hora}</td>
                <td>{CINTA_POR_ID.get(r.cintaId)?.nombre || "—"}</td>
                <td>S{r.edad}</td>
                <td>{USUARIO_POR_ID.get(r.usuarioId)?.nombre || "—"}</td>
                <td className="text-end">{r.lat.toFixed(4)}</td>
                <td className="text-end">{r.lng.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}
