// Agregación de datos diarios de clima (estación + Open-Meteo) para la pestaña
// "Gráficas" de Estación Meteorológica: por día, semana (ISO) o mes, ya sea
// una serie por año (comparar años) o una por fuente (comparar fuentes).

export const VARIABLES = [
  { key: "mm", label: "Lluvia (mm)", agg: "sum" },
  { key: "temperatura", label: "Temperatura promedio (°C)", agg: "avg" },
  { key: "temperaturaMaxima", label: "Temperatura máxima (°C)", agg: "avg" },
  { key: "temperaturaMinima", label: "Temperatura mínima (°C)", agg: "avg" },
  { key: "humedadRelativa", label: "Humedad (%)", agg: "avg" },
  { key: "vientoVelocidad", label: "Viento (km/h)", agg: "avg" },
  { key: "uc", label: "Unidades calóricas (UC)", agg: "sum" },
];

export const GRANULARIDADES = [
  { key: "dia", label: "Día" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
];

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const pad = (n) => String(n).padStart(2, "0");

function partes(fecha) {
  const [y, m, d] = String(fecha).slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

// Lunes de la semana ISO de la fecha (AAAA-MM-DD).
function lunesDe(fecha) {
  const { y, m, d } = partes(fecha);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

// { anio, semana } ISO: el año ISO puede diferir del calendario en los bordes.
function semanaIso(fecha) {
  const { y, m, d } = partes(fecha);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7) + 3); // jueves de esa semana
  const anio = dt.getUTCFullYear();
  const primerJueves = new Date(Date.UTC(anio, 0, 4));
  primerJueves.setUTCDate(primerJueves.getUTCDate() - ((primerJueves.getUTCDay() + 6) % 7) + 3);
  const semana = 1 + Math.round((dt - primerJueves) / (7 * 86400000));
  return { anio, semana };
}

// Valor de una variable en un día; UC = (Tmáx + Tmín) / 2 − base.
export function valorDia(fila, variable, baseUc) {
  if (variable === "uc") {
    if (fila.temperaturaMaxima === null || fila.temperaturaMinima === null) return null;
    return (fila.temperaturaMaxima + fila.temperaturaMinima) / 2 - baseUc;
  }
  const v = fila[variable];
  return v === null || v === undefined ? null : v;
}

// Período (eje X) y serie de una fila según el modo.
function claves(fila, { modo, granularidad }) {
  const { y, m, d } = partes(fila.fecha);
  if (modo === "fuentes") {
    if (granularidad === "dia") return { periodo: fila.fecha, etiqueta: fila.fecha, serie: fila.fuente };
    if (granularidad === "semana") {
      const l = lunesDe(fila.fecha);
      const { anio, semana } = semanaIso(fila.fecha);
      return { periodo: l, etiqueta: `${anio}-S${pad(semana)}`, serie: fila.fuente };
    }
    return { periodo: `${y}-${pad(m)}`, etiqueta: `${MESES[m - 1]} ${y}`, serie: fila.fuente };
  }
  // modo "años": el eje X es la posición dentro del año; una serie por año.
  if (granularidad === "dia") return { periodo: `${pad(m)}-${pad(d)}`, etiqueta: `${pad(d)}/${pad(m)}`, serie: String(y) };
  if (granularidad === "semana") {
    const { anio, semana } = semanaIso(fila.fecha);
    return { periodo: pad(semana), etiqueta: `S${pad(semana)}`, serie: String(anio) };
  }
  return { periodo: pad(m), etiqueta: MESES[m - 1], serie: String(y) };
}

const redondear = (n) => Math.round(n * 100) / 100;

// Devuelve { filas, series }: filas = [{ periodo, etiqueta, [serie]: valor }]
// ordenadas por período, listas para recharts.
export function agregar(datos, { modo, granularidad, variable, baseUc }) {
  const def = VARIABLES.find((v) => v.key === variable) || VARIABLES[0];
  const acum = new Map(); // `${periodo}|${serie}` -> { suma, n }
  const etiquetas = new Map(); // periodo -> etiqueta
  const series = new Set();

  for (const fila of datos) {
    const v = valorDia(fila, variable, baseUc);
    if (v === null) continue;
    const { periodo, etiqueta, serie } = claves(fila, { modo, granularidad });
    series.add(serie);
    etiquetas.set(periodo, etiqueta);
    const k = `${periodo}|${serie}`;
    const a = acum.get(k) || { suma: 0, n: 0 };
    a.suma += v;
    a.n += 1;
    acum.set(k, a);
  }

  const periodos = [...etiquetas.keys()].sort();
  const filas = periodos.map((p) => {
    const fila = { periodo: p, etiqueta: etiquetas.get(p) };
    for (const s of series) {
      const a = acum.get(`${p}|${s}`);
      if (a) fila[s] = redondear(def.agg === "sum" ? a.suma : a.suma / a.n);
    }
    return fila;
  });
  return { filas, series: [...series].sort() };
}
