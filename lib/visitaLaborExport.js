import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { obtenerMarca } from "./marca";
import { apiFetchBlob } from "./api";

const COLUMNAS = [
  { key: "controlMaleza", label: "Control de Maleza" },
  { key: "drenajes", label: "Drenajes" },
  { key: "desmache", label: "Desmache" },
  { key: "programaFertilizacion", label: "Prog. Fertilización" },
  { key: "fitosaneo", label: "Fitosaneo" },
  { key: "reduccionInoculo", label: "Reducción Inóculo" },
];

// Insignias de solo borde (sin relleno) — mismo color de referencia que los
// badges de Bootstrap del modal, pero como contorno para que el PDF se vea
// sobrio, no "lleno de colores".
const ESTADO_COLOR = {
  Hecho: [25, 135, 84],
  "En ejecucion": [180, 130, 0],
  Pendiente: [108, 117, 125],
};
const COLOR_SI = [220, 53, 69];
const COLOR_NO = [108, 117, 125];
const COLOR_BORDE = [222, 226, 230];

function drawPill(doc, centerX, centerY, texto, color) {
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  const anchoTexto = doc.getTextWidth(texto);
  const anchoPill = anchoTexto + 14;
  const altoPill = 14;
  const x = centerX - anchoPill / 2;
  const y = centerY - altoPill / 2;

  doc.setDrawColor(...color);
  doc.roundedRect(x, y, anchoPill, altoPill, altoPill / 2, altoPill / 2, "S");
  doc.setTextColor(...color);
  doc.text(texto, centerX, centerY + 3, { align: "center" });
  doc.setTextColor(0);
}

function drawTextoEstado(doc, centerX, centerY, texto, color) {
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...color);
  doc.text(texto, centerX, centerY + 3, { align: "center" });
  doc.setTextColor(0);
}

// El logo es un SVG inline (components/CorbanaLogo.js) y jsPDF no soporta
// SVG directamente — se rasteriza una vez en un <canvas> offscreen y se
// inserta como imagen PNG.
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 1 22 22" width="72" height="72">' +
  '<path d="M12 21C7 21 3 17.5 3 12.5C3 7 7.5 3 13 3C13 9 9.5 12.5 5 13.5C7.5 15.5 11 16 12 21Z" ' +
  'stroke="#198754" stroke-width="1.6" stroke-linejoin="round" fill="none"/></svg>';

function rasterizarLogo() {
  return new Promise((resolve, reject) => {
    const blob = new Blob([LOGO_SVG], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 72;
      canvas.height = 72;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 72, 72);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo generar el logo del PDF"));
    };
    img.src = url;
  });
}

// Trae una foto de la visita (autenticada, ver
// laborCultural.controller.js#obtenerFoto) y la convierte a data URL +
// dimensiones reales, para poder insertarla con addImage manteniendo su
// proporción original.
function cargarFotoComoDataUrl(fotoUuid) {
  return new Promise((resolve, reject) => {
    apiFetchBlob(`/labores-culturales/fotos/${fotoUuid}/archivo`)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("No se pudo procesar la foto"));
        };
        img.src = url;
      })
      .catch(reject);
  });
}

// Página(s) aparte al final del PDF con la evidencia fotográfica de la
// visita — cuadrícula de 2 columnas, cada foto conserva su proporción
// original (contain) dentro de la celda.
async function agregarPaginaFotos(doc, fotos) {
  const resultados = await Promise.allSettled(fotos.map((f) => cargarFotoComoDataUrl(f.uuid)));
  const cargadas = resultados
    .map((r, i) => (r.status === "fulfilled" ? { ...r.value, nombre: fotos[i].nombreOriginal } : null))
    .filter(Boolean);
  if (cargadas.length === 0) return;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const gap = 12;
  const columnas = 2;
  const anchoCelda = (pageWidth - marginX * 2 - gap * (columnas - 1)) / columnas;
  const altoCelda = 200;

  doc.addPage();
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text("Evidencia fotográfica", marginX, 40);

  let cursorY = 60;
  cargadas.forEach((foto, i) => {
    const col = i % columnas;
    if (col === 0 && i > 0) cursorY += altoCelda + gap + 14;
    if (cursorY + altoCelda > pageHeight - 30) {
      doc.addPage();
      cursorY = 40;
    }

    const x = marginX + col * (anchoCelda + gap);
    const escala = Math.min(anchoCelda / foto.width, altoCelda / foto.height);
    const w = foto.width * escala;
    const h = foto.height * escala;
    const imgX = x + (anchoCelda - w) / 2;

    doc.setDrawColor(...COLOR_BORDE);
    doc.roundedRect(x, cursorY, anchoCelda, altoCelda, 4, 4);
    doc.addImage(foto.dataUrl, "JPEG", imgX, cursorY + (altoCelda - h) / 2, w, h);

    if (foto.nombre) {
      doc.setFontSize(7.5);
      doc.setFont(undefined, "normal");
      doc.setTextColor(108, 117, 125);
      doc.text(foto.nombre, x + anchoCelda / 2, cursorY + altoCelda + 11, { align: "center", maxWidth: anchoCelda });
      doc.setTextColor(0);
    }
  });
}

// Dibuja las dos tarjetas de "Hallazgos" o de "Cumplimiento de protocolos",
// una junto a la otra, imitando las tarjetas con borde del modal
// (border rounded-3 p-3 d-flex justify-content-between).
function drawTarjetasPar(doc, { marginX, pageWidth, cursorY, tarjetas }) {
  const gap = 10;
  const anchoTarjeta = (pageWidth - marginX * 2 - gap) / 2;
  const altoTarjeta = 34;

  tarjetas.forEach((t, i) => {
    const x = marginX + i * (anchoTarjeta + gap);
    doc.setDrawColor(...COLOR_BORDE);
    doc.roundedRect(x, cursorY, anchoTarjeta, altoTarjeta, 4, 4);

    doc.setFontSize(8.5);
    doc.setFont(undefined, "bold");
    doc.setTextColor(33, 37, 41);
    const textoTitulo = doc.splitTextToSize(t.titulo, anchoTarjeta - 60);
    doc.text(textoTitulo, x + 8, cursorY + 13);
    doc.setTextColor(0);

    // alarmaSi=true (default, Hallazgos): "Sí" es lo alarmante (rojo).
    // alarmaSi=false (Cumplimiento de protocolos): al revés, "No" es lo
    // alarmante — cumplir el protocolo es lo normal, no cumplirlo es lo malo.
    const esAlarma = (t.alarmaSi ?? true) ? t.valor : !t.valor;
    drawPill(doc, x + anchoTarjeta - 28, cursorY + 13, t.valor ? "Sí" : "No", esAlarma ? COLOR_SI : COLOR_NO);

    if (t.detalle) {
      doc.setFontSize(7.5);
      doc.setFont(undefined, "normal");
      doc.setTextColor(108, 117, 125);
      const textoDetalle = doc.splitTextToSize(t.detalle, anchoTarjeta - 16);
      doc.text(textoDetalle, x + 8, cursorY + 25);
      doc.setTextColor(0);
    }
  });

  return cursorY + altoTarjeta + 14;
}

// Genera el mismo contenido que se ve en el modal de detalle de la visita
// (components/reportes/VisitaLaborModal.js) — 100% client-side, mismo
// patrón que lib/calendarExport.js (jsPDF + jspdf-autotable), sin tocar el
// backend. Devuelve el documento jsPDF ya armado (sin guardar/descargar
// todavía) — lo usan tanto downloadVisitaLaborPdf (que sí dispara la
// descarga) como el aviso por correo de "revisión aprobada" (que necesita
// los bytes del PDF para adjuntarlos, ver VisitaLaborModal.js).
async function construirVisitaLaborPdf(visita) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let cursorY = 45;

  const marca = await obtenerMarca();

  // El logo se centra verticalmente contra el bloque de título + subtítulo
  // (título en la línea base `cursorY`, subtítulo 18pt más abajo) — no
  // contra la línea base del título sola, que lo deja viendo desalineado
  // hacia arriba.
  const logoSize = 28;
  const logoY = cursorY - 9;

  try {
    if (marca.logoUrl) {
      // Logo subido en Configuración → Marca de la App — ya es un data URL
      // de imagen rasterizada (png/jpeg/webp), se usa directo.
      const formato = marca.logoUrl.match(/^data:image\/(\w+)/)?.[1]?.toUpperCase() || "PNG";
      doc.addImage(marca.logoUrl, formato, marginX, logoY, logoSize, logoSize);
    } else {
      const logoDataUrl = await rasterizarLogo();
      doc.addImage(logoDataUrl, "PNG", marginX, logoY, logoSize, logoSize);
    }
  } catch {
    // Si el logo falla (navegador sin soporte, imagen corrupta), se sigue sin él.
  }
  const textoX = marginX + logoSize + 8;

  doc.setFontSize(15);
  doc.setFont(undefined, "bold");
  doc.text(`Visita Sanidad y Vegetal — ${visita.fincaNombre}`, textoX, cursorY);
  cursorY += 18;

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100);
  doc.text(`Semana ${visita.semanaCodigo} · ${visita.fecha}`, textoX, cursorY);
  doc.setTextColor(0);
  cursorY += 14;
  doc.setDrawColor(...COLOR_BORDE);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 20;

  if (visita.clima) {
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Condiciones climáticas", marginX, cursorY);
    cursorY += 14;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    const partes = [`${visita.clima.mm} mm`];
    if (visita.clima.temperatura != null) partes.push(`${visita.clima.temperatura} °C`);
    if (visita.clima.humedadRelativa != null) partes.push(`${visita.clima.humedadRelativa}% HR`);
    doc.text(partes.join("   ·   "), marginX, cursorY);
    cursorY += 20;
  }

  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Estado fitosanitario por lote", marginX, cursorY);
  cursorY += 8;

  autoTable(doc, {
    head: [["Lote", ...COLUMNAS.map((c) => c.label)]],
    body: visita.lotes.map((l) => [l.loteNombre, ...COLUMNAS.map((c) => l[c.key] || "")]),
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 5, minCellHeight: 18 },
    headStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: "bold" },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index === 0) return;
      const estado = data.cell.raw;
      const color = ESTADO_COLOR[estado];
      if (!color) return;
      const cx = data.cell.x + data.cell.width / 2;
      const cy = data.cell.y + data.cell.height / 2;
      drawTextoEstado(data.doc, cx, cy, estado, color);
    },
  });
  cursorY = doc.lastAutoTable.finalY + 12;

  const observacionesLotes = visita.lotes.filter((l) => l.observacion);
  if (observacionesLotes.length > 0) {
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    observacionesLotes.forEach((l) => {
      const texto = doc.splitTextToSize(`${l.loteNombre}: ${l.observacion}`, pageWidth - marginX * 2);
      doc.text(texto, marginX, cursorY);
      cursorY += texto.length * 11 + 3;
    });
    cursorY += 8;
  }

  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Hallazgos", marginX, cursorY);
  cursorY += 10;
  cursorY = drawTarjetasPar(doc, {
    marginX,
    pageWidth,
    cursorY,
    tarjetas: [
      {
        titulo: "Vigilancia Moko",
        valor: visita.mokoPresente,
        detalle: visita.mokoPresente && visita.mokoLotes?.length > 0
          ? `Lotes: ${visita.mokoLotes.map((l) => l.loteNombre).join(", ")}`
          : "",
      },
      {
        titulo: "Vigilancia Fusarium Oxysporum Cubense R4",
        valor: visita.fusariumPresente,
        detalle: visita.fusariumPresente && visita.fusariumLotes?.length > 0
          ? `Lotes: ${visita.fusariumLotes.map((l) => l.loteNombre).join(", ")}`
          : "",
      },
    ],
  });

  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Cumplimiento de protocolos de bioseguridad", marginX, cursorY);
  cursorY += 10;
  cursorY = drawTarjetasPar(doc, {
    marginX,
    pageWidth,
    cursorY,
    tarjetas: [
      { titulo: "FOC-R4 (Ley 2081 del 2024)", valor: visita.cumpleProtocoloFocR4, alarmaSi: false },
      { titulo: "Moko (Resolución ICA 1468 del 2013)", valor: visita.cumpleProtocoloMoko, alarmaSi: false },
    ],
  });

  if (visita.checklistObservacion) {
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Observaciones y/o plan de acción", marginX, cursorY);
    cursorY += 14;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    const texto = doc.splitTextToSize(visita.checklistObservacion, pageWidth - marginX * 2);
    doc.text(texto, marginX, cursorY);
    cursorY += texto.length * 11;
  }

  // Firmas: izquierda = revisor (rol configurable, solo si ya fue revisada),
  // derecha = quien registró la visita — ambas muestran el CARGO de la
  // persona, no su rol de permisos (ver laborCultural.service.js).
  const firmaY = cursorY + 45;
  const colWidth = (pageWidth - marginX * 2) / 2;
  const colIzqCenter = marginX + colWidth / 2;
  const colDerCenter = marginX + colWidth + colWidth / 2;

  doc.setDrawColor(0);
  doc.line(colIzqCenter - 90, firmaY, colIzqCenter + 90, firmaY);
  doc.line(colDerCenter - 90, firmaY, colDerCenter + 90, firmaY);

  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text(visita.revisadoEn ? visita.revisadoPorNombre || "—" : "Pendiente de revisión", colIzqCenter, firmaY + 14, { align: "center" });
  doc.text(visita.usuarioNombre || "—", colDerCenter, firmaY + 14, { align: "center" });

  doc.setFont(undefined, "normal");
  doc.setTextColor(100);
  doc.text(visita.revisadoEn ? visita.revisadoPorCargo || "Revisor" : "", colIzqCenter, firmaY + 27, { align: "center" });
  doc.text(visita.usuarioCargo || "Responsable", colDerCenter, firmaY + 27, { align: "center" });
  doc.setTextColor(0);

  if (visita.fotos?.length > 0) {
    await agregarPaginaFotos(doc, visita.fotos);
  }

  return doc;
}

function nombreArchivoPdf(visita) {
  return `visita_sanidad_vegetal_${visita.fincaNombre}_${visita.fecha}.pdf`;
}

export async function downloadVisitaLaborPdf(visita) {
  const doc = await construirVisitaLaborPdf(visita);
  doc.save(nombreArchivoPdf(visita));
}

// Para adjuntar el PDF a un correo (ver handleMarcarRevisada en
// VisitaLaborModal.js) — mismo documento, pero devuelto como Blob en vez de
// descargarse.
export async function generarVisitaLaborPdfBlob(visita) {
  const doc = await construirVisitaLaborPdf(visita);
  return { blob: doc.output("blob"), nombre: nombreArchivoPdf(visita) };
}
