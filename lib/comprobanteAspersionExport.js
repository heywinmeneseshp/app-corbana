import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// PDF del "Comprobante de aplicación" de una aspersión ejecutada (Sanidad
// Vegetal → Comprobante de aspersiones). Mismo lenguaje visual que el aviso
// de aspersión (ver aspersionExport.js): se genera acá con jsPDF/autoTable,
// el backend nunca genera PDFs.
//
// Muestra: mezcla, hectáreas aplicadas, avión o dron, piloto,
// y quién ejecutó la aspersión. Un BORRADOR lleva marca de
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
  // Encabezado con fondo verde y letras blancas (Hectáreas aplicadas, Piloto, Observaciones).
  const etiquetaVerde = (t) => ({ content: t, styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTO_BANDA, textColor: BLANCO, fontSize: 7 } });

  // ── Tarjetas: encabezado (verde o verde claro) + cuerpo con el dato ──
  const GAP = 3;
  const ALTO_ENC = 6.5;
  const fila = (items) => {
    const total = items.reduce((a, it) => a + (it.ratio || 1), 0);
    const ancho = (it) => ((contentWidth - GAP * (items.length - 1)) * (it.ratio || 1)) / total;
    // Alto del cuerpo: el mayor de los textos (envueltos) de la fila.
    const preparados = items.map((it) => {
      const w = ancho(it);
      doc.setFont("helvetica", it.normal ? "normal" : "bold");
      doc.setFontSize(it.size || 10.5);
      const lineas = doc.splitTextToSize(String(it.valor ?? "—"), w - 8);
      return { it, w, lineas, alto: Math.max(10, lineas.length * ((it.size || 10.5) * 0.42) + 6) };
    });
    const altoCuerpo = Math.max(...preparados.map((p2) => p2.alto));
    let x = margin;
    for (const { it, w, lineas } of preparados) {
      const claro = Boolean(it.claro);
      // cuerpo + borde
      doc.setFillColor(...BLANCO);
      doc.roundedRect(x, y, w, ALTO_ENC + altoCuerpo, 2, 2, "F");
      // encabezado
      bandaTitulo(doc, x, y, w, ALTO_ENC, claro ? VERDE_CLARO : VERDE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...(claro ? VERDE : BLANCO));
      doc.text(it.titulo, x + w / 2, y + ALTO_ENC / 2 + 1.1, { align: "center" });
      bordeRedondeado(doc, x, y, w, ALTO_ENC + altoCuerpo);
      // valor
      doc.setFont("helvetica", it.normal ? "normal" : "bold");
      doc.setFontSize(it.size || 10.5);
      doc.setTextColor(...GRIS_TEXTO);
      const alineado = it.izquierda ? "left" : "center";
      const tx = it.izquierda ? x + 4 : x + w / 2;
      const inicio = y + ALTO_ENC + (altoCuerpo - lineas.length * ((it.size || 10.5) * 0.42)) / 2 + (it.size || 10.5) * 0.3;
      doc.text(lineas, tx, inicio + 0.6, { align: alineado, lineHeightFactor: 1.15 });
      x += w + GAP;
    }
    doc.setTextColor(0, 0, 0);
    y += ALTO_ENC + altoCuerpo + GAP;
  };

  // ── Finca / semana / fecha / aeronave ──
  fila([
    { titulo: "FINCA", valor: asp.finca?.nombre || "—", ratio: 3, claro: true },
    { titulo: "SEMANA", valor: asp.semana?.codigo || asp.semana?.numeroSemana || "—", ratio: 1.6, claro: true },
    { titulo: "FECHA DE EJECUCIÓN", valor: fechaLarga(c.ejecutadoEn), ratio: 3.6, claro: true, size: 9 },
    { titulo: "AERONAVE", valor: c.aeronave || MEDIO_LABEL[medio] || "—", ratio: 3.2, claro: true, size: 9 },
  ]);

  // ── Mezcla ──
  fila([{ titulo: "MEZCLA APLICADA", valor: asp.mezcla?.nombre || asp.mezcla?.codigo || "—", claro: true, size: 10.5 }]);

  // ── Aplicación: hectáreas, volumen y piloto ──
  const vacio = (v) => v === null || v === undefined || v === "";
  const par = (a, b, fmt) => (vacio(a) && vacio(b) ? "—" : `${vacio(a) ? "—" : fmt(a)}  -  ${vacio(b) ? "—" : fmt(b)}`);
  fila([
    { titulo: "HECTÁREAS APLICADAS", valor: numero(c.hectareasAplicadas), ratio: 2, size: 13 },
    { titulo: "VOLUMEN DE APLICACIÓN POR HECTÁREA", valor: vacio(c.volumenAplicacionHa) ? "—" : `${numero(c.volumenAplicacionHa)} gal/ha`, ratio: 3, size: 13 },
    { titulo: etiquetaPiloto, valor: c.piloto || "—", ratio: 4, size: 10.5 },
  ]);

  // ── Condiciones y horario ──
  fila([
    { titulo: "TEMPERATURA INICIAL - FINAL", valor: par(c.temperaturaInicial, c.temperaturaFinal, (v) => `${numero(v, 1)} °C`), ratio: 1.15, size: 10.5 },
    { titulo: "VELOCIDAD DEL VIENTO", valor: vacio(c.velocidadViento) ? "—" : `${numero(c.velocidadViento, 1)} km/h`, ratio: 1, size: 10.5 },
    { titulo: "HUMEDAD RELATIVA FINAL", valor: vacio(c.humedadRelativaFinal) ? "—" : `${numero(c.humedadRelativaFinal, 1)} %`, ratio: 1, size: 10.5 },
    { titulo: "HORA INICIO - FINAL", valor: par(c.horaInicio, c.horaFinal, (v) => v), ratio: 1, size: 10.5 },
  ]);

  // ── Observaciones ──
  if (c.observaciones) {
    fila([{ titulo: "OBSERVACIONES", valor: c.observaciones, normal: true, izquierda: true, size: 9 }]);
  }
  y += 1;

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
