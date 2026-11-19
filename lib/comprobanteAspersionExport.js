import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { renderMapaRecorrido } from "@/lib/mapaEstatico";
import { normalizarPerimetro } from "@/lib/kml";

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

// Coordenada decimal a grados, minutos y segundos (10° 44' 13,70" N).
function gms(valor, positivo, negativo) {
  if (valor === null || valor === undefined || valor === "") return null;
  const v = Number(valor);
  const a = Math.abs(v);
  const g = Math.floor(a);
  const m = Math.floor((a - g) * 60);
  const s = ((a - g) * 60 - m) * 60;
  return `${g}° ${m}' ${s.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}" ${v >= 0 ? positivo : negativo}`;
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

// `mapas`: imágenes (data URL) de los recorridos de la aplicación, una por KML del comprobante ([{ imagen, nombre, subidoEn }]);
// cada una va en su propia hoja después de la primera.
export function generarComprobanteAspersionPdf(c, { mapas = [] } = {}) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const asp = c.aspersion || {};
  const medio = c.medio || asp.medio;
  const etiquetaPiloto = `PILOTO DEL ${medio === "DRON" ? "DRON" : "AVIÓN"}`;
  const emitido = c.estado === "EMITIDO";
  const anulado = c.estado === "ANULADO";

  let y = margin;

  // ── Encabezado ──
  doc.setFillColor(...VERDE);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setTextColor(...BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CORBANA ZOMAC S.A.S.", margin + 6, y + 7);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("COMPROBANTE DE APLICACIÓN DE ASPERSIÓN", margin + 6, y + 12.8);
  doc.setFontSize(7);
  doc.text(anulado ? "ANULADO" : emitido ? "EMITIDO" : "BORRADOR", pageWidth - margin - 6, y + 7, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(c.numero || "", pageWidth - margin - 6, y + 12.8, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 16 + 3;

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
  // Compacto: todo, incluida la firma, cabe en la primera hoja.
  const GAP = 2;
  const ALTO_ENC = 5.5;
  const tam = (it) => (it.size || 10.5) * 0.88;
  const fila = (items) => {
    const total = items.reduce((a, it) => a + (it.ratio || 1), 0);
    // Columnas de igual ancho: un recuadro de N columnas también ocupa los N-1 espacios entre ellas (los bordes coinciden entre filas).
    const unidad = (contentWidth - GAP * (total - 1)) / total;
    const ancho = (it) => (it.ratio || 1) * unidad + ((it.ratio || 1) - 1) * GAP;
    // Alto del cuerpo: el mayor de los textos (envueltos) de la fila.
    const preparados = items.map((it) => {
      const w = ancho(it);
      doc.setFont("helvetica", it.normal ? "normal" : "bold");
      doc.setFontSize(tam(it));
      const lineas = doc.splitTextToSize(String(it.valor ?? "—"), w - 8);
      return { it, w, lineas, alto: Math.max(7.5, lineas.length * (tam(it) * 0.42) + 4) };
    });
    const altoCuerpo = Math.max(...preparados.map((p2) => p2.alto));
    // Si la fila no cabe en la hoja, sigue en una nueva.
    if (y + ALTO_ENC + altoCuerpo > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    let x = margin;
    for (const { it, w, lineas } of preparados) {
      const claro = Boolean(it.claro);
      // cuerpo + borde
      doc.setFillColor(...BLANCO);
      doc.roundedRect(x, y, w, ALTO_ENC + altoCuerpo, 2, 2, "F");
      // encabezado
      bandaTitulo(doc, x, y, w, ALTO_ENC, claro ? VERDE_CLARO : VERDE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(...(claro ? VERDE : BLANCO));
      doc.text(it.titulo, x + w / 2, y + ALTO_ENC / 2 + 1, { align: "center" });
      bordeRedondeado(doc, x, y, w, ALTO_ENC + altoCuerpo);
      // valor
      doc.setFont("helvetica", it.normal ? "normal" : "bold");
      doc.setFontSize(tam(it));
      doc.setTextColor(...GRIS_TEXTO);
      const alineado = it.izquierda ? "left" : "center";
      const tx = it.izquierda ? x + 4 : x + w / 2;
      const inicio = y + ALTO_ENC + (altoCuerpo - lineas.length * (tam(it) * 0.42)) / 2 + tam(it) * 0.3;
      doc.text(lineas, tx, inicio + 0.6, { align: alineado, lineHeightFactor: 1.15 });
      x += w + GAP;
    }
    doc.setTextColor(0, 0, 0);
    y += ALTO_ENC + altoCuerpo + GAP;
  };

  // Cuadrícula fija de 4 columnas: cada recuadro ocupa 1 o 2 columnas, así los bordes coinciden de una fila a otra.
  const vacio = (v) => v === null || v === undefined || v === "";
  const par = (a, b, fmt) => (vacio(a) && vacio(b) ? "—" : `${vacio(a) ? "—" : fmt(a)}  -  ${vacio(b) ? "—" : fmt(b)}`);
  const T = 9.5; // tamaño de los valores
  const lat = gms(asp.finca?.latitud, "N", "S");
  const lng = gms(asp.finca?.longitud, "E", "O");
  const principal = (c.insumos || []).find((i) => i.esPrincipal) || null;
  const unidadP = principal?.unidad?.simbolo || principal?.unidad?.nombre || "";
  const asistentes = (c.participantes || []).filter((p) => p.rol === "ASISTENTE").map((p) => p.colaborador?.nombre).filter(Boolean);
  const manipuladores = (c.manipuladores || []).filter((m) => m?.nombre);

  // ── Datos generales de la finca ──
  fila([
    { titulo: "FINCA", valor: asp.finca?.nombre || "—", claro: true, size: 10.5 },
    { titulo: "SEMANA", valor: asp.semana?.codigo || asp.semana?.numeroSemana || "—", claro: true, size: 10.5 },
    // La fecha en que estaba programada la aspersión (no el momento en que se registró la ejecución).
    { titulo: "FECHA DE EJECUCIÓN", valor: fechaLarga(asp.fecha ? `${String(asp.fecha).slice(0, 10)}T12:00:00-05:00` : c.ejecutadoEn), claro: true, size: 9 },
    { titulo: "CULTIVO", valor: "Banano", claro: true, size: 10.5 },
  ]);
  fila([
    { titulo: "COORDENADA GEOGRÁFICA", valor: lat && lng ? `Lat: ${lat}   Long: ${lng}` : "—", ratio: 2, claro: true, size: 9, normal: true },
    // Tipo (Dron o Avión) antes del nombre de la aeronave.
    { titulo: "AERONAVE", valor: c.aeronave ? `${MEDIO_LABEL[medio] ? `${MEDIO_LABEL[medio]} ` : ""}${c.aeronave}` : MEDIO_LABEL[medio] || "—", ratio: 2, claro: true, size: T },
  ]);
  fila([{ titulo: "MEZCLA APLICADA", valor: asp.mezcla?.nombre || asp.mezcla?.codigo || "—", claro: true, size: 10.5 }]);

  // ── Producto aplicado: el principal y, si hay, los secundarios (misma información) ──
  // Concentración (g/L) y dosis: las configuradas en el insumo, no las calculadas con la mezcla.
  const filaProducto = (ins, secundario) =>
    fila([
      { titulo: secundario ? "PLAGUICIDA SECUNDARIO" : "PLAGUICIDA APLICADO", valor: ins?.nombre || "—", size: T },
      { titulo: "INGREDIENTE ACTIVO", valor: (ins?.ingredientesActivos || []).join(", ") || "—", size: T },
      {
        titulo: "CONCENTRACIÓN I.A. (g/L)",
        valor: !vacio(ins?.concentracionIa) ? numero(ins.concentracionIa, 0) : !secundario && !vacio(c.concentracionIa) ? numero(c.concentracionIa, 0) : "—",
        size: T,
      },
      {
        titulo: `DOSIS (${ins?.dosisUnidad?.simbolo || ins?.dosisUnidad?.nombre || ins?.unidad?.simbolo || unidadP || "L"}/ha)`,
        valor: ins?.dosisPorHectarea != null ? numero(ins.dosisPorHectarea, 2) : "—",
        size: T,
      },
    ]);
  // Los insumos configurados «no mostrar» en la mezcla no salen.
  if (principal && principal.mostrarEnComprobante !== false) filaProducto(principal, false);
  for (const sec of (c.insumos || []).filter((i) => i.esSecundario && i.mostrarEnComprobante !== false)) filaProducto(sec, true);
  fila([
    { titulo: "HECTÁREAS APLICADAS", valor: numero(c.hectareasAplicadas), size: 11 },
    { titulo: "VOLUMEN POR HECTÁREA", valor: vacio(c.volumenAplicacionHa) ? "—" : `${numero(c.volumenAplicacionHa)} gal/ha`, size: 11 },
    { titulo: "HORA INICIO - FINAL", valor: par(c.horaInicio, c.horaFinal, (v) => v), ratio: 2, size: T },
  ]);

  // ── Equipo y operación ──
  fila([
    { titulo: etiquetaPiloto, valor: c.pilotoVisible?.nombre || c.pilotoColaborador?.nombre || c.piloto || "—", ratio: 4, size: T },
  ]);
  // Con dron: los asistentes del piloto (colaboradores).
  if (asistentes.length) fila([{ titulo: "ASISTENTES", valor: asistentes.join(", "), normal: true, size: T }]);
  // La pista solo aplica a las aspersiones con avión.
  const conAvion = medio !== "DRON";
  fila([
    ...(conAvion ? [{ titulo: "PISTA", valor: asp.pista?.nombre || "—", size: T }] : []),
    { titulo: "ALTURA DE VUELO", valor: c.alturaVuelo || "—", size: T },
    { titulo: "ANCHO DE DEPOSICIÓN", valor: vacio(c.anchoDeposicion) ? "—" : `${numero(c.anchoDeposicion, 1)} m`, size: T },
    { titulo: "TEMPERATURA INICIAL - FINAL", valor: par(c.temperaturaInicial, c.temperaturaFinal, (v) => `${numero(v, 1)} °C`), ratio: conAvion ? 1 : 2, size: T },
  ]);

  // ── Condiciones y seguridad ──
  fila([
    { titulo: "VELOCIDAD DEL VIENTO", valor: vacio(c.velocidadViento) ? "—" : `${numero(c.velocidadViento, 1)} km/h`, size: T },
    { titulo: "HUMEDAD RELATIVA FINAL", valor: vacio(c.humedadRelativaFinal) ? "—" : `${numero(c.humedadRelativaFinal, 1)} %`, size: T },
    { titulo: "TIEMPO DE REENTRADA", valor: vacio(c.tiempoReentrada) ? "—" : `${numero(c.tiempoReentrada, 0)} h`, size: T },
    { titulo: "TIEMPO DE CARENCIA", valor: vacio(c.tiempoCarencia) ? "—" : `${numero(c.tiempoCarencia, 0)} h`, size: T },
  ]);
  fila([
    // Quien aprueba (emite) el comprobante; mientras sea borrador, queda pendiente.
    { titulo: "PERSONA QUE AUTORIZA", valor: c.emitidoPor ? nombreUsuario(c.emitidoPor) : "Pendiente de aprobación", ratio: 2, size: T },
    {
      titulo: "MANIPULADORES DE PLAGUICIDAS",
      valor: manipuladores.length ? manipuladores.map((m) => `${m.nombre}${m.documento ? ` (CC ${m.documento})` : ""}`).join(", ") : "—",
      ratio: 2,
      normal: true,
      size: 9,
    },
  ]);

  // ── Aspersiones parciales ──
  if ((c.partes || []).length > 1) {
    c.partes.forEach((p, i) => {
      fila([
        { titulo: `PARTE ${i + 1}`, valor: p.aspersion || "—", ratio: 1, size: 9 },
        { titulo: "FECHA", valor: p.fecha, ratio: 1, size: 9 },
        { titulo: "HECTÁREAS", valor: numero(p.hectareas), ratio: 1, size: 9 },
        { titulo: "OBSERVACIONES", valor: p.observaciones || "—", normal: true, izquierda: true, ratio: 3, size: 8.5 },
      ]);
    });
  }

  // ── Observaciones ──
  if (c.observaciones) {
    fila([{ titulo: "OBSERVACIONES", valor: c.observaciones, normal: true, izquierda: true, size: 9 }]);
  }

  // ── Anulación (el documento anulado se conserva para auditoría) ──
  if (anulado) {
    fila([
      {
        titulo: "COMPROBANTE ANULADO",
        valor: `Motivo: ${c.motivoAnulacion || "—"} · ${fechaHora(c.anuladoEn)} · ${nombreUsuario(c.anuladoPor)}`,
        normal: true,
        izquierda: true,
        size: 9,
      },
    ]);
  }
  y += 1;

  // ── Quién ejecutó (y quién emitió) ──
  const firma = (titulo, usuario, fecha) => [
    {
      content: nombreUsuario(usuario),
      styles: { halign: "center", valign: "middle", minCellHeight: 10, fontStyle: "bold", cellPadding: { top: 1.5, right: 3, bottom: 4, left: 3 } },
    },
    { titulo, usuario, fecha },
  ];
  const columnas = [firma("EJECUTÓ LA ASPERSIÓN", c.ejecutadoPor, c.ejecutadoEn)];
  if (emitido) columnas.push(firma("EMITIÓ EL COMPROBANTE", c.emitidoPor, c.emitidoEn));
  if (anulado) columnas.push(firma("ANULÓ EL COMPROBANTE", c.anuladoPor, c.anuladoEn));
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

  // ── Una hoja por recorrido (KML) ──
  mapas.forEach(({ imagen: mapa, nombre: nombreKml, subidoEn }, iMapa) => {
    doc.addPage();
    let y2 = margin;
    doc.setFillColor(...VERDE);
    doc.roundedRect(margin, y2, contentWidth, 12, 2, 2, "F");
    doc.setTextColor(...BLANCO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(mapas.length > 1 ? `RECORRIDO DE LA APLICACIÓN (${iMapa + 1} DE ${mapas.length})` : "RECORRIDO DE LA APLICACIÓN", margin + 5, y2 + 7.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${c.numero || ""} · ${asp.finca?.nombre || ""}`, pageWidth - margin - 5, y2 + 7.8, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y2 += 16;
    // Imagen 16:11 a lo ancho de la hoja.
    const altoImg = contentWidth * (1100 / 1600);
    doc.addImage(mapa, "JPEG", margin, y2, contentWidth, altoImg);
    doc.setDrawColor(...GRIS_BORDE);
    doc.rect(margin, y2, contentWidth, altoImg);
    y2 += altoImg + 6;
    // Leyenda.
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_TEXTO);
    doc.setFillColor(239, 68, 68);
    doc.rect(margin, y2 - 2.5, 6, 1.6, "F");
    doc.text("Recorrido del KML", margin + 8, y2);
    doc.setDrawColor(100, 116, 139);
    doc.setLineDashPattern([1.5, 1], 0);
    doc.line(margin + 50, y2 - 1.7, margin + 56, y2 - 1.7);
    doc.setLineDashPattern([], 0);
    doc.text("Perímetro de la finca", margin + 58, y2);
    doc.setFillColor(250, 204, 21);
    doc.rect(margin + 100, y2 - 3, 6, 3, "F");
    doc.text("Área (polígonos del KML)", margin + 108, y2);
    y2 += 5;
    doc.setTextColor(...GRIS_SUAVE);
    doc.setFontSize(7);
    doc.text(`Archivo: ${nombreKml || "—"}${subidoEn ? ` · subido ${fechaHora(subidoEn)}` : ""}`, margin, y2);
    doc.setTextColor(0, 0, 0);
  });

  // Marca de agua en todas las hojas.
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    if (anulado) marcaAgua(doc, "ANULADO", [185, 28, 28]);
    else if (!emitido) marcaAgua(doc, "BORRADOR", [180, 83, 9]);
  }

  return doc;
}

// Imágenes de los mapas de los recorridos (uno por KML del comprobante), con el perímetro de la finca.
async function mapasDelComprobante(c) {
  const perimetro = normalizarPerimetro(c.aspersion?.finca?.perimetro);
  const kmls = (c.kmls || []).filter((k) => k.geometria);
  const salida = [];
  for (const k of kmls) {
    try {
      salida.push({ imagen: await renderMapaRecorrido({ geometria: k.geometria, perimetro }), nombre: k.nombre, subidoEn: k.subidoEn });
    } catch {
      // Sin mapa para ese recorrido: no se agrega su hoja.
    }
  }
  return salida;
}

// PDF (con el mapa) como Blob, para adjuntarlo al correo.
export async function generarComprobanteAspersionPdfBlob(c) {
  const mapas = await mapasDelComprobante(c);
  return { blob: generarComprobanteAspersionPdf(c, { mapas }).output("blob"), nombre: `Comprobante-Aspersion-${c.numero || c.uuid}.pdf` };
}

export async function descargarComprobanteAspersionPdf(c) {
  const mapas = await mapasDelComprobante(c);
  generarComprobanteAspersionPdf(c, { mapas }).save(`Comprobante-Aspersion-${c.numero || c.uuid}.pdf`);
}

// Abre el comprobante en una pestaña nueva para solo verlo (sin descargar).
export async function verComprobanteAspersionPdf(c) {
  // La pestaña se abre de una vez (antes de esperar el mapa) para que el navegador no la bloquee.
  const ventana = window.open("", "_blank");
  const mapas = await mapasDelComprobante(c);
  const url = generarComprobanteAspersionPdf(c, { mapas }).output("bloburl");
  if (ventana) ventana.location.href = url;
  else window.open(url, "_blank");
}

const comprobanteAspersionExport = { generarComprobanteAspersionPdf, descargarComprobanteAspersionPdf, verComprobanteAspersionPdf };
export default comprobanteAspersionExport;
