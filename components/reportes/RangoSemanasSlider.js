"use client";

import { useRef, useState } from "react";

// Filtra los puntos de una gráfica al rango de semanas elegido (null = todo).
export function filtrarSemanas(datos, rango, campo = "numeroSemana") {
  if (!rango) return datos;
  return datos.filter((d) => d[campo] >= rango[0] && d[campo] <= rango[1]);
}

// Slider de rango como el de Power BI: una línea con dos círculos que se
// arrastran; el tramo entre ambos se resalta. `value` = [desde, hasta] o null
// (todo el rango). Emite null cuando abarca todo, para volver al eje original.
// `rotulo`/`max`: semanas (1-53) por defecto, o días del año (1-366).
export default function RangoSemanasSlider({ value, onChange, min = 1, max = 53, rotulo = "Semanas" }) {
  const pista = useRef(null);
  // Texto en edición de las casillas (null = muestra el valor actual).
  const [editA, setEditA] = useState(null);
  const [editB, setEditB] = useState(null);
  const [a, b] = value || [min, max];
  const pct = (v) => ((v - min) / (max - min)) * 100;

  const valorDe = (clientX) => {
    const r = pista.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(min + t * (max - min));
  };
  const emitir = (na, nb) => onChange(na <= min && nb >= max ? null : [na, nb]);

  const iniciar = (e) => e.currentTarget.setPointerCapture(e.pointerId);
  const moverA = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) emitir(Math.min(valorDe(e.clientX), b), b);
  };
  const moverB = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) emitir(a, Math.max(valorDe(e.clientX), a));
  };

  // Clic en la línea: mueve la manija más cercana.
  const clicPista = (e) => {
    if (e.target !== e.currentTarget) return;
    const v = valorDe(e.clientX);
    if (Math.abs(v - a) <= Math.abs(v - b)) emitir(Math.min(v, b), b);
    else emitir(a, Math.max(v, a));
  };

  const manija = (v) => ({
    position: "absolute",
    top: "50%",
    left: `${pct(v)}%`,
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: "50%",
    background: "#ffffff",
    border: "2px solid #166534",
    boxShadow: "0 1px 3px rgba(0,0,0,.3)",
    cursor: "ew-resize",
    touchAction: "none",
    zIndex: 2,
  });
  // Confirma lo escrito (Enter o al salir de la casilla): se acota a min..max y
  // a que "desde" no pase de "hasta".
  const confirmar = (cual) => {
    const txt = cual === "a" ? editA : editB;
    if (cual === "a") setEditA(null);
    else setEditB(null);
    const n = Math.round(Number(txt));
    if (txt === null || txt === "" || Number.isNaN(n)) return;
    if (cual === "a") emitir(Math.max(min, Math.min(n, b)), b);
    else emitir(a, Math.min(max, Math.max(n, a)));
  };
  const tecla = (cual) => (e) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };
  const casilla = { width: "3.6rem" };

  return (
    <div className="px-4 pt-2 pb-2" title={`Arrastra los círculos para elegir el rango de ${rotulo.toLowerCase()}`}>
      <div ref={pista} onClick={clicPista} style={{ position: "relative", height: 20, cursor: "pointer" }}>
        {/* línea base */}
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, marginTop: -1.5, background: "#cbd5e1", borderRadius: 2, pointerEvents: "none" }} />
        {/* tramo seleccionado */}
        <div
          style={{ position: "absolute", top: "50%", left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%`, height: 4, marginTop: -2, background: "#166534", borderRadius: 2, pointerEvents: "none" }}
        />
        <div style={manija(a)} onPointerDown={iniciar} onPointerMove={moverA} />
        <div style={manija(b)} onPointerDown={iniciar} onPointerMove={moverB} />
      </div>
      <div className="d-flex align-items-center justify-content-center gap-2 mt-3 small text-secondary">
        <span>{rotulo}: desde</span>
        <input
          type="number"
          min={min}
          max={max}
          className="form-control form-control-sm bg-white text-center"
          style={casilla}
          value={editA ?? a}
          onChange={(e) => setEditA(e.target.value)}
          onBlur={() => confirmar("a")}
          onKeyDown={tecla("a")}
        />
        <span>hasta</span>
        <input
          type="number"
          min={min}
          max={max}
          className="form-control form-control-sm bg-white text-center"
          style={casilla}
          value={editB ?? b}
          onChange={(e) => setEditB(e.target.value)}
          onBlur={() => confirmar("b")}
          onKeyDown={tecla("b")}
        />
      </div>
    </div>
  );
}
