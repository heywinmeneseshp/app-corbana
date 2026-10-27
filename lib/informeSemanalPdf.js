import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

// PDF del Informe semanal de producción (Reportes → Resumen semanal), con la misma presentación que la página: indicadores, cortados
// por edad y cinta barrida lado a lado, repicados por motivo, ajustes y la tabla de saldo y movimientos. Se descarga o se adjunta al
// correo («Enviar finca» / «Enviar todas»).

const VERDE = [20, 83, 45]; // #14532d
const GRIS_FILA = [241, 245, 249]; // fila de total
const VERDE_SUAVE = [240, 253, 244]; // filas destacadas
const GRIS_TEXTO = [31, 41, 55];
const GRIS_SUAVE = [100, 116, 139];
const LINEA = [226, 232, 240];

const hexRgb = (hex) => {
  const h = String(hex || "#94a3b8").replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const n0 = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: 0 }));
const n2 = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (v) => (v === null || v === undefined ? "—" : `${n2(v)}%`);

// Estilo base de las tablas (mismo de la página: encabezado verde centrado, líneas suaves).
const base = (doc, opciones) => ({
  theme: "plain",
  styles: { fontSize: 8.5, cellPadding: { top: 1.8, bottom: 1.8, left: 2.6, right: 2.6 }, textColor: GRIS_TEXTO, lineColor: LINEA, lineWidth: { bottom: 0.2 } },
  headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
  tableLineColor: LINEA,
  tableLineWidth: 0.2,
  ...opciones,
});

// Punto de color de la cinta dentro de una celda (se dibuja después de la celda).
function puntoCinta(doc, celda, color) {
  doc.setFillColor(...hexRgb(COLOR_HEX[color]));
  doc.setDrawColor(148, 163, 184);
  doc.circle(celda.x + 3.2, celda.y + celda.height / 2, 1.3, color === "Blanco" ? "FD" : "F");
}

export function generarInformeSemanalPdf(data, movimientos) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 12;
  const mitad = (ancho - margen * 2 - 6) / 2;
  const ind = data.indicadores;

  // Encabezado
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, ancho, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`Informe semanal ${data.semana.codigo} — ${data.finca.nombre}`, margen, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Año ${data.semana.anio} · Semana ${data.semana.numeroSemana} · IBM ${data.finca.codigo}`, margen, 17);
  doc.text(new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }), ancho - margen, 17, { align: "right" });

  const inicioY = 28;

  // Izquierda: indicadores
  const filasInd = [
    ["Racimos procesados", n0(ind.racimosProcesados), ""],
    ["Racimos recusados", n0(ind.racimosRecusados), ""],
    ["Total cortados", n0(ind.totalCortados), "total"],
    ["Hectáreas en producción", n2(ind.hectareasProduccion), ""],
    ["Embolses", n0(ind.embolses), ""],
    ["Embolses por hectárea", n2(ind.embolsesPorHectarea), ""],
    ["Cajas producidas 20 kg", n0(ind.cajas), "fuerte"],
    ["Cajas por hectárea", n2(ind.cajasPorHectarea), ""],
    ["Ratio", n2(ind.ratio), "fuerte"],
    ["Peso neto racimo", "Sin dato en el sistema", "sin"],
    ["Peso vástago", "Sin dato en el sistema", "sin"],
    ["Peso bruto racimo", "Sin dato en el sistema", "sin"],
    ["Merma", "Sin dato en el sistema", "sin"],
  ];
  const cinta = data.infocinta;
  const xDer = margen + mitad + 6;
  // Indicadores (izquierda) y cortados + cinta barrida (derecha). `altoIzq`/`altoCinta` estiran las filas para que las dos columnas
  // terminen a la misma altura, como en la página.
  const dibujarSuperior = (doc, altoIzq = 0, altoCinta = 0) => {
    autoTable(
      doc,
      base(doc, {
        startY: inicioY,
        margin: { left: margen },
        tableWidth: mitad,
        head: [[{ content: `Indicadores de la semana ${data.semana.codigo} — ${data.finca.nombre}`, colSpan: 2 }]],
        body: filasInd.map(([a, b]) => [a, b]),
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        bodyStyles: altoIzq ? { minCellHeight: altoIzq, valign: "middle" } : {},
        didParseCell: (d) => {
          if (d.section !== "body") return;
          const tipo = filasInd[d.row.index][2];
          if (tipo === "total") {
            d.cell.styles.fillColor = GRIS_FILA;
            d.cell.styles.fontStyle = "bold";
          } else if (tipo === "fuerte") {
            d.cell.styles.fillColor = VERDE_SUAVE;
            d.cell.styles.fontStyle = "bold";
          } else if (tipo === "sin") {
            d.cell.styles.textColor = GRIS_SUAVE;
            if (d.column.index === 1) d.cell.styles.fontStyle = "italic";
          }
        },
      }),
    );
    const finIzq = doc.lastAutoTable.finalY;
    const filaIzq = doc.lastAutoTable.body[0]?.height || 0;

    // Derecha: cortados por edad
    autoTable(
      doc,
      base(doc, {
        startY: inicioY,
        margin: { left: xDer },
        tableWidth: mitad,
        head: [[{ content: "Cortados por edad", colSpan: 4 }], ["Cinta", "Edad", "Cortados", "%"]],
        body: data.cortadosPorEdad.length
          ? data.cortadosPorEdad.map((c) => [c.semana || "", String(c.edad), n0(c.cantidad), pct(c.porcentaje)])
          : [[{ content: "Sin cortes", colSpan: 4, styles: { halign: "center", textColor: GRIS_SUAVE } }]],
        columnStyles: { 0: { cellPadding: { left: 7, top: 1.8, bottom: 1.8, right: 2 } }, 1: { halign: "center" }, 2: { halign: "right", fontStyle: "bold" }, 3: { halign: "right" } },
        didDrawCell: (d) => {
          if (d.section === "body" && d.column.index === 0 && data.cortadosPorEdad[d.row.index]) puntoCinta(doc, d.cell, data.cortadosPorEdad[d.row.index].color);
        },
      }),
    );

    // Derecha: cinta barrida
    let filaCinta = 0;
    if (cinta) {
      const filasCinta = [
        ["Semana de embolse", cinta.semana],
        ["Embolsado", n0(cinta.embolsado)],
        ["Repicado", n0(cinta.repicado)],
        ["Recusado", n0(cinta.recusado)],
        ["Procesado", n0(cinta.procesado)],
        ["Racimos perdidos", n0(cinta.perdidos)],
        ["Recobro", pct(cinta.recobro)],
        ["Aprovechamiento", pct(cinta.aprovechamiento)],
      ];
      autoTable(
        doc,
        base(doc, {
          startY: doc.lastAutoTable.finalY + 5,
          margin: { left: xDer },
          tableWidth: mitad,
          head: [[{ content: `Cinta barrida · ${cinta.semana}`, colSpan: 2 }]],
          body: filasCinta,
          columnStyles: { 0: { textColor: GRIS_SUAVE }, 1: { halign: "right", fontStyle: "bold" } },
          bodyStyles: altoCinta ? { minCellHeight: altoCinta, valign: "middle" } : {},
          didParseCell: (d) => {
            if (d.section === "body" && d.column.index === 1 && d.row.index >= 6) d.cell.styles.textColor = [4, 120, 87];
            if (d.section === "body" && d.column.index === 1 && d.row.index === 5 && cinta.perdidos !== 0) d.cell.styles.textColor = [190, 18, 60];
            if (d.section === "body" && d.column.index === 1 && d.row.index === 0) d.cell.styles.cellPadding = { left: 2.6, right: 2.6, top: 1.8, bottom: 1.8 };
          },
          didDrawCell: (d) => {
            // Punto de color junto al código de la semana de embolse.
            if (d.section === "body" && d.column.index === 1 && d.row.index === 0) {
              const anchoTexto = doc.getTextWidth(cinta.semana);
              puntoCinta(doc, { ...d.cell, x: d.cell.x + d.cell.width - 2.6 - anchoTexto - 6 }, cinta.color);
            }
          },
        }),
      );
      filaCinta = doc.lastAutoTable.body[0]?.height || 0;
    }
    const finDer = doc.lastAutoTable.finalY;
    return { finIzq, finDer, filaIzq, filaCinta };
  };
  // Primero se mide en un documento aparte y luego se dibuja con las filas de la columna más baja estiradas.
  const m = dibujarSuperior(new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" }));
  let altoIzq = 0;
  let altoCinta = 0;
  if (m.finDer > m.finIzq + 0.5) altoIzq = m.filaIzq + (m.finDer - m.finIzq) / 13;
  else if (cinta && m.finIzq > m.finDer + 0.5) altoCinta = m.filaCinta + (m.finIzq - m.finDer) / 8;
  const { finIzq, finDer } = dibujarSuperior(doc, altoIzq, altoCinta);
  let y = Math.max(finIzq, finDer) + 7;

  // Repicados (por motivo) y ajustes
  const porMotivo = new Map();
  for (const r of data.repicados || []) porMotivo.set(r.motivo, (porMotivo.get(r.motivo) || 0) + r.cantidad);
  const motivos = [...porMotivo.entries()].sort((a, b) => b[1] - a[1]);
  const hayAjustes = (data.ajustes || []).length > 0;
  autoTable(
    doc,
    base(doc, {
      startY: y,
      margin: { left: margen },
      tableWidth: hayAjustes ? mitad : ancho - margen * 2,
      head: [[{ content: `Repicados ${data.semana.codigo} — ${n0(data.totalRepicados)} en total`, colSpan: 3 }], ["Motivo", "Cantidad", "%"]],
      body: motivos.length
        ? [
            ...motivos.map(([m, c]) => [m, n0(c), pct((c / data.totalRepicados) * 100)]),
            [
              { content: "Total", styles: { fillColor: GRIS_FILA, fontStyle: "bold" } },
              { content: n0(data.totalRepicados), styles: { fillColor: GRIS_FILA, fontStyle: "bold" } },
              { content: "100%", styles: { fillColor: GRIS_FILA, fontStyle: "bold" } },
            ],
          ]
        : [[{ content: "Sin repicados en la semana", colSpan: 3, styles: { halign: "center", textColor: GRIS_SUAVE } }]],
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" } },
    }),
  );
  const finRep = doc.lastAutoTable.finalY;
  if (hayAjustes) {
    autoTable(
      doc,
      base(doc, {
        startY: y,
        margin: { left: xDer },
        tableWidth: mitad,
        head: [[{ content: "Ajustes", colSpan: 4 }], ["Edad", "Tipo", "Motivo", "Cantidad"]],
        body: data.ajustes.map((a) => [String(a.edad), a.tipo, a.motivo || "—", n0(a.cantidad)]),
        columnStyles: { 0: { halign: "center" }, 3: { halign: "right", fontStyle: "bold" } },
      }),
    );
  }
  y = Math.max(finRep, hayAjustes ? doc.lastAutoTable.finalY : 0) + 7;

  // Saldo y movimientos (hoja horizontal: muchas columnas de cinta)
  if (movimientos?.cohortes?.length) {
    doc.addPage("letter", "landscape");
    const anchoH = doc.internal.pageSize.getWidth();
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, anchoH, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Saldo y movimientos ${data.semana.codigo} — ${data.finca.nombre}`, margen, 9.5);
    const cols = movimientos.cohortes;
    const conceptos = [
      ["Saldo inicial", (c) => c.saldoInicial, true],
      ["Embolsado", (c) => c.totalEmbolsado],
      ["Repicado", (c) => -c.totalRepicado],
      ["Recusado", (c) => -c.totalRecusado],
      ["Procesado", (c) => -c.totalProcesado],
      ["Saldo final", (c) => c.saldoFinal, true],
    ];
    const fmtMov = (v) => (Number(v) === 0 ? "—" : n0(v));
    const body = conceptos.map(([l, f, fuerte]) => [{ content: l, styles: fuerte ? { fontStyle: "bold" } : {} }, ...cols.map((c) => ({ content: fmtMov(f(c)), styles: fuerte ? { fontStyle: "bold" } : {} }))]);
    for (const lote of movimientos.lotes || []) {
      if (!cols.some((c) => (lote.saldoFinal[c.semanaUuid] || 0) !== 0)) continue;
      body.push([{ content: `   ${lote.codigo}`, styles: { textColor: GRIS_SUAVE } }, ...cols.map((c) => fmtMov(lote.saldoFinal[c.semanaUuid] || 0))]);
    }
    autoTable(
      doc,
      base(doc, {
        startY: 20,
        margin: { left: margen, right: margen },
        head: [["Concepto / Lote", ...cols.map((c) => `${(c.color || "").toUpperCase()}\n${c.semanaCodigo}\nEdad ${c.edadSemanas}`)]],
        body,
        styles: { fontSize: 7.5, cellPadding: 1.4, halign: "center", textColor: GRIS_TEXTO, lineColor: LINEA, lineWidth: 0.15 },
        columnStyles: { 0: { halign: "left", cellWidth: 30 } },
        didParseCell: (d) => {
          if (d.section === "head" && d.column.index > 0) {
            const c = cols[d.column.index - 1];
            d.cell.styles.fillColor = hexRgb(COLOR_HEX[c.color]);
            d.cell.styles.textColor = hexRgb(COLOR_TEXT[c.color] || "#111827");
            d.cell.styles.fontSize = 7;
          }
          if (d.section === "body" && d.column.index > 0 && String(d.cell.raw?.content ?? d.cell.raw).startsWith("-")) d.cell.styles.textColor = [185, 28, 28];
          if (d.section === "body" && (d.row.index === 0 || d.row.index === 5)) d.cell.styles.fillColor = GRIS_FILA;
        },
      }),
    );
  }

  // Pie de página
  const paginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_SUAVE);
    doc.text(`Informe semanal ${data.semana.codigo} · ${data.finca.nombre}`, margen, h - 7);
    doc.text(`Página ${i} de ${paginas}`, w - margen, h - 7, { align: "right" });
  }
  return doc;
}

export const nombrePdfInforme = (data) => `informe-${data.semana.codigo}-${data.finca.nombre}.pdf`;
