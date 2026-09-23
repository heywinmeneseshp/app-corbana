import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { parseFechaUTC } from "@/lib/fecha";
import { apiFetchBlob } from "@/lib/api";

// Reporte en PDF de una prueba de laboratorio de Mezclas — mismo sistema
// visual (paleta, bandas redondeadas, tarjetas) que
// app-corbana/lib/aspersionExport.js, para que todos los PDFs de la app se
// vean como parte del mismo producto. El backend nunca genera PDFs, se arma
// acá con los datos que ya trae la pantalla de la prueba (ver
// app/(app)/inventarios/mezclas/[uuid]/page.js).

const ESTADO_LABEL = {
  BORRADOR: "BORRADOR",
  EN_PRUEBA: "EN PRUEBA",
  OPTIMA: "ÓPTIMA / VÁLIDA",
  NO_VALIDA: "NO VÁLIDA",
  PENDIENTE_APROBACION: "PENDIENTE DE APROBACIÓN",
  CONVERTIDA: "CONVERTIDA EN ELABORADO",
};

// Paleta — mismo verde de marca que el resto de la app (idéntica a
// aspersionExport.js) para que ambos reportes se vean como el mismo sistema.
const VERDE = [22, 101, 52]; // #166534
const VERDE_CLARO = [240, 253, 244]; // #f0fdf4
const ROJO = [185, 28, 28]; // #b91c1c
const ROJO_CLARO = [254, 242, 242]; // #fef2f2
const GRIS_BORDE = [226, 232, 240]; // #e2e8f0
const GRIS_TEXTO = [55, 65, 81]; // #374151
const GRIS_SUAVE = [148, 163, 184]; // #94a3b8
const BLANCO = [255, 255, 255];

// Borde redondeado dibujado ALREDEDOR de una tabla ya renderizada (autoTable
// con theme "plain" no dibuja bordes por celda) — ver aspersionExport.js.
function dibujarContenedorRedondeado(doc, x, y, width, height) {
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, "S");
}

// Banda de encabezado con esquinas superiores redondeadas e inferiores en
// escuadra, dibujada ANTES de la tabla — ver aspersionExport.js.
function dibujarEncabezadoRedondeado(doc, x, y, width, height, color) {
  const r = 2;
  doc.setFillColor(...color);
  doc.roundedRect(x, y, width, height, r, r, "F");
  doc.rect(x, y + height - r, width, r, "F");
}

// Marca de agua diagonal semitransparente — mismo cálculo manual de
// centrado que aspersionExport.js#dibujarMarcaAguaCancelado (jsPDF no
// centra bien un texto con `align` + `angle` a la vez).
function dibujarMarcaAgua(doc, texto, colorRGB) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const anguloGrados = 35;

  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.12 }));
  doc.setTextColor(...colorRGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(70);

  const anguloRad = (anguloGrados * Math.PI) / 180;
  const anchoTexto = doc.getTextWidth(texto);
  const x = pageWidth / 2 - (anchoTexto / 2) * Math.cos(anguloRad);
  const y = pageHeight / 2 + (anchoTexto / 2) * Math.sin(anguloRad);
  doc.text(texto, x, y, { angle: anguloGrados });

  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

function formatearFechaHora(fechaIso) {
  if (!fechaIso) return "—";
  const fecha = parseFechaUTC(fechaIso);
  if (!fecha) return "—";
  return fecha.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

function nombreUsuario(u) {
  if (!u) return "—";
  return `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario || "—";
}

const INTERVALO_HOMOG_LABEL = { "15MIN": "15 minutos", "30MIN": "30 minutos", "60MIN": "1 hora" };

// Pie de foto: identifica de qué etapa/punto de control viene cada foto —
// pedido explícito ("que la siguiente página del PDF incluya las fotos con
// un pie que identifique de qué etapa proviene").
function pieDeFotoEtapa(etapa) {
  if (etapa.tipoEtapa === "CORRECCION_PH") {
    return `Etapa ${etapa.numero} — Corrección de pH`;
  }
  const insumo = etapa.componente?.articulo?.nombre;
  return `Etapa ${etapa.numero}${insumo ? ` — ${insumo}` : ""}`;
}

// Junta las fotos generales de la versión + las de cada etapa + las de cada
// punto de control de homogeneidad, ya con su pie de foto resuelto — mismo
// criterio de agrupación que `todasLasFotos` en la pantalla de la prueba
// (ver app/(app)/inventarios/mezclas/[uuid]/page.js).
function recolectarFotosConPie(version) {
  const fotos = [];
  for (const foto of version?.fotos || []) {
    fotos.push({ foto, pie: "Evidencia general" });
  }
  for (const etapa of version?.etapas || []) {
    for (const foto of etapa.fotos || []) {
      fotos.push({ foto, pie: pieDeFotoEtapa(etapa) });
    }
  }
  for (const h of version?.homogeneidad || []) {
    const label = INTERVALO_HOMOG_LABEL[h.intervalo] || h.intervalo;
    for (const foto of h.fotos || []) {
      fotos.push({ foto, pie: `Prueba de homogeneidad — ${label}` });
    }
  }
  return fotos;
}

// Descarga el blob de una foto y lo resuelve como dataURL + dimensiones
// naturales (necesarias para dibujarla en el PDF sin deformarla — jsPDF no
// calcula el aspect ratio solo).
function cargarFotoComoDataUrl(fotoUuid) {
  return apiFetchBlob(`/inventarios/mezclas/fotos/${fotoUuid}/archivo`)
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = () => {
            const dataUrl = reader.result;
            const img = new Image();
            img.onerror = () => reject(new Error("No se pudo leer la imagen"));
            img.onload = () => resolve({ dataUrl, width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
            img.src = dataUrl;
          };
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => null); // una foto que falle no debe tumbar el reporte entero
}

// Dibuja la sección de evidencia fotográfica SIEMPRE en página(s) nueva(s)
// (pedido explícito: "en la siguiente página") — una foto por celda, en
// grilla de 2 columnas, cada una con su pie de foto identificando la etapa
// o el punto de control de homogeneidad de donde proviene.
async function dibujarSeccionFotos(doc, version, { margin, contentWidth, pageWidth, pageHeight }) {
  const items = recolectarFotosConPie(version);
  if (!items.length) return;

  const cargadas = await Promise.all(items.map(({ foto }) => cargarFotoComoDataUrl(foto.uuid)));

  doc.addPage();
  let cursorY = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...VERDE);
  doc.text("EVIDENCIA FOTOGRÁFICA", margin, cursorY + 4);
  doc.setTextColor(0, 0, 0);
  cursorY += 10;

  const columnas = 2;
  const gap = 4;
  const celdaAncho = (contentWidth - gap * (columnas - 1)) / columnas;
  const imagenAlto = 62; // alto fijo de la caja de imagen (mm) — el ancho/alto real de cada foto se ajusta "contain" adentro
  const pieAlto = 6;
  const celdaAlto = imagenAlto + pieAlto + 4;

  let col = 0;
  let x = margin;
  for (let i = 0; i < items.length; i += 1) {
    const { pie } = items[i];
    const cargada = cargadas[i];

    if (cursorY + celdaAlto > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      col = 0;
      x = margin;
    }

    doc.setDrawColor(...GRIS_BORDE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cursorY, celdaAncho, imagenAlto, 2, 2, "S");

    if (cargada) {
      // "contain": la imagen se escala completa adentro de la caja sin
      // deformarse, centrada tanto horizontal como verticalmente.
      const escala = Math.min((celdaAncho - 4) / cargada.width, (imagenAlto - 4) / cargada.height);
      const wDibujo = cargada.width * escala;
      const hDibujo = cargada.height * escala;
      const xImg = x + (celdaAncho - wDibujo) / 2;
      const yImg = cursorY + (imagenAlto - hDibujo) / 2;
      try {
        doc.addImage(cargada.dataUrl, xImg, yImg, wDibujo, hDibujo, undefined, "FAST");
      } catch {
        // formato de imagen no soportado por jsPDF — se deja la caja vacía
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...GRIS_SUAVE);
      doc.text("No se pudo cargar la imagen", x + celdaAncho / 2, cursorY + imagenAlto / 2, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(pie, x + celdaAncho / 2, cursorY + imagenAlto + 4, { align: "center", maxWidth: celdaAncho });
    doc.setTextColor(0, 0, 0);

    col += 1;
    if (col >= columnas) {
      col = 0;
      x = margin;
      cursorY += celdaAlto;
    } else {
      x += celdaAncho + gap;
    }
  }
}

export async function generarReporteMezclaPdf(mezcla) {
  const version = mezcla.versiones?.[0];
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;

  const estadoLabel = ESTADO_LABEL[version?.estadoPrueba] || version?.estadoPrueba || "—";

  let cursorY = margin;

  // ── Encabezado: banda verde de marca + título del reporte ──
  doc.setFillColor(...VERDE);
  doc.roundedRect(margin, cursorY, contentWidth, 18, 2, 2, "F");
  doc.setTextColor(...BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CORBANA ZOMAC S.A.S.", margin + 6, cursorY + 8);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("REPORTE DE PRUEBA DE LABORATORIO — MEZCLAS", margin + 6, cursorY + 14.5);
  doc.setFontSize(7);
  doc.text("SGC-FO-PM-V1", pageWidth - margin - 6, cursorY + 8, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(mezcla.codigo || "", pageWidth - margin - 6, cursorY + 14.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  cursorY += 18 + 4;

  const tableStyles = {
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      halign: "center",
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      textColor: GRIS_TEXTO,
    },
    margin: { left: margin, right: margin },
  };

  // ── Nombre / Código / Estado / Almacén ──
  const ALTURA_BANDA_LIGERA = 7;
  dibujarEncabezadoRedondeado(doc, margin, cursorY, contentWidth, ALTURA_BANDA_LIGERA, VERDE_CLARO);
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    body: [
      [
        { content: "NOMBRE", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "CÓDIGO", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "ESTADO", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "ALMACÉN", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
      ],
      [
        { content: mezcla.nombre || "Sin nombre asignado", styles: { fontStyle: "bold", fontSize: 7.5 } },
        { content: mezcla.codigo || "—" },
        { content: estadoLabel, styles: { fontSize: 7.5 } },
        { content: version?.almacen?.nombre || "—" },
      ],
    ],
  });
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 3;

  // ── Parámetros y resultado ──
  const ALTURA_BANDA = 8;
  dibujarEncabezadoRedondeado(doc, margin, cursorY, contentWidth, ALTURA_BANDA, VERDE);
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    body: [
      [{ content: "PARÁMETROS Y RESULTADO FINAL", styles: { fontStyle: "bold", halign: "center", valign: "middle", minCellHeight: ALTURA_BANDA, textColor: BLANCO, fontSize: 9 } }],
      [
        {
          content:
            `pH final: ${version?.phFinal ?? "—"}  (rango ${version?.parametrosUsados?.phMinimo ?? "—"}–${version?.parametrosUsados?.phMaximo ?? "—"})\n` +
            `CE final: ${version?.ceFinal ?? "—"}  (máx. ${version?.parametrosUsados?.ceMaxima ?? "—"})\n` +
            `Documento de inventario: ${version?.movimientoDocumento || "—"}` +
            (version?.elaboracionGenerada?.documento ? `\nElaborado generado: ${version.elaboracionGenerada.documento}` : ""),
          styles: { halign: "left", fontSize: 8.5, cellPadding: { top: 4, right: 4, bottom: 4, left: 4 } },
        },
      ],
    ],
  });
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 4;

  // ── Componentes de la receta ──
  dibujarEncabezadoRedondeado(doc, margin, cursorY, contentWidth, ALTURA_BANDA, VERDE);
  const componentesBody = (version?.componentes || []).length
    ? version.componentes.map((c) => [
        c.articulo?.nombre || "—",
        Number(c.cantidad ?? 0).toFixed(2),
        c.unidad?.simbolo || "—",
      ])
    : [["Sin componentes registrados", "", ""]];
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY + ALTURA_BANDA,
    head: [["Artículo", "Cantidad", "Unidad"]],
    body: componentesBody,
    headStyles: { fillColor: VERDE_CLARO, textColor: VERDE, fontStyle: "bold", fontSize: 8 },
    columnStyles: { 0: { halign: "left" } },
  });
  // La banda del título y la tabla se dibujan como una sola tarjeta.
  doc.setFillColor(...VERDE);
  doc.roundedRect(margin, cursorY, contentWidth, ALTURA_BANDA, 2, 2, "F");
  doc.rect(margin, cursorY + ALTURA_BANDA - 2, contentWidth, 2, "F");
  doc.setTextColor(...BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("COMPONENTES DE LA RECETA", pageWidth / 2, cursorY + ALTURA_BANDA / 2 + 1.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 4;

  // ── Etapas de medición ──
  if (cursorY > 240) {
    doc.addPage();
    cursorY = margin;
  }
  const etapasBody = (version?.etapas || []).length
    ? version.etapas.map((et) => [
        String(et.numero),
        et.componente?.articulo?.nombre || "General",
        Number(et.ph).toFixed(2),
        Number(et.ce).toFixed(2),
        et.resultado === "CUMPLE" ? "Cumple" : "No cumple",
        formatearFechaHora(et.medidoEn),
        et.observaciones || "—",
      ])
    : [["—", "Sin etapas registradas", "", "", "", "", ""]];
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY + ALTURA_BANDA,
    head: [["#", "Componente", "pH", "CE", "Resultado", "Fecha", "Observaciones"]],
    body: etapasBody,
    headStyles: { fillColor: VERDE_CLARO, textColor: VERDE, fontStyle: "bold", fontSize: 7.5 },
    styles: { ...tableStyles.styles, fontSize: 7.5 },
    columnStyles: { 1: { halign: "left" }, 5: { fontSize: 6.8 }, 6: { halign: "left" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const cumple = data.cell.raw === "Cumple";
        data.cell.styles.textColor = cumple ? [4, 120, 87] : ROJO;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  doc.setFillColor(...VERDE);
  doc.roundedRect(margin, cursorY, contentWidth, ALTURA_BANDA, 2, 2, "F");
  doc.rect(margin, cursorY + ALTURA_BANDA - 2, contentWidth, 2, "F");
  doc.setTextColor(...BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ETAPAS DE MEDICIÓN", pageWidth / 2, cursorY + ALTURA_BANDA / 2 + 1.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 4;

  // ── Trazabilidad ──
  if (cursorY > 250) {
    doc.addPage();
    cursorY = margin;
  }
  dibujarEncabezadoRedondeado(doc, margin, cursorY, contentWidth, ALTURA_BANDA_LIGERA, VERDE_CLARO);
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    body: [
      [
        { content: "INICIADO POR", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "FINALIZADO", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "APROBADO POR", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
      ],
      [
        { content: `${nombreUsuario(version?.operador)}\n${formatearFechaHora(version?.created_at)}`, styles: { fontSize: 7 } },
        { content: version?.finalizadaEn ? formatearFechaHora(version.finalizadaEn) : "Pendiente" },
        {
          content: version?.aprobadaEn
            ? `${nombreUsuario(version.aprobadaPor)}\n${formatearFechaHora(version.aprobadaEn)}`
            : version?.estadoPrueba === "PENDIENTE_APROBACION"
              ? "Pendiente"
              : "—",
          styles: { fontSize: 7 },
        },
      ],
    ],
  });
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 6;

  // ── Pie de página ──
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.2);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRIS_SUAVE);
  doc.text(`Generado automáticamente por Corbana — ${new Date().toLocaleDateString("es-CO")}`, margin, cursorY + 4);
  doc.setTextColor(0, 0, 0);

  if (version?.estadoPrueba === "NO_VALIDA") {
    dibujarMarcaAgua(doc, "NO VÁLIDA", ROJO);
  } else if (version?.estadoPrueba === "OPTIMA") {
    dibujarMarcaAgua(doc, "ÓPTIMA", VERDE);
  }

  // Evidencia fotográfica: siempre arranca en página nueva, después de todo
  // lo anterior (pedido explícito) — se agrega al final para no interferir
  // con la lógica de paginado de las secciones de arriba.
  await dibujarSeccionFotos(doc, version, {
    margin,
    contentWidth,
    pageWidth,
    pageHeight: doc.internal.pageSize.getHeight(),
  });

  return doc;
}

export async function generarReporteMezclaPdfBlob(mezcla) {
  const doc = await generarReporteMezclaPdf(mezcla);
  const nombre = `Reporte-Prueba-${mezcla.codigo || mezcla.uuid}.pdf`;
  return { blob: doc.output("blob"), nombre };
}

export async function descargarReporteMezclaPdf(mezcla) {
  const doc = await generarReporteMezclaPdf(mezcla);
  doc.save(`Reporte-Prueba-${mezcla.codigo || mezcla.uuid}.pdf`);
}

// Abre el reporte en una pestaña nueva del navegador para solo VERLO, sin
// forzar la descarga — mismo patrón que verAvisoAspersionPdf.
export async function verReporteMezclaPdf(mezcla) {
  const doc = await generarReporteMezclaPdf(mezcla);
  const url = doc.output("bloburl");
  window.open(url, "_blank");
}

const mezclaReporteExport = { generarReporteMezclaPdf, generarReporteMezclaPdfBlob, descargarReporteMezclaPdf, verReporteMezclaPdf };
export default mezclaReporteExport;
