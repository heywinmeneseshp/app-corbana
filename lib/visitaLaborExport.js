import { bloquesObservacion } from "@/lib/textoObservacion";
import { jsPDF } from "jspdf";
import { cargarFirmaRecortada } from "@/lib/firmaRecortada";
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
// Mismo lenguaje visual que el comprobante de aspersión (franja verde, recuadros con título verde claro).
const VERDE = [22, 101, 52];
const VERDE_CLARO = [240, 253, 244];
const GRIS_TEXTO = [55, 65, 81];

// Franja de sección: verde con el título en blanco.
function bandaSeccion(doc, x, y, ancho, titulo) {
  doc.setFillColor(...VERDE);
  doc.roundedRect(x, y, ancho, 16, 3, 3, "F");
  doc.setFont(undefined, "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(titulo.toUpperCase(), x + 8, y + 11);
  doc.setTextColor(0);
  return y + 16 + 6;
}

// Fila de recuadros (título en franja verde clara + dato), como los del comprobante.
function filaDatos(doc, { marginX, pageWidth, cursorY, items }) {
  const gap = 6;
  const ancho = (pageWidth - marginX * 2 - gap * (items.length - 1)) / items.length;
  const altoTitulo = 13;
  const altoDato = 20;
  items.forEach((it, i) => {
    const x = marginX + i * (ancho + gap);
    doc.setFillColor(...VERDE_CLARO);
    doc.roundedRect(x, cursorY, ancho, altoTitulo, 3, 3, "F");
    doc.rect(x, cursorY + altoTitulo - 3, ancho, 3, "F");
    doc.setDrawColor(...COLOR_BORDE);
    doc.roundedRect(x, cursorY, ancho, altoTitulo + altoDato, 3, 3, "S");
    doc.setFont(undefined, "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...VERDE);
    doc.text(it.titulo.toUpperCase(), x + ancho / 2, cursorY + 9, { align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(...GRIS_TEXTO);
    const valor = doc.splitTextToSize(String(it.valor ?? "—"), ancho - 8)[0];
    doc.text(valor, x + ancho / 2, cursorY + altoTitulo + 13, { align: "center" });
  });
  doc.setTextColor(0);
  return cursorY + altoTitulo + altoDato + 8;
}

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
// Firma (PNG) de un usuario desde su perfil; null si no tiene o falla.
function cargarFirmaDataUrl(userUuid) {
  return cargarFirmaRecortada(`/auth/firmas/${userUuid}`);
}

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
  const altoTarjeta = 42;

  tarjetas.forEach((t, i) => {
    const x = marginX + i * (anchoTarjeta + gap);
    doc.setFillColor(...VERDE_CLARO);
    doc.roundedRect(x, cursorY, anchoTarjeta, 13, 3, 3, "F");
    doc.rect(x, cursorY + 10, anchoTarjeta, 3, "F");
    doc.setDrawColor(...COLOR_BORDE);
    doc.roundedRect(x, cursorY, anchoTarjeta, altoTarjeta, 3, 3, "S");

    doc.setFontSize(6.5);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...VERDE);
    doc.text(doc.splitTextToSize(t.titulo.toUpperCase(), anchoTarjeta - 10)[0], x + anchoTarjeta / 2, cursorY + 9, { align: "center" });
    doc.setTextColor(0);

    // alarmaSi=true (default, Hallazgos): "Sí" es lo alarmante (rojo).
    // alarmaSi=false (Cumplimiento de protocolos): al revés, "No" es lo
    // alarmante — cumplir el protocolo es lo normal, no cumplirlo es lo malo.
    const esAlarma = (t.alarmaSi ?? true) ? t.valor : !t.valor;
    drawPill(doc, x + anchoTarjeta / 2, cursorY + (t.detalle ? 22 : 26), t.valor ? "Sí" : "No", esAlarma ? COLOR_SI : COLOR_NO);

    if (t.detalle) {
      doc.setFontSize(7.5);
      doc.setFont(undefined, "normal");
      doc.setTextColor(108, 117, 125);
      const textoDetalle = doc.splitTextToSize(t.detalle, anchoTarjeta - 16);
      doc.text(textoDetalle[0], x + anchoTarjeta / 2, cursorY + 36, { align: "center" });
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
  const anchoContenido = pageWidth - marginX * 2;
  const aprobada = Boolean(visita.revisadoEn);
  // Salto de página cuando lo que sigue no cabe (antes todo después de las observaciones se dibujaba fuera de la hoja).
  const altoHoja = doc.internal.pageSize.getHeight();
  const asegurarEspacio = (alto) => {
    if (cursorY + alto > altoHoja - 40) {
      doc.addPage();
      cursorY = 50;
    }
  };

  // Franja verde del encabezado (como el comprobante de aspersión), con el logo sobre un cuadro blanco.
  doc.setFillColor(...VERDE);
  doc.roundedRect(marginX, cursorY - 20, anchoContenido, 44, 4, 4, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX + 8, cursorY - 14, 32, 32, 4, 4, "F");
  try {
    if (marca.logoUrl) {
      const formato = marca.logoUrl.match(/^data:image\/(\w+)/)?.[1]?.toUpperCase() || "PNG";
      doc.addImage(marca.logoUrl, formato, marginX + 10, cursorY - 12, 28, 28);
    } else {
      doc.addImage(await rasterizarLogo(), "PNG", marginX + 10, cursorY - 12, 28, 28);
    }
  } catch {
    // Sin logo si falla.
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, "bold");
  doc.setFontSize(12.5);
  doc.text(`VISITA DE SANIDAD VEGETAL — ${String(visita.fincaNombre || "").toUpperCase()}`, marginX + 48, cursorY - 1);
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  doc.text("EVALUACIÓN DE LABORES", marginX + 48, cursorY + 12);
  doc.setFontSize(7);
  doc.text(aprobada ? "APROBADA" : "PENDIENTE DE REVISIÓN", pageWidth - marginX - 10, cursorY - 1, { align: "right" });
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.text(visita.semanaCodigo || "", pageWidth - marginX - 10, cursorY + 12, { align: "right" });
  doc.setTextColor(0);
  cursorY += 32;

  cursorY = filaDatos(doc, {
    marginX,
    pageWidth,
    cursorY,
    items: [
      { titulo: "Finca", valor: visita.fincaNombre },
      { titulo: "Semana", valor: visita.semanaCodigo },
      { titulo: "Fecha", valor: visita.fecha },
      { titulo: "Evaluador", valor: visita.usuarioNombre },
    ],
  });

  if (visita.clima) {
    cursorY = filaDatos(doc, {
      marginX,
      pageWidth,
      cursorY,
      items: [
        { titulo: "Lluvia", valor: `${visita.clima.mm} mm` },
        { titulo: "Temperatura", valor: visita.clima.temperatura != null ? `${visita.clima.temperatura} °C` : "—" },
        { titulo: "Humedad relativa", valor: visita.clima.humedadRelativa != null ? `${visita.clima.humedadRelativa} %` : "—" },
      ],
    });
  }

  cursorY = bandaSeccion(doc, marginX, cursorY + 4, anchoContenido, "Estado fitosanitario por lote");

  autoTable(doc, {
    head: [["Lote", ...COLUMNAS.map((c) => c.label)]],
    body: visita.lotes.map((l) => [l.loteNombre, ...COLUMNAS.map((c) => l[c.key] || "")]),
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 5, minCellHeight: 18 },
    headStyles: { fillColor: VERDE_CLARO, textColor: VERDE, fontStyle: "bold", fontSize: 7.5, halign: "center" },
    bodyStyles: { textColor: GRIS_TEXTO },
    tableLineColor: COLOR_BORDE,
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
    // Observación de cada lote con estructura: el lote como encabezado, párrafos separados, títulos («Recomendaciones:») en
    // negrita y viñetas / puntos numerados con sangría (las líneas que siguen quedan alineadas con el texto, no con la viñeta).
    const anchoTexto = pageWidth - marginX * 2;
    const altoPagina = doc.internal.pageSize.getHeight();
    const LINEA = 11.5;
    const espacio = (alto) => {
      if (cursorY + alto > altoPagina - 40) {
        doc.addPage();
        cursorY = 50;
      }
    };
    // Aire entre la tabla de estados y el primer lote.
    cursorY += 6;
    cursorY = bandaSeccion(doc, marginX, cursorY, anchoContenido, "Observaciones por lote") + 6;
    observacionesLotes.forEach((l) => {
      espacio(30);
      // Título del lote en franja verde clara (como los recuadros del comprobante).
      doc.setFillColor(...VERDE_CLARO);
      doc.roundedRect(marginX, cursorY - 10, anchoTexto, 15, 3, 3, "F");
      doc.setFontSize(8.5);
      doc.setFont(undefined, "bold");
      doc.setTextColor(...VERDE);
      doc.text(`LOTE ${l.loteNombre}`, marginX + 8, cursorY);
      doc.setTextColor(...GRIS_TEXTO);
      cursorY += 17;
      doc.setFontSize(9);
      bloquesObservacion(l.observacion).forEach((b, i, todos) => {
        const sangria = b.tipo === "vineta" || b.tipo === "numero" ? 14 : 0;
        doc.setFont(undefined, b.tipo === "titulo" ? "bold" : "normal");
        const lineas = doc.splitTextToSize(b.texto, anchoTexto - sangria);
        if (b.tipo === "titulo") cursorY += 3;
        // Línea por línea: un párrafo puede ocupar más de una hoja y continúa en la siguiente.
        // Justificado salvo la última línea de cada párrafo y los títulos.
        espacio(Math.min(lineas.length, 2) * LINEA);
        if (sangria) doc.text(b.marca, marginX + 4, cursorY);
        lineas.forEach((linea, k) => {
          espacio(LINEA);
          doc.setTextColor(...GRIS_TEXTO);
          doc.setFont(undefined, b.tipo === "titulo" ? "bold" : "normal");
          doc.setFontSize(9);
          if (b.tipo !== "titulo" && k < lineas.length - 1) doc.text(linea, marginX + sangria, cursorY, { maxWidth: anchoTexto - sangria, align: "justify" });
          else doc.text(linea, marginX + sangria, cursorY);
          cursorY += LINEA;
        });
        // Más aire después de un párrafo que entre viñetas seguidas.
        const sigueLista = sangria && todos[i + 1] && (todos[i + 1].tipo === "vineta" || todos[i + 1].tipo === "numero");
        cursorY += b.tipo === "titulo" ? 1 : sigueLista ? 2 : 5;
      });
      cursorY += 6;
    });
    doc.setTextColor(0, 0, 0);
    cursorY += 4;
  }

  asegurarEspacio(110);
  cursorY = bandaSeccion(doc, marginX, cursorY, anchoContenido, "Hallazgos");
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

  asegurarEspacio(100);
  cursorY = bandaSeccion(doc, marginX, cursorY, anchoContenido, "Cumplimiento de protocolos de bioseguridad");
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
    asegurarEspacio(60);
    cursorY = bandaSeccion(doc, marginX, cursorY, anchoContenido, "Observación general de la visita") + 6;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...GRIS_TEXTO);
    // Por párrafos, para poder pasar de página si el texto es largo.
    String(visita.checklistObservacion)
      .split(/\n+/)
      .filter((t) => t.trim())
      .forEach((parrafo) => {
        doc.splitTextToSize(parrafo, anchoContenido).forEach((linea, i, lineas) => {
          asegurarEspacio(12);
          doc.setTextColor(...GRIS_TEXTO);
          if (i < lineas.length - 1) doc.text(linea, marginX, cursorY, { maxWidth: anchoContenido, align: "justify" });
          else doc.text(linea, marginX, cursorY);
          cursorY += 11.5;
        });
        cursorY += 4;
      });
    doc.setTextColor(0);
  }

  // Firmas: izquierda = revisor (rol configurable, solo si ya fue revisada),
  // derecha = quien registró la visita — ambas muestran el CARGO de la
  // persona, no su rol de permisos (ver laborCultural.service.js).
  asegurarEspacio(130);
  const firmaY = cursorY + 70;
  // Columnas: Revisó (izquierda), Registró y, si está configurada, la tercera firma en la esquina derecha.
  const tercera = visita.terceraFirma || null;
  const nCols = tercera ? 3 : 2;
  const colWidth = (pageWidth - marginX * 2) / nCols;
  const centro = (i) => marginX + colWidth * i + colWidth / 2;
  const medio = Math.min(90, colWidth / 2 - 8);

  // Firmas guardadas en el perfil de cada uno, sobre su línea.
  const [firmaRevisor, firmaAutor, firmaTercera] = await Promise.all([
    visita.revisadoEn && visita.revisadoPorUuid ? cargarFirmaDataUrl(visita.revisadoPorUuid) : null,
    visita.usuarioUuid ? cargarFirmaDataUrl(visita.usuarioUuid) : null,
    tercera?.uuid ? cargarFirmaDataUrl(tercera.uuid) : null,
  ]);
  const columnas = [
    { f: firmaRevisor, nombre: visita.revisadoEn ? visita.revisadoPorNombre || "—" : "Pendiente de revisión", cargo: visita.revisadoEn ? visita.revisadoPorCargo || "Revisor" : "", rotulo: "REVISÓ" },
    { f: firmaAutor, nombre: visita.usuarioNombre || "—", cargo: visita.usuarioCargo || "Evaluador", rotulo: "REGISTRÓ" },
    ...(tercera ? [{ f: firmaTercera, nombre: tercera.nombre || "—", cargo: tercera.cargo || "", rotulo: "VO. BO." }] : []),
  ];
  columnas.forEach((col, i) => {
    const cx = centro(i);
    if (col.f) {
      const alto = 44;
      const ancho = Math.min(medio * 2 - 10, (col.f.width / col.f.height) * alto);
      try {
        doc.addImage(col.f.dataUrl, "PNG", cx - ancho / 2, firmaY - alto - 2, ancho, alto);
      } catch {
        // Firma ilegible: se deja la línea sola.
      }
    }
    doc.setDrawColor(0);
    doc.line(cx - medio, firmaY, cx + medio, firmaY);
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text(doc.splitTextToSize(col.nombre, medio * 2)[0], cx, firmaY + 14, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setTextColor(100);
    doc.text(doc.splitTextToSize(col.cargo, medio * 2)[0] || "", cx, firmaY + 27, { align: "center" });
    doc.setFillColor(...VERDE_CLARO);
    doc.roundedRect(cx - medio, firmaY + 33, medio * 2, 13, 3, 3, "F");
    doc.setFont(undefined, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...VERDE);
    doc.text(col.rotulo, cx, firmaY + 42, { align: "center" });
  });
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
