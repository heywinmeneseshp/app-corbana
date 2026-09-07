"use client";

// Comparación por "canastas": cada canasta es un grupo de fincas/grupos que
// se suman entre sí (agregado) Y su propio año (o años) — cada canasta es
// UNA o más líneas en el gráfico, así se puede comparar un agregado de un
// año contra el mismo (u otro) agregado de otro año (ej. "Zona Norte 2024"
// vs. "Zona Norte 2026"), no solo fincas entre sí en un único año
// compartido.
//
// Con una sola canasta se comporta como el selector simple de siempre (sin
// nombre ni tarjetas). Con 2+, cada canasta es su propia tarjeta compacta,
// acomodadas en una grilla de 2 columnas (una fila para cada par) en vez de
// apilarlas todas en filas sueltas de ancho completo — con 4 selecciones
// entran en solo 2 filas.
import { useId } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import SelectorObjetivos from "@/components/reportes/SelectorObjetivos";
import SelectorAnios from "@/components/reportes/SelectorAnios";

const SERIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

export default function SelectorCanastas({ fincas, anioOpciones, canastas, onChange }) {
  const idBase = useId();

  function actualizarCanasta(id, cambios) {
    onChange(canastas.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
  }

  function agregarCanasta() {
    onChange([...canastas, { id: `${idBase}-${canastas.length}-${Date.now()}`, nombre: "", objetivos: [], anios: [] }]);
  }

  function quitarCanasta(id) {
    onChange(canastas.filter((c) => c.id !== id));
  }

  const varias = canastas.length > 1;

  if (!varias) {
    return (
      <div className="d-flex flex-wrap align-items-end gap-2">
        <SelectorObjetivos
          fincas={fincas}
          seleccionados={canastas[0].objetivos}
          onChange={(objetivos) => actualizarCanasta(canastas[0].id, { objetivos })}
        />
        <SelectorAnios
          anios={anioOpciones}
          seleccionados={canastas[0].anios}
          onChange={(anios) => actualizarCanasta(canastas[0].id, { anios })}
        />
        <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1" onClick={agregarCanasta}>
          <FiPlus /> Comparar con otra selección
        </button>
      </div>
    );
  }

  return (
    // flexBasis: 100% fuerza a ocupar el ancho completo de su fila aunque
    // el contenedor padre (el bloque de filtros de la página) sea un
    // flex-wrap junto al título.
    <div style={{ width: "100%", flexBasis: "100%" }}>
      <div
        className="d-grid gap-2"
        style={{ gridTemplateColumns: "repeat(2, minmax(18rem, 1fr))" }}
      >
        {canastas.map((canasta, i) => (
          <div key={canasta.id} className="card border-0 shadow-sm rounded-4 p-2">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span
                className="rounded-circle flex-shrink-0"
                style={{ width: "0.65rem", height: "0.65rem", backgroundColor: SERIE_COLORS[i % SERIE_COLORS.length] }}
              />
              <input
                type="text"
                className="form-control form-control-sm rounded-3"
                placeholder={`Selección ${i + 1}`}
                value={canasta.nombre}
                onChange={(e) => actualizarCanasta(canasta.id, { nombre: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-sm btn-link text-danger p-0 flex-shrink-0"
                onClick={() => quitarCanasta(canasta.id)}
                title="Quitar esta selección"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <div className="flex-grow-1" style={{ minWidth: "10rem" }}>
                <SelectorObjetivos
                  fincas={fincas}
                  seleccionados={canasta.objetivos}
                  onChange={(objetivos) => actualizarCanasta(canasta.id, { objetivos })}
                  sinEtiqueta
                />
              </div>
              <div style={{ width: "8rem" }}>
                <SelectorAnios
                  anios={anioOpciones}
                  seleccionados={canasta.anios}
                  onChange={(anios) => actualizarCanasta(canasta.id, { anios })}
                  sinEtiqueta
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1 mt-2"
        onClick={agregarCanasta}
      >
        <FiPlus /> Comparar con otra selección
      </button>
    </div>
  );
}
