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

// Genera, para un mes (0-11) de un año, las filas semana-a-semana (lunes a
// domingo) que se ven en el calendario impreso, con los días de meses
// vecinos incluidos (atenuados) para completar cada fila.
function buildMonthRows(year, month, semanaByMonday) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay(); // 0=domingo..6=sabado
  const diffToMonday = firstDow === 0 ? -6 : 1 - firstDow;
  const gridStart = new Date(year, month, 1 + diffToMonday);

  const lastOfMonth = new Date(year, month, daysInMonth);
  const lastDow = lastOfMonth.getDay();
  const diffToSunday = lastDow === 0 ? 0 : 7 - lastDow;
  const gridEnd = new Date(year, month, daysInMonth + diffToSunday);

  const rows = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
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
