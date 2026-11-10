"use client";

import { useEffect, useState } from "react";
import { apiFetchTodos } from "@/lib/api";

// Día del año (1-366) de una fecha AAAA-MM-DD, igual que `numeroDia` de los promedios diarios.
const diaDelAnio = (fecha) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
};

// Filtro de semana para las gráficas diarias: elegir una semana del calendario ajusta el rango de días a esa semana. «Todas» quita
// el filtro. `rango` es el rango de días actual ([desde, hasta] o null); si el usuario lo mueve con el deslizador, el selector vuelve
// a «Todas».
export default function SelectorSemanaDias({ anio, rango, onChange }) {
  const [semanas, setSemanas] = useState([]);

  useEffect(() => {
    let activo = true;
    apiFetchTodos(`/semanas?anio=${anio}&limit=100`)
      .then((r) => {
        if (!activo) return;
        const lista = (r.items || [])
          .map((s) => ({ codigo: s.codigo, numero: s.numeroSemana, desde: diaDelAnio(String(s.fechaInicio).slice(0, 10)), hasta: diaDelAnio(String(s.fechaFin).slice(0, 10)), inicio: String(s.fechaInicio).slice(0, 10), fin: String(s.fechaFin).slice(0, 10) }))
          .sort((a, b) => a.numero - b.numero);
        setSemanas(lista);
      })
      .catch(() => activo && setSemanas([]));
    return () => {
      activo = false;
    };
  }, [anio]);

  if (!semanas.length) return null;
  const actual = rango ? semanas.find((s) => s.desde === rango[0] && s.hasta === rango[1]) : null;
  const fmt = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

  return (
    <div>
      <label className="form-label small fw-medium mb-1 d-block">Semana</label>
      <select
        className="form-select form-select-sm rounded-3"
        style={{ width: "auto", minWidth: "9rem" }}
        value={actual ? actual.codigo : ""}
        onChange={(e) => {
          const s = semanas.find((x) => x.codigo === e.target.value);
          onChange(s ? [s.desde, s.hasta] : null);
        }}
      >
        <option value="">Todas</option>
        {semanas.map((s) => (
          <option key={s.codigo} value={s.codigo}>
            {s.codigo}
          </option>
        ))}
      </select>
    </div>
  );
}
