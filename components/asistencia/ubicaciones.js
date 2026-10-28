"use client";

// Ubicaciones de asistencia: una marcación es en una finca o en un lugar (oficina, planta, bodega...). En los selectores se
// identifican con un prefijo: "f:<uuid>" para fincas y "l:<uuid>" para lugares.

export const TIPOS_LUGAR = [
  { id: "OFICINA", nombre: "Oficina" },
  { id: "PLANTA", nombre: "Planta" },
  { id: "BODEGA", nombre: "Bodega" },
  { id: "OTRO", nombre: "Otro" },
];
export const nombreTipoLugar = (tipo) => TIPOS_LUGAR.find((t) => t.id === tipo)?.nombre || "Lugar";

// "f:uuid" / "l:uuid" → parámetros de la API.
export const aParametros = (valor) => {
  if (!valor) return {};
  const [tipo, uuid] = valor.split(":");
  return tipo === "l" ? { lugarUuid: uuid } : { fincaUuid: uuid };
};

// Lo que viene de la API (marcación o payload) → valor del selector.
export const valorDe = ({ fincaUuid, lugarUuid }) => (lugarUuid ? `l:${lugarUuid}` : fincaUuid ? `f:${fincaUuid}` : "");

// Nombre de la ubicación de una marcación (finca o lugar).
export const nombreUbicacion = (m) => m.finca?.nombre || m.lugar?.nombre || "—";

export function SelectorUbicacion({ fincas, lugares, value, onChange, vacio = "Todas", className = "form-select form-select-sm rounded-3", disabled, required }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={required}>
      <option value="">{vacio}</option>
      {fincas.length > 0 && (
        <optgroup label="Fincas">
          {fincas.map((f) => (
            <option key={f.uuid} value={`f:${f.uuid}`}>
              {f.nombre}
            </option>
          ))}
        </optgroup>
      )}
      {lugares.length > 0 && (
        <optgroup label="Oficinas y otros lugares">
          {lugares.map((l) => (
            <option key={l.uuid} value={`l:${l.uuid}`}>
              {l.nombre}
              {l.estado === false ? " (inactivo)" : ""}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// Etiqueta pequeña para distinguir un lugar (oficina, planta...) de una finca en tablas.
export function EtiquetaLugar({ tipo }) {
  return (
    <span className="badge rounded-pill text-bg-light border fw-normal ms-1" style={{ fontSize: "0.65rem" }}>
      {nombreTipoLugar(tipo)}
    </span>
  );
}
