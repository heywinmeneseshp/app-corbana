"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";

const fmtN = (n, d = 1) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: d }));
const fmtFecha = (iso) => new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });
const COLOR_ESTADO = { AL_DIA: "text-success", PROXIMO: "text-warning", VENCIDO: "text-danger" };

// Lecturas de kilometraje y horas de un equipo: el conductor registra lo que marca el tablero al encender el equipo y el sistema calcula lo recorrido y
// cuándo toca el mantenimiento de los planes por km / horas. Pestañas: Registrar e Historial.
export default function LecturaEquipoModal({ equipo, onClose, onGuardado }) {
  const [tab, setTab] = useState("registrar");
  const [km, setKm] = useState("");
  const [horas, setHoras] = useState("");
  const [nota, setNota] = useState("");
  const [corregir, setCorregir] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState(null);
  const puedeCorregir = hasPermission("inventario.equipos.editar");

  async function cargarHistorial() {
    try {
      setHistorial(await apiFetch(`/inventarios/equipos/${equipo.uuid}/lecturas?limite=100`));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (tab === "historial" && !historial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarHistorial();
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setResultado(null);
    if (km === "" && horas === "") return setError("Escribe el kilometraje o las horas.");
    setGuardando(true);
    try {
      const cuerpo = { uuid: crypto.randomUUID(), fechaHora: new Date().toISOString(), nota: nota.trim() || undefined, corregir: corregir || undefined };
      if (km !== "") cuerpo.kilometraje = Number(String(km).replace(",", "."));
      if (horas !== "") cuerpo.horometro = Number(String(horas).replace(",", "."));
      const r = await apiFetch(`/inventarios/equipos/${equipo.uuid}/lecturas`, { method: "POST", body: JSON.stringify(cuerpo) });
      setResultado(r);
      setKm("");
      setHoras("");
      setNota("");
      setCorregir(false);
      setHistorial(null);
      onGuardado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title={`Lecturas · ${equipo.codigo} ${equipo.nombre}`} onClose={onClose} size="lg">
      <ul className="nav nav-tabs mb-3">
        {[
          ["registrar", "Registrar lectura"],
          ["historial", "Historial"],
        ].map(([id, label]) => (
          <li key={id} className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {tab === "registrar" && (
        <form onSubmit={guardar}>
          <p className="small text-secondary mb-2">
            Escribe lo que marca el tablero al encender el equipo. Última lectura guardada: <strong>{fmtN(equipo.kilometraje, 2)} km</strong> · <strong>{fmtN(equipo.horometro, 2)} h</strong>.
          </p>
          <div className="row g-2 mb-2">
            <div className="col-6">
              <label className="form-label small fw-medium mb-1">Kilometraje (km)</label>
              <input type="number" min="0" step="0.1" inputMode="decimal" className="form-control form-control-sm rounded-1" value={km} onChange={(e) => setKm(e.target.value)} placeholder="Vehículos" />
            </div>
            <div className="col-6">
              <label className="form-label small fw-medium mb-1">Horas (horómetro)</label>
              <input type="number" min="0" step="0.1" inputMode="decimal" className="form-control form-control-sm rounded-1" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Drones y maquinaria" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-medium mb-1">Nota (opcional)</label>
              <input className="form-control form-control-sm rounded-1" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>
          {puedeCorregir && (
            <div className="form-check mb-2">
              <input type="checkbox" className="form-check-input" id="lectura-corregir" checked={corregir} onChange={(e) => setCorregir(e.target.checked)} />
              <label className="form-check-label small" htmlFor="lectura-corregir">
                Es una corrección (cambiaron el tablero o la lectura anterior estaba mal): aceptar aunque sea menor que la anterior
              </label>
            </div>
          )}
          <button type="submit" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1" disabled={guardando}>
            <FiCheck /> {guardando ? "Guardando..." : "Guardar lectura"}
          </button>

          {resultado && (
            <div className="border rounded-1 p-2 mt-3 small" style={{ background: "#f6faf7" }}>
              <div className="fw-semibold text-success mb-1">Lectura registrada{resultado.duplicada ? " (ya estaba)" : ""}</div>
              {resultado.recorrido?.kilometraje != null && <div>Recorrido desde la lectura anterior: <strong>{fmtN(resultado.recorrido.kilometraje, 2)} km</strong></div>}
              {resultado.recorrido?.horometro != null && <div>Horas desde la lectura anterior: <strong>{fmtN(resultado.recorrido.horometro, 2)} h</strong></div>}
              {(resultado.planes || []).map((p) => (
                <div key={p.planUuid}>
                  {p.plan}:{" "}
                  <strong className={COLOR_ESTADO[p.estadoLectura] || ""}>
                    {p.estadoLectura === "VENCIDO" ? `vencido hace ${fmtN(Math.abs(p.faltan))} ${p.unidad}` : `faltan ${fmtN(p.faltan)} ${p.unidad}`}
                  </strong>{" "}
                  <span className="text-secondary">(toca a los {fmtN(p.proximaLectura)} {p.unidad})</span>
                </div>
              ))}
            </div>
          )}
        </form>
      )}

      {tab === "historial" && (
        <div className="table-responsive border rounded-1">
          <table className="table table-sm align-middle mb-0 small">
            <thead className="table-light">
              <tr>
                <th>Fecha</th>
                <th className="text-end">Km</th>
                <th className="text-end">Recorrido</th>
                <th className="text-end">Horas</th>
                <th className="text-end">Horas desde la anterior</th>
                <th>Registró</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {!historial && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-3">
                    Cargando...
                  </td>
                </tr>
              )}
              {historial && historial.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-3">
                    Todavía no hay lecturas.
                  </td>
                </tr>
              )}
              {historial?.items.map((l) => (
                <tr key={l.uuid}>
                  <td className="text-nowrap">{fmtFecha(l.fechaHora)}</td>
                  <td className="text-end">{fmtN(l.kilometraje, 2)}</td>
                  <td className="text-end fw-medium">{l.recorridoKm != null ? `+${fmtN(l.recorridoKm, 2)}` : "—"}</td>
                  <td className="text-end">{fmtN(l.horometro, 2)}</td>
                  <td className="text-end fw-medium">{l.recorridoHoras != null ? `+${fmtN(l.recorridoHoras, 2)}` : "—"}</td>
                  <td>
                    {l.usuario?.nombre || "—"} <span className="text-secondary">{l.origen === "APP" ? "· app" : ""}</span>
                  </td>
                  <td className="text-secondary">{l.nota || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
