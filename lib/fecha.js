// El backend devuelve los campos DATETIME (created_at, finalizadaEn, medidoEn,
// etc.) como strings "YYYY-MM-DD HH:mm:ss" en UTC, SIN sufijo de zona horaria
// (config `dateStrings: true` en la API — necesario para que las fechas tipo
// DATEONLY no se desfacen un día). Si se le pasa ese string directo a
// `new Date(...)`, el navegador lo interpreta como hora LOCAL del propio
// navegador en vez de UTC, desfasando la hora mostrada por el offset real
// (ej. 5 horas de más en Colombia). Esta función normaliza el string a ISO
// UTC explícito antes de crear el Date, para que después se pueda convertir
// correctamente con `timeZone: "America/Bogota"`.
export function parseFechaUTC(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const esUtcExplicito = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(v);
  const iso = esUtcExplicito ? v : `${v.replace(" ", "T")}Z`;
  return new Date(iso);
}
