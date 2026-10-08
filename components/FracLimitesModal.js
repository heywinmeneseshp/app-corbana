"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";

// Reglas de manejo de resistencia por código FRAC (ventana de los últimos 12
// meses, por finca). Vacío = esa regla no aplica (no genera alertas). Cuando una
// finca la incumple, sale en Sanidad Vegetal → Alertas, en el correo semanal y
// como aviso al programar una aspersión.
const CAMPOS = ["maxAplicaciones", "maxPorcentaje", "maxConsecutivas", "intervaloMinimoDias"];

const aTexto = (v) => (v !== null && v !== undefined ? String(v) : "");
const formDe = (f) => ({
  maxAplicaciones: aTexto(f.maxAplicaciones),
  maxPorcentaje: aTexto(f.maxPorcentaje),
  maxConsecutivas: aTexto(f.maxConsecutivas),
  intervaloMinimoDias: aTexto(f.intervaloMinimoDias),
  soloEnMezclas: Boolean(f.soloEnMezclas),
});

export default function FracLimitesModal({ onClose, embebido = false }) {
  const [filas, setFilas] = useState([]);
  const [forms, setForms] = useState({}); // codigo -> valores editables
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState("");
  const [error, setError] = useState("");
  const puedeEditar = hasPermission("ingrediente_activo.editar");

  useEffect(() => {
    apiFetch("/frac-limites")
      .then((res) => {
        const lista = Array.isArray(res) ? res : res?.data || [];
        setFilas(lista);
        setForms(Object.fromEntries(lista.map((f) => [f.fracCodigo, formDe(f)])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function cambiar(codigo, campo, valor) {
    setForms((prev) => ({ ...prev, [codigo]: { ...prev[codigo], [campo]: valor } }));
  }

  async function guardar(codigo) {
    setError("");
    setGuardando(codigo);
    try {
      const f = forms[codigo];
      const body = { soloEnMezclas: f.soloEnMezclas };
      for (const c of CAMPOS) body[c] = f[c] === "" ? null : Number(f[c]);
      await apiFetch(`/frac-limites/${encodeURIComponent(codigo)}`, { method: "PUT", body: JSON.stringify(body) });
      setFilas((prev) => prev.map((x) => (x.fracCodigo === codigo ? { ...x, ...body } : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando("");
    }
  }

  const campoNumerico = (codigo, campo, { placeholder = "—", max } = {}) => (
    <input
      type="number"
      min="0"
      max={max}
      step="1"
      className="form-control form-control-sm rounded-3"
      placeholder={placeholder}
      disabled={!puedeEditar}
      value={forms[codigo]?.[campo] ?? ""}
      onChange={(e) => cambiar(codigo, campo, e.target.value)}
    />
  );

  const contenido = (
    <>
      <p className="small text-secondary mb-3">
        Se evalúan por finca en los <strong>últimos 12 meses</strong>. Los valores iniciales son las recomendaciones del FRAC Banana Working Group
        y los puedes cambiar. Vacío = esa regla no aplica. <strong>Seguidas</strong>: aplicaciones consecutivas permitidas del grupo (1 = alternancia
        total). <strong>Días libres</strong>: tiempo mínimo sin usar el grupo entre dos aplicaciones (90 = 3 meses, 42 = 6 semanas).
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading ? (
        <div className="text-center py-4 text-secondary small">Cargando...</div>
      ) : (
        <div className="table-responsive" style={{ maxHeight: "62vh", overflowY: "auto" }}>
          <table className="table table-sm align-middle mb-0 small">
            <thead>
              <tr className="text-secondary">
                <th className="fw-medium">FRAC</th>
                <th className="fw-medium">Ingredientes</th>
                <th className="fw-medium" style={{ width: "6.5rem" }}>
                  Máx. aplic.
                </th>
                <th className="fw-medium" style={{ width: "5.5rem" }}>
                  Máx. %
                </th>
                <th className="fw-medium" style={{ width: "5.5rem" }}>
                  Seguidas
                </th>
                <th className="fw-medium" style={{ width: "6rem" }}>
                  Días libres
                </th>
                <th className="fw-medium text-center" style={{ width: "5rem" }}>
                  Solo mezcla
                </th>
                <th className="fw-medium">Restricciones (FRAC)</th>
                <th style={{ width: "5rem" }} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const actual = forms[f.fracCodigo] || formDe(f);
                const original = formDe(f);
                const cambio = CAMPOS.some((c) => actual[c] !== original[c]) || actual.soloEnMezclas !== original.soloEnMezclas;
                return (
                  <tr key={f.fracCodigo}>
                    <td>
                      <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle">{f.fracCodigo}</span>
                    </td>
                    <td className="text-secondary" style={{ minWidth: "12rem" }}>
                      {f.nombres}
                    </td>
                    <td>{campoNumerico(f.fracCodigo, "maxAplicaciones", { placeholder: "Sin límite" })}</td>
                    <td>{campoNumerico(f.fracCodigo, "maxPorcentaje", { max: 100 })}</td>
                    <td>{campoNumerico(f.fracCodigo, "maxConsecutivas")}</td>
                    <td>{campoNumerico(f.fracCodigo, "intervaloMinimoDias")}</td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        disabled={!puedeEditar}
                        checked={Boolean(actual.soloEnMezclas)}
                        onChange={(e) => cambiar(f.fracCodigo, "soloEnMezclas", e.target.checked)}
                      />
                    </td>
                    <td className="text-secondary" style={{ minWidth: "18rem" }} title={f.fuente || undefined}>
                      {f.restricciones || "—"}
                    </td>
                    <td className="text-end">
                      {puedeEditar && cambio && (
                        <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={guardando === f.fracCodigo} onClick={() => guardar(f.fracCodigo)}>
                          {guardando === f.fracCodigo ? "..." : "Guardar"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
  return embebido ? contenido : (
    <ModalShell title="Reglas de manejo de resistencia por grupo FRAC" onClose={onClose} width="82rem">
      {contenido}
    </ModalShell>
  );
}
