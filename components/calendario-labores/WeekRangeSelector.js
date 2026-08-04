"use client";

// Selector de rango de semanas visibles: "S01-2026 → S12-2026". `desde`/
// `hasta` son numeroSemana (enteros); `onChange` recibe el rango nuevo ya
// corregido (hasta nunca queda antes que desde).
export default function WeekRangeSelector({ semanas, desde, hasta, onChange }) {
  if (semanas.length === 0) return null;

  function handleDesde(numeroSemana) {
    const nuevoDesde = Number(numeroSemana);
    onChange({ desde: nuevoDesde, hasta: Math.max(hasta, nuevoDesde) });
  }

  function handleHasta(numeroSemana) {
    const nuevoHasta = Number(numeroSemana);
    onChange({ desde: Math.min(desde, nuevoHasta), hasta: nuevoHasta });
  }

  return (
    <div className="d-flex align-items-center gap-2 small text-secondary">
      <span>Semanas</span>
      <select className="form-select form-select-sm rounded-3" style={{ width: 130 }} value={desde} onChange={(e) => handleDesde(e.target.value)}>
        {semanas.map((s) => (
          <option key={s.uuid} value={s.numeroSemana}>
            {s.codigo}
          </option>
        ))}
      </select>
      <span>→</span>
      <select className="form-select form-select-sm rounded-3" style={{ width: 130 }} value={hasta} onChange={(e) => handleHasta(e.target.value)}>
        {semanas.map((s) => (
          <option key={s.uuid} value={s.numeroSemana}>
            {s.codigo}
          </option>
        ))}
      </select>
    </div>
  );
}
