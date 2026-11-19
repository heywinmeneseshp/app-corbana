const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// semanas: lista de { numeroSemana, anio, fechaInicio, fechaFin, color } que
// cubran el año a graficar y sus bordes (diciembre anterior / enero siguiente).
function buildSemanaByMonday(semanas) {
  const map = new Map();
  for (const s of semanas) {
    map.set(s.fechaInicio, s);
  }
  return map;
}

// Genera, para un mes (0-11) de un año, las filas semana-a-semana (lunes a domingo). Cada semana va SOLO en el mes donde tiene
// más días (el mes de su jueves), así ninguna semana se repite en dos meses; los días de los meses vecinos de esas filas se ven
// atenuados.
function buildMonthRows(year, month, semanaByMonday) {
  // Primer lunes cuyo jueves cae en el mes: el lunes de la semana del primer jueves del mes.
  const primerDia = new Date(year, month, 1);
  const hastaJueves = (4 - primerDia.getDay() + 7) % 7;
  const cursor = new Date(year, month, 1 + hastaJueves - 3);

  const rows = [];
  for (;;) {
    const jueves = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 3);
    if (jueves.getMonth() !== month || jueves.getFullYear() !== year) break;
    const mondayKey = toLocalDateStr(cursor);
    const semana = semanaByMonday.get(mondayKey) || null;
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push({
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push({ semana, days });
  }
  return rows;
}

// Arma la estructura completa de los 12 meses de `year`, usando `semanas`
// (que debe incluir semanas de year-1 y year+1 para cubrir los bordes de
// diciembre/enero).
export function buildCalendarYear(year, semanas) {
  const semanaByMonday = buildSemanaByMonday(semanas);
  return MESES.map((nombre, month) => ({
    nombre,
    rows: buildMonthRows(year, month, semanaByMonday),
  }));
}

export { MESES, DIAS };
