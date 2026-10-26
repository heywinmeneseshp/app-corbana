// Catálogos y formatos compartidos por las pantallas de mantenimiento de equipos (Planes, Programaciones, Órdenes).

export const TIPOS_MANTENIMIENTO = [
  { value: "PREVENTIVO", label: "Preventivo" },
  { value: "RUTINARIO", label: "Rutinario" },
  { value: "CORRECTIVO", label: "Correctivo" },
  { value: "PREDICTIVO", label: "Predictivo" },
  { value: "ADECUACION", label: "Adecuación" },
  { value: "OTRO", label: "Otro" },
];

export const UNIDADES_PERIODICIDAD = [
  { value: "DIAS", label: "días" },
  { value: "MESES", label: "meses" },
  { value: "HORAS", label: "horas de uso" },
  { value: "HOROMETRO", label: "horas de horómetro" },
  { value: "KILOMETROS", label: "kilómetros" },
];

export const PRIORIDADES = [
  { value: "BAJA", label: "Baja", color: "#64748b" },
  { value: "MEDIA", label: "Media", color: "#2563eb" },
  { value: "ALTA", label: "Alta", color: "#ea580c" },
  { value: "CRITICA", label: "Crítica", color: "#dc2626" },
];

export const ESTADOS_PROGRAMACION = [
  { value: "PENDIENTE", label: "Pendiente", bg: "#f1f5f9", color: "#475569" },
  { value: "PROGRAMADA", label: "Programada", bg: "#dbeafe", color: "#1d4ed8" },
  { value: "EN_CURSO", label: "En curso", bg: "#fef3c7", color: "#b45309" },
  { value: "COMPLETADA", label: "Completada", bg: "#dcfce7", color: "#15803d" },
  { value: "CANCELADA", label: "Cancelada", bg: "#f1f5f9", color: "#94a3b8" },
  { value: "VENCIDA", label: "Vencida", bg: "#fee2e2", color: "#b91c1c" },
];

export const ESTADOS_ORDEN = [
  { value: "ABIERTA", label: "Abierta", bg: "#dbeafe", color: "#1d4ed8" },
  { value: "EN_PROCESO", label: "En proceso", bg: "#fef3c7", color: "#b45309" },
  { value: "CERRADA", label: "Cerrada", bg: "#dcfce7", color: "#15803d" },
  { value: "CANCELADA", label: "Cancelada", bg: "#f1f5f9", color: "#94a3b8" },
];

export const etiqueta = (lista, value) => lista.find((x) => x.value === value)?.label || value || "—";

export function Insignia({ lista, value }) {
  const e = lista.find((x) => x.value === value);
  return (
    <span className="badge rounded-pill small" style={{ backgroundColor: e?.bg || "#f1f5f9", color: e?.color || "#475569" }}>
      {e?.label || value}
    </span>
  );
}

export function TextoPrioridad({ value }) {
  const p = PRIORIDADES.find((x) => x.value === value);
  return <span style={{ color: p?.color, fontWeight: 600 }}>{p?.label || value}</span>;
}

// Fechas DATEONLY ("2026-10-22") mostradas tal cual: `new Date()` sobre esa cadena es medianoche UTC y en Colombia se ve el día anterior.
export function formatoFecha(f) {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dinero = (v) => `$${Number(v || 0).toLocaleString("es", { maximumFractionDigits: 0 })}`;
