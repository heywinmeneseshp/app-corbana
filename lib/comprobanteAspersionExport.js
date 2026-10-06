import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// PDF del "Comprobante de aplicación" de una aspersión ejecutada (Sanidad
// Vegetal → Comprobante de aspersiones). Mismo lenguaje visual que el aviso
// de aspersión (ver aspersionExport.js): se genera acá con jsPDF/autoTable,
// el backend nunca genera PDFs.
//
// Muestra: mezcla, hectáreas programadas y aplicadas, avión o dron, piloto,
// insumos de la mezcla (SOLO nombres, sin cantidades — pedido explícito),
// galones totales y quién ejecutó la aspersión. Un BORRADOR lleva marca de
// agua para que no se confunda con un comprobante emitido.
const VERDE = [22, 101, 52];
const VERDE_CLARO = [240, 253, 244];
const GRIS_BORDE = [226, 232, 240];
const GRIS_TEXTO = [55, 65, 81];
const GRIS_SUAVE = [148, 163, 184];
const BLANCO = [255, 255, 255];

const MEDIO_LABEL = { AVION: "Avión", DRON: "Dron" };

function bordeRedondeado(doc, x, y, width, height) {
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, "S");
}

// Banda de título con las esquinas superiores redondeadas (mismo recurso
// que el aviso: se pinta antes de la tabla y la tabla solo escribe encima).
function bandaTitulo(doc, x, y, width, height, color) {
  const r = 2;
  doc.setFillColor(...color);
  doc.roundedRect(x, y, width, height, r, r, "F");
  doc.rect(x, y + height - r, width, r, "F");
}

function fechaLarga(fechaIso) {
  if (!fechaIso) return "—";
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return "—";
  const texto = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fechaHora(fechaIso) {
  if (!fechaIso) return "—";
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
}

function nombreUsuario(u) {
  if (!u) return "—";
  return `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario || "—";
}

function numero(valor, decimales = 2) {
  if (valor === null || valor === undefined || valor === "") return "—";
  return Number(valor).toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function marcaAgua(doc, texto, color) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const angulo = 35;
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.12 }));
  doc.setTextColor(...color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(80);
  const rad = (angulo * Math.PI) / 180;
  const ancho = doc.getTextWidth(texto);
  doc.text(texto, pageWidth / 2 - (ancho / 2) * Math.cos(rad), pageHeight / 2 + (ancho / 2) * Math.sin(rad), { angle: angulo });
  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

export function generarComprobanteAspersionPdf(c) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const asp = c.aspersion || {};
  const medio = c.medio || asp.medio;
  const etiquetaPiloto = `PILOTO DEL ${medio === "DRON" ? "DRON" : "AVIÓN"}`;
  const emitido = c.estado === "EMITIDO";

  let y = margin;

  // ── Encabezado ──
  doc.setFillColor(...VERDE);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "F");
  doc.setTextColor(...BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CORBANA ZOMAC S.A.S.", margin + 6, y + 8);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("COMPROBANTE DE APLICACIÓN DE ASPERSIÓN", margin + 6, y + 14.5);
  doc.setFontSize(7);
  doc.text(emitido ? "EMITIDO" : "BORRADOR", pageWidth - margin - 6, y + 8, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(c.numero || "", pageWidth - margin - 6, y + 14.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 18 + 4;

  const base = {
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.5, halign: "center", cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 }, textColor: GRIS_TEXTO },
    margin: { left: margin, right: margin },
  };
  const ALTO_BANDA = 7;
  const etiqueta = (t) => ({ content: t, styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTO_BANDA, textColor: VERDE, fontSize: 7 } });

  // ── Finca / aplicación / fecha / semana ──
  bandaTitulo(doc, margin, y, contentWidth, ALTO_BANDA, VERDE_CLARO);
  autoTable(doc, {
    ...base,
    startY: y,
    body: [
      [etiqueta("FINCA"), etiqueta("APLICADO CON"), etiqueta("FECHA DE EJECUCIÓN"), etiqueta("SEMANA")],
      [
        { content: asp.finca?.nombre || "—", styles: { fontStyle: "bold" } },
        { content: MEDIO_LABEL[medio] || "—", styles: { fontStyle: "bold" } },
        { content: fechaLarga(c.ejecutadoEn), styles: { fontSize: 7.5 } },
        { content: asp.semana?.codigo || asp.semana?.numeroSemana || "—" },
      ],
    ],
  });
  bordeRedondeado(doc, margin, y, contentWidth, doc.lastAutoTable.finalY - y);
  y = doc.lastAutoTable.finalY + 3;

  // ── Mezcla ──
  const mezclaNombre = asp.mezcla?.nombre || asp.mezcla?.codigo || "—";
  doc.setFillColor(...VERDE_CLARO);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...VERDE);
  doc.text("MEZCLA APLICADA", pageWidth / 2, y + 5.5, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(mezclaNombre, pageWidth / 2, y + 11.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 16 + 3;

  // ── Hectáreas y galones ──
  bandaTitulo(doc, margin, y, contentWidth, ALTO_BANDA, VERDE_CLARO);
  autoTable(doc, {
    ...base,
    startY: y,
    body: [
      [etiqueta("HECTÁREAS PROGRAMADAS"), etiqueta("HECTÁREAS APLICADAS"), etiqueta("GALONES TOTALES DE LA MEZCLA")],
      [
        { content: numero(c.hectareasProgramadas), styles: { fontStyle: "bold", fontSize: 11 } },
        { content: numero(c.hectareasAplicadas), styles: { fontStyle: "bold", fontSize: 11 } },
        { content: numero(c.galonesTotales), styles: { fontStyle: "bold", fontSize: 11 } },
      ],
    ],
  });
  bordeRedondeado(doc, margin, y, contentWidth, doc.lastAutoTable.finalY - y);
  y = doc.lastAutoTable.finalY + 3;

  // ── Piloto ──
  bandaTitulo(doc, margin, y, contentWidth, ALTO_BANDA, VERDE_CLARO);
  autoTable(doc, {
    ...base,
    startY: y,
    body: [[etiqueta(etiquetaPiloto)], [{ content: c.piloto || "—", styles: { fontStyle: "bold", fontSize: 11 } }]],
  });
  bordeRedondeado(doc, margin, y, contentWidth, doc.lastAutoTable.finalY - y);
  y = doc.lastAutoTable.finalY + 3;

  // ── Insumos de la mezcla (sin cantidades) ──
  const insumos = c.insumos || [];
  const ALTO_TITULO = 8;
  bandaTitulo(doc, margin, y, contentWidth, ALTO_TITULO, VERDE);
  const mitad = Math.ceil(insumos.length / 2);
  const columna = (lista) => lista.map((i) => `•  ${i.nombre}${i.esPrincipal ? "  (principal)" : ""}`).join("\n");
  autoTable(doc, {
    ...base,
    startY: y,
    body: [
      [{ content: "INSUMOS DE LA MEZCLA", colSpan: 2, styles: { fontStyle: "bold", halign: "center", valign: "middle", minCellHeight: ALTO_TITULO, textColor: BLANCO, fontSize: 9 } }],
      insumos.length
        ? [
            { content: columna(insumos.slice(0, mitad)), styles: { halign: "left", fontSize: 8.5, cellPadding: { top: 4, right: 4, bottom: 4, left: 6 } } },
            { content: columna(insumos.slice(mitad)), styles: { halign: "left", fontSize: 8.5, cellPadding: { top: 4, right: 4, bottom: 4, left: 6 } } },
          ]
        : [{ content: "Sin insumos registrados.", colSpan: 2, styles: { halign: "center" } }],
    ],
  });
  bordeRedondeado(doc, margin, y, contentWidth, doc.lastAutoTable.finalY - y);
  y = doc.lastAutoTable.finalY + 3;

  // ── Observaciones ──
  if (c.observaciones) {
    bandaTitulo(doc, margin, y, contentWidth, ALTO_BANDA, VERDE_CLARO);
    autoTable(doc, {
      ...base,
      startY: y,
      body: [[etiqueta("OBSERVACIONES")], [{ content: c.observaciones, styles: { halign: "left", cellPadding: { top: 3, right: 4, bottom: 3, left: 4 } } }]],
    });
    bordeRedondeado(doc, margin, y, contentWidth, doc.lastAutoTable.finalY - y);
    y = doc.lastAutoTable.finalY + 3;
  }

  // ── Quién ejecutó (y quién emitió) ──
  const firma = (titulo, usuario, fecha) => [
    {
      content: nombreUsuario(usuario),
      styles: { halign: "center", valign: "middle", minCellHeight: 14, fontStyle: "bold", cellPadding: { top: 2, right: 3, bottom: 6, left: 3 } },
    },
    { titulo, usuario, fecha },
  ];
  const columnas = [firma("EJECUTÓ LA ASPERSIÓN", c.ejecutadoPor, c.ejecutadoEn)];
  if (emitido) columnas.push(firma("EMITIÓ EL COMPROBANTE", c.emitidoPor, c.emitidoEn));
  autoTable(doc, {
    ...base,
    startY: y,
    styles: { ...base.styles, lineColor: GRIS_BORDE },
    body: [
      columnas.map((col) => col[0]),
      columnas.map((col) => ({ content: col[1].titulo, styles: { fontStyle: "bold", halign: "center", fontSize: 7.5, fillColor: VERDE_CLARO, textColor: VERDE } })),
    ],
    didDrawCell: (data) => {
      if (data.row.index !== 0) return;
      const col = columnas[data.column.index];
      if (!col) return;
      const { usuario, fecha } = col[1];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...GRIS_SUAVE);
      const linea = [usuario?.cargo, fechaHora(fecha)].filter(Boolean).join(" · ");
      doc.text(linea, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height - 2.5, { align: "center" });
      doc.setTextColor(0, 0, 0);
    },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ── Pie ──
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRIS_SUAVE);
  doc.text(`Aspersión ${asp.numero || ""} · Generado automáticamente por Corbana — ${new Date().toLocaleDateString("es-CO")}`, margin, y + 4);
  doc.setTextColor(0, 0, 0);

  if (!emitido) marcaAgua(doc, "BORRADOR", [180, 83, 9]);

  return doc;
}

export function descargarComprobanteAspersionPdf(c) {
  generarComprobanteAspersionPdf(c).save(`Comprobante-Aspersion-${c.numero || c.uuid}.pdf`);
}

// Abre el comprobante en una pestaña nueva para solo verlo (sin descargar).
export function verComprobanteAspersionPdf(c) {
  window.open(generarComprobanteAspersionPdf(c).output("bloburl"), "_blank");
}

const comprobanteAspersionExport = { generarComprobanteAspersionPdf, descargarComprobanteAspersionPdf, verComprobanteAspersionPdf };
export default comprobanteAspersionExport;
