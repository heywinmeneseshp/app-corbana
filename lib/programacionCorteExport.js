// Excel de Programación de corte con el mismo formato de «Proyección semanal · Cajas por producto»: una fila por semana (y
// otra hoja por mes), una columna por producto con sus cajas, total de cajas y kilos (cajas × peso neto del producto).
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Arma la tabla (columnas por producto; filas por semana con el total de cada mes, o por mes). La usan la vista previa y el Excel.
export function armarTablaProgramacion(registros) {
  // Productos (columnas), ordenados por nombre; los registros sin producto van en «Sin producto».
  const productos = new Map();
  for (const r of registros) {
    const k = r.producto?.uuid || "_sin";
    if (!productos.has(k)) productos.set(k, { uuid: k, nombre: r.producto?.nombre || "Sin producto", pesoNeto: r.producto?.pesoNeto == null ? null : Number(r.producto.pesoNeto) });
  }
  const cols = [...productos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const kilosDe = (porProd) => cols.reduce((t, p) => t + (porProd[p.uuid] || 0) * (p.pesoNeto || 0), 0);
  const sinPeso = cols.filter((p) => !p.pesoNeto && p.uuid !== "_sin").map((p) => p.nombre);

  // Mes de una programación: el del jueves de su semana (como en la proyección, la semana completa cuenta en un solo mes).
  const mesDe = (r) => {
    const ini = r.semana?.fechaInicio ? String(r.semana.fechaInicio).slice(0, 10) : null;
    const d = ini ? new Date(`${ini}T12:00:00Z`) : new Date(`${String(r.fecha).slice(0, 10)}T12:00:00Z`);
    if (ini) d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7));
    return [d.getUTCFullYear(), d.getUTCMonth() + 1];
  };

  // Agrupa por semana o por mes.
  function grupos(per) {
    const mapa = new Map();
    for (const r of registros) {
      const fecha = String(r.fecha || "").slice(0, 10);
      const [a, m] = mesDe(r);
      const clave = per === "semana" ? `${r.semana?.anio ?? a}-${String(r.semana?.numeroSemana ?? 0).padStart(2, "0")}` : `${a}-${String(m).padStart(2, "0")}`;
      const tituloFila = per === "semana" ? r.semana?.codigo || fecha : `${MESES[m - 1]} ${a}`;
      if (!mapa.has(clave)) mapa.set(clave, { clave, titulo: tituloFila, mes: `${a}-${String(m).padStart(2, "0")}`, nombreMes: `${MESES[m - 1]} ${a}`, productos: {} });
      const g = mapa.get(clave);
      const k = r.producto?.uuid || "_sin";
      g.productos[k] = (g.productos[k] || 0) + Number(r.cajasProgramadas || 0);
    }
    const lista = [...mapa.values()].sort((x, y) => (x.clave < y.clave ? -1 : 1));
    if (per !== "semana") return lista;
    // Por semana: después de las semanas de cada mes, una fila con el total del mes (como en la proyección anual).
    const out = [];
    lista.forEach((g, i) => {
      out.push(g);
      if (lista[i + 1]?.mes !== g.mes) {
        const sub = { titulo: `Total ${g.nombreMes}`, esSubtotal: true, productos: {} };
        for (const x of lista.filter((y) => y.mes === g.mes)) for (const [k, v] of Object.entries(x.productos)) sub.productos[k] = (sub.productos[k] || 0) + v;
        out.push(sub);
      }
    });
    return out;
  }

  return { cols, grupos, kilosDe, sinPeso };
}

export async function descargarProgramacionCorteExcel(registros, { titulo = "Programación de corte", subtitulo = "" } = {}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const verde = "FF166534";
  const relleno = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const fino = { style: "thin", color: { argb: "FFB9C9BE" } };
  const todosFinos = { top: fino, bottom: fino, left: fino, right: fino };
  const centrado = { horizontal: "center", vertical: "middle", wrapText: true };

  const { cols, grupos, kilosDe, sinPeso } = armarTablaProgramacion(registros);

  const cabeceras = ["", ...cols.map((p) => p.nombre), "Total cajas", "Kilos"];
  const hoja = (nombre, per) => {
    const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] });
    const ncol = cabeceras.length;
    ws.mergeCells(1, 1, 1, ncol);
    ws.getCell(1, 1).value = `${titulo} · Cajas por producto`;
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: verde } };
    ws.getCell(1, 1).alignment = { horizontal: "center" };
    ws.mergeCells(2, 1, 2, ncol);
    ws.getCell(2, 1).value = subtitulo || "Cajas programadas por producto; kilos = cajas × peso neto del producto.";
    ws.getCell(2, 1).font = { size: 9, color: { argb: "FF64748B" } };
    ws.getCell(2, 1).alignment = { horizontal: "center" };
    const cab = ws.getRow(4);
    cabeceras.forEach((t, i) => {
      const c = cab.getCell(i + 1);
      c.value = i === 0 ? (per === "semana" ? "Semana" : "Mes") : t;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = relleno(verde);
      c.alignment = centrado;
      c.border = todosFinos;
    });
    cab.height = 42;
    let fila = 5;
    const total = {};
    for (const g of grupos(per)) {
      const r = ws.getRow(fila++);
      const cajas = cols.reduce((t, p) => t + (g.productos[p.uuid] || 0), 0);
      if (!g.esSubtotal) for (const p of cols) total[p.uuid] = (total[p.uuid] || 0) + (g.productos[p.uuid] || 0);
      const valores = [g.titulo, ...cols.map((p) => (g.productos[p.uuid] ? Math.round(g.productos[p.uuid]) : null)), Math.round(cajas), Math.round(kilosDe(g.productos))];
      valores.forEach((v, i) => {
        const c = r.getCell(i + 1);
        c.value = v;
        c.alignment = centrado;
        c.border = g.esSubtotal ? { ...todosFinos, top: { style: "thin", color: { argb: "FF14532D" } }, bottom: { style: "thin", color: { argb: "FF14532D" } } } : todosFinos;
        if (i === 0) {
          c.font = { bold: true, color: { argb: "FF14532D" } };
          c.fill = relleno(g.esSubtotal ? "FFB7D8C2" : "FFE8F6EE");
        } else {
          c.numFmt = "#,##0";
          if (g.esSubtotal) {
            c.font = { bold: true };
            c.fill = relleno("FFCFE5D6");
          }
        }
      });
      if (!g.esSubtotal) {
        r.getCell(cabeceras.length - 1).font = { bold: true };
        r.getCell(cabeceras.length - 1).fill = relleno("FFD1ECDC");
      }
    }
    const rt = ws.getRow(fila);
    const cajasT = cols.reduce((t, p) => t + (total[p.uuid] || 0), 0);
    ["Total", ...cols.map((p) => Math.round(total[p.uuid] || 0)), Math.round(cajasT), Math.round(kilosDe(total))].forEach((v, i) => {
      const c = rt.getCell(i + 1);
      c.value = v;
      c.alignment = centrado;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = relleno(verde);
      c.border = todosFinos;
      if (i > 0) c.numFmt = "#,##0";
    });
    ws.columns = cabeceras.map((_, i) => ({ width: i === 0 ? 20 : i <= cols.length ? 22 : 16 }));
    if (sinPeso.length) {
      ws.getCell(fila + 2, 1).value = `* Sin peso neto (no suman kilos): ${sinPeso.join(", ")}.`;
      ws.getCell(fila + 2, 1).font = { size: 9, color: { argb: "FF64748B" } };
    }
  };
  hoja("Por semana", "semana");
  hoja("Total por mes", "mes");

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${titulo.replace(/[^a-zA-Z0-9-_ áéíóúñÁÉÍÓÚÑ]+/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
