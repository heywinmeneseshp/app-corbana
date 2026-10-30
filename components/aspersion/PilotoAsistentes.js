"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import TagPicker from "@/components/TagPicker";

// Pilotos (colaboradores con cargo «Piloto de Dron») y asistentes disponibles, compartidos entre los formularios de la página.
let cache = null;
const cargarDisponibles = () => {
  if (!cache)
    cache = apiFetch("/comprobantes-aspersion/participantes-disponibles").catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
};

// Piloto y asistentes de una aplicación (ejecutar aspersión y editar comprobante).
// Con DRON: el piloto se elige del listado de colaboradores con cargo «Piloto de Dron» y se agregan asistentes (sin límite); cada
// uno suma las hectáreas aplicadas (pago por hectárea). Con avión, el piloto es externo y se escribe.
// `valor`: { piloto, pilotoColaboradorUuid, asistentesUuids }; `onChange(patch)`.
export default function PilotoAsistentes({ medio, valor, onChange, inputClass = "form-control form-control-sm rounded-3" }) {
  const [disp, setDisp] = useState({ pilotos: [], asistentes: [] });
  const [error, setError] = useState("");
  const conDron = medio === "DRON";

  useEffect(() => {
    if (!conDron) return;
    let activo = true;
    cargarDisponibles()
      .then((d) => activo && setDisp(d || { pilotos: [], asistentes: [] }))
      .catch((err) => activo && setError(err.message));
    return () => {
      activo = false;
    };
  }, [conDron]);

  const asistentesItems = useMemo(
    () =>
      disp.asistentes
        .filter((a) => a.uuid !== valor.pilotoColaboradorUuid)
        .map((a) => ({ uuid: a.uuid, label: a.nombre, sublabel: [a.cargo, a.documento].filter(Boolean).join(" · ") })),
    [disp, valor.pilotoColaboradorUuid],
  );
  const seleccionados = asistentesItems.filter((i) => (valor.asistentesUuids || []).includes(i.uuid));

  if (!conDron) {
    return (
      <div>
        <label className="form-label small fw-medium mb-1">Piloto del avión *</label>
        <input className={inputClass} maxLength={150} value={valor.piloto || ""} onChange={(e) => onChange({ piloto: e.target.value })} placeholder="Nombre del piloto" />
      </div>
    );
  }

  return (
    <div className="row g-2">
      <div className="col-md-5">
        <label className="form-label small fw-medium mb-1">Piloto del dron *</label>
        <select
          className="form-select form-select-sm rounded-3"
          value={valor.pilotoColaboradorUuid || ""}
          onChange={(e) => {
            const uuid = e.target.value;
            const p = disp.pilotos.find((x) => x.uuid === uuid);
            // El piloto no puede ser también asistente.
            onChange({ pilotoColaboradorUuid: uuid, piloto: p?.nombre || "", asistentesUuids: (valor.asistentesUuids || []).filter((a) => a !== uuid) });
          }}
        >
          <option value="">Selecciona el piloto...</option>
          {disp.pilotos.map((p) => (
            <option key={p.uuid} value={p.uuid}>
              {p.nombre}
            </option>
          ))}
        </select>
        {disp.pilotos.length === 0 && !error && (
          <div className="form-text small text-warning">
            No hay pilotos: asigna el cargo «Piloto de Dron» a un colaborador en{" "}
            <Link href="/sanidad-vegetal/colaboradores" target="_blank">
              Sanidad Vegetal → Colaboradores
            </Link>
            .
          </div>
        )}
      </div>
      <div className="col-md-7">
        <label className="form-label small fw-medium mb-1">Asistentes</label>
        <TagPicker
          items={asistentesItems}
          selected={seleccionados}
          onChange={(nuevos) => onChange({ asistentesUuids: nuevos.map((n) => n.uuid) })}
          placeholder="Agregar asistente..."
        />
        <div className="form-text small">El piloto y cada asistente suman las hectáreas aplicadas.</div>
      </div>
      {error && <div className="col-12 small text-danger">{error}</div>}
    </div>
  );
}
