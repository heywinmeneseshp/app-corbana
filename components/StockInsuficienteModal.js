"use client";

import { FiAlertTriangle } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";

const fmt = (n) => Number(n).toLocaleString("es-CO", { maximumFractionDigits: 2 });

// Aviso amigable cuando el backend responde `requiereConfirmacion` por stock
// insuficiente (ver stock.helper.js): en vez del texto crudo de cada
// advertencia, una tabla Insumo / Disponible / Necesario / Quedaría. Los
// números vienen en la unidad base de cada insumo.
export default function StockInsuficienteModal({ advertencias, onCancelar, onContinuar, textoContinuar = "Continuar de todas formas" }) {
  const filas = (advertencias || []).filter((a) => a && a.articulo !== undefined);
  const sinDetalle = (advertencias || []).filter((a) => !a || a.articulo === undefined);

  return (
    <ModalShell title="Stock insuficiente" onClose={onCancelar} width="36rem">
      <div className="d-flex align-items-start gap-3 mb-3">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 44, height: 44, backgroundColor: "#fef3c7", color: "#b45309" }}
        >
          <FiAlertTriangle size={22} />
        </div>
        <div>
          <p className="fw-semibold mb-1">
            {filas.length === 1 ? "Un insumo no alcanza" : `${filas.length || "Algunos"} insumos no alcanzan`} en el almacén.
          </p>
          <p className="small text-secondary mb-0">
            Si continúas, el inventario de {filas.length === 1 ? "ese insumo" : "esos insumos"} quedará en <strong>negativo</strong>. Puedes
            cancelar y registrar primero la entrada de inventario.
          </p>
        </div>
      </div>

      {filas.length > 0 && (
        <div className="table-responsive rounded-3 border mb-3">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr className="small" style={{ backgroundColor: "#f0fdf4", color: "#166534" }}>
                <th>Insumo</th>
                <th className="text-end">Disponible</th>
                <th className="text-end">Necesario</th>
                <th className="text-end">Quedaría</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((a, i) => (
                <tr key={`${a.articulo}-${i}`} className="small">
                  <td className="fw-medium">{a.articulo}</td>
                  <td className="text-end">{fmt(a.disponible)}</td>
                  <td className="text-end">{fmt(a.requerido)}</td>
                  <td className="text-end fw-bold" style={{ color: "#b91c1c" }}>
                    {fmt(a.saldoResultante)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sinDetalle.length > 0 && (
        <ul className="small text-secondary">
          {sinDetalle.map((a, i) => (
            <li key={i}>{a?.mensaje || String(a)}</li>
          ))}
        </ul>
      )}

      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-sm rounded-3 text-white" style={{ backgroundColor: "#b45309" }} onClick={onContinuar}>
          {textoContinuar}
        </button>
      </div>
    </ModalShell>
  );
}
