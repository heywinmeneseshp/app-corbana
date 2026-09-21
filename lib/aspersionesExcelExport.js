import ExcelJS from "exceljs";

// Misma paleta que usa la vista en pantalla (ver ESTADO_INFO en
// app/(app)/sanidad-vegetal/aspersiones/page.js) — para que el Excel se
// vea como una extensión de la misma app, no una hoja de cálculo genérica.
const VERDE = "FF166534";
const BLANCO = "FFFFFFFF";
const GRIS_BANDA = "FFF8FAFC";
const GRIS_BORDE = "FFE2E8F0";

const ESTADO_ESTILO = {
  PROGRAMADA: { bg: "FFDBEAFE", color: "FF1E40AF", label: "Programada" },
  EJECUTADA: { bg: "FFDCFCE7", color: "FF15803D", label: "Ejecutada" },
  CANCELADA: { bg: "FFF3F4F6", color: "FFB91C1C", label: "Cancelada" },
};

const TIPO_LABEL = { SIGATOKA_NEGRA: "Sigatoka Negra", DEFOLIADOR: "Defoliador", FERTILIZACION: "Fertilización" };

const BORDE_FINO = { style: "thin", color: { argb: GRIS_BORDE } };
const BORDES_CELDA = { top: BORDE_FINO, left: BORDE_FINO, bottom: BORDE_FINO, right: BORDE_FINO };

async function descargar(workbook, nombreArchivo) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

// Banda de título verde, igual criterio visual que el encabezado del
// calendario y la banda del PDF del aviso (mismo #166534 en todos lados).
function agregarTitulo(sheet, texto, subtitulo, totalColumnas) {
  sheet.mergeCells(1, 1, 1, totalColumnas);
  const titulo = sheet.getCell(1, 1);
  titulo.value = texto;
  titulo.font = { bold: true, size: 14, color: { argb: BLANCO } };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 1, 2, totalColumnas);
  const sub = sheet.getCell(2, 1);
  sub.value = subtitulo;
  sub.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  sub.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 16;
}

function estilarEncabezado(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: BLANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDES_CELDA;
  });
  row.height = 20;
}

// Excel de la vista Programador — mismas columnas que ya se ven en pantalla
// (ver app/(app)/sanidad-vegetal/aspersiones/page.js), directo de
// `items` (los resultados ya filtrados/paginados que trajo el listado).
export async function descargarExcelProgramador(items) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Programador", { views: [{ state: "frozen", ySplit: 4 }] });

  const columnas = [
    { header: "Número", key: "numero", width: 13 },
    { header: "Finca", key: "finca", width: 20 },
    { header: "Fecha", key: "fecha", width: 13 },
    { header: "Semana", key: "semana", width: 11 },
    { header: "Tipo", key: "tipo", width: 24 },
    { header: "Mezcla", key: "mezcla", width: 26 },
    { header: "Hectáreas", key: "hectareas", width: 11 },
    { header: "Cantidad", key: "cantidad", width: 16 },
    { header: "Estado", key: "estado", width: 14 },
  ];

  agregarTitulo(sheet, "Programación de Aspersiones", `Generado el ${new Date().toLocaleDateString("es-CO")} — ${items.length} programación(es)`, columnas.length);

  // Fila 3 en blanco como respiro entre el título y la tabla.
  sheet.getRow(3).height = 6;

  sheet.columns = columnas.map((c) => ({ key: c.key, width: c.width }));
  const headerRow = sheet.getRow(4);
  columnas.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
  });
  estilarEncabezado(headerRow);

  items.forEach((a, idx) => {
    const estilo = ESTADO_ESTILO[a.estado] || ESTADO_ESTILO.PROGRAMADA;
    const row = sheet.addRow({
      numero: a.numero,
      finca: a.finca?.nombre || "—",
      fecha: a.fecha,
      semana: a.semana?.codigo || "—",
      tipo: (a.tipo || []).map((t) => TIPO_LABEL[t] || t).join(" + "),
      mezcla: a.mezcla?.nombre || a.mezcla?.codigo || "—",
      hectareas: Number(a.hectareas),
      cantidad: `${Number(a.cantidadCalculada).toFixed(2)} ${a.mezcla?.unidadRendimiento?.simbolo || ""}`.trim(),
      estado: estilo.label,
    });
    row.height = 18;
    row.eachCell((cell) => {
      cell.border = BORDES_CELDA;
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.font = { size: 10 };
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_BANDA } };
      }
    });
    const celdaEstado = row.getCell(9);
    celdaEstado.font = { size: 10, bold: true, color: { argb: estilo.color } };
    celdaEstado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: estilo.bg } };
  });

  await descargar(workbook, `Programacion-Aspersiones-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Arma el workbook del Calendario (misma grilla Finca × día que se ve en
// pantalla) sin descargarlo — separado de `descargarExcelCalendario` para
// poder reutilizarlo también al ADJUNTARLO en el correo del resumen semanal
// ("Enviar semana"), sin duplicar toda esta lógica de armado.
function construirWorkbookCalendario({ fincasConProgramacion, diasSemana, mapaCalendario, semanaActiva }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(semanaActiva?.codigo || "Calendario", { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] });

  const totalColumnas = 1 + diasSemana.length;
  agregarTitulo(
    sheet,
    "Calendario de Aspersiones",
    semanaActiva ? `${semanaActiva.codigo} — ${semanaActiva.fechaInicio} al ${semanaActiva.fechaFin}` : "",
    totalColumnas,
  );
  sheet.getRow(3).height = 6;

  sheet.columns = [
    { key: "finca", width: 22 },
    ...diasSemana.map((d) => ({ key: d.iso, width: 24 })),
  ];

  const headerRow = sheet.getRow(4);
  headerRow.getCell(1).value = "Finca";
  diasSemana.forEach((d, i) => {
    headerRow.getCell(2 + i).value = `${d.nombre} ${d.numero}`;
  });
  estilarEncabezado(headerRow);

  fincasConProgramacion.forEach((finca, idx) => {
    const row = sheet.addRow({ finca: finca.nombre });
    let maxItems = 1;

    row.getCell(1).value = finca.nombre;

    diasSemana.forEach((d, i) => {
      const items = mapaCalendario.get(`${finca.uuid}:${d.iso}`) || [];
      const celda = row.getCell(2 + i);
      if (items.length === 0) return;
      maxItems = Math.max(maxItems, items.length);

      // Solo el nombre de la mezcla — el estado se lee por color de fondo
      // y tachado (canceladas), sin repetir la palabra "Cancelada" en cada
      // celda, igual que la vista en pantalla.
      celda.value = {
        richText: items.map((it, j) => {
          const nombre = it.mezcla?.nombre || it.mezcla?.codigo || "—";
          const cancelada = it.estado === "CANCELADA";
          return {
            text: nombre + (j < items.length - 1 ? "\n" : ""),
            font: { size: 9.5, bold: !cancelada, strike: cancelada, color: { argb: cancelada ? "FF9CA3AF" : "FF1F2937" } },
          };
        }),
      };

      // Fondo suave con el color de la primera programación del día — si
      // hay varias con distinto estado, el tachado de cada línea ya avisa
      // cuál está cancelada.
      const estilo = ESTADO_ESTILO[items[0].estado] || ESTADO_ESTILO.PROGRAMADA;
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: estilo.bg } };
    });

    // `includeEmpty`: sin esto, ExcelJS salta las celdas de días sin
    // ninguna programación (nunca se les asignó `.value`) y quedan sin
    // borde — la grilla se ve incompleta/rota en esas columnas.
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = BORDES_CELDA;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      if (colNumber === 1) cell.font = { size: 10, bold: true };
      if (idx % 2 === 1 && !cell.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_BANDA } };
      }
    });

    // Una línea de texto ronda los 14-15pt de alto en Excel — se deja
    // margen extra para que ninguna línea quede cortada visualmente.
    row.height = Math.max(20, maxItems * 16 + 6);
  });

  // Borde exterior grueso alrededor de toda la tabla (encabezado + filas de
  // fincas), para que se lea como un solo bloque en vez de una grilla de
  // celdas suelta.
  const filaInicio = 4;
  // filaInicio (4) es el encabezado — la primera finca cae en la fila 5, no
  // en la 4, así que la última fila de datos es filaInicio + N, no
  // filaInicio - 1 + N (bug real: dejaba la última finca fuera del borde).
  const filaFin = filaInicio + fincasConProgramacion.length;
  const BORDE_GRUESO = { style: "medium", color: { argb: "FF166534" } };
  for (let f = filaInicio; f <= filaFin; f++) {
    for (let c = 1; c <= totalColumnas; c++) {
      const cell = sheet.getCell(f, c);
      const actual = cell.border || {};
      cell.border = {
        ...actual,
        top: f === filaInicio ? BORDE_GRUESO : actual.top,
        bottom: f === filaFin ? BORDE_GRUESO : actual.bottom,
        left: c === 1 ? BORDE_GRUESO : actual.left,
        right: c === totalColumnas ? BORDE_GRUESO : actual.right,
      };
    }
  }

  return workbook;
}

export async function descargarExcelCalendario(datos) {
  const workbook = construirWorkbookCalendario(datos);
  await descargar(workbook, `Calendario-Aspersiones-${datos.semanaActiva?.codigo || "semana"}.xlsx`);
}

// Mismo Excel del Calendario, pero como Blob en memoria (sin descargarlo) —
// para adjuntarlo al correo del resumen semanal (ver "Enviar semana" en
// aspersiones/page.js).
export async function generarExcelCalendarioBlob(datos) {
  const workbook = construirWorkbookCalendario(datos);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const nombre = `Resumen-Aspersiones-${datos.semanaActiva?.codigo || "semana"}.xlsx`;
  return { blob, nombre };
}
