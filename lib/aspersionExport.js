import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Reproduce el formato físico "AVISO DE ASPERSIÓN PARA CONTROL DE ... EN
// BANANO" (código SGC-FO-AA-V1) que hoy se le entrega en papel a la finca —
// pedido explícito del módulo de Programación de Aspersiones. Se genera acá
// (jsPDF/autoTable, el backend nunca genera PDFs, ver visitaLaborExport.js)
// y se puede descargar o adjuntar al aviso por correo
// (aspersionProgramacion.service.js#enviarCorreo).
const TIPO_LABEL = {
  SIGATOKA_NEGRA: "SIGATOKA NEGRA",
  DEFOLIADOR: "DEFOLIADOR",
  FERTILIZACION: "FERTILIZACIÓN",
};

// Paleta — mismo verde de marca que el resto de la app (Sidebar/botones/
// correos transaccionales), para que el aviso se vea como parte del mismo
// sistema y no como una tabla gris genérica.
const VERDE = [22, 101, 52]; // #166534
const VERDE_CLARO = [240, 253, 244]; // #f0fdf4
const GRIS_BORDE = [226, 232, 240]; // #e2e8f0
const GRIS_TEXTO = [55, 65, 81]; // #374151
const GRIS_SUAVE = [148, 163, 184]; // #94a3b8
const BLANCO = [255, 255, 255];

// Casilla de verificación dibujada a mano (cuadrado redondeado + tilde en
// vectores) en vez de una "X" de texto — se ve como un checkbox real, no
// como un caracter suelto. `cx`/`cy` es el centro del área disponible.
function dibujarCasilla(doc, cx, cy, marcado) {
  const size = 4.6;
  const half = size / 2;
  const x = cx - half;
  const y = cy - half;

  if (marcado) {
    doc.setFillColor(...VERDE);
    doc.setDrawColor(...VERDE);
  } else {
    doc.setFillColor(...BLANCO);
    doc.setDrawColor(...GRIS_SUAVE);
  }
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, size, size, 0.8, 0.8, marcado ? "FD" : "S");

  if (marcado) {
    doc.setDrawColor(...BLANCO);
    doc.setLineWidth(0.6);
    doc.setLineCap("round");
    doc.line(x + size * 0.22, y + size * 0.52, x + size * 0.42, y + size * 0.72);
    doc.line(x + size * 0.42, y + size * 0.72, x + size * 0.82, y + size * 0.26);
  }
  doc.setDrawColor(0, 0, 0);
}

// Borde redondeado dibujado ALREDEDOR de una tabla ya renderizada (autoTable
// con theme "plain" no dibuja bordes por celda) — así el contenedor se ve
// como una sola tarjeta con esquinas redondeadas en vez de una grilla.
function dibujarContenedorRedondeado(doc, x, y, width, height) {
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, "S");
}

// Banda de encabezado (título en fondo de color) con las esquinas
// superiores redondeadas y las inferiores en escuadra — para que encaje
// justo arriba de la lista sin dejar una curva "flotando" a mitad de la
// tarjeta. Se dibuja ANTES de la tabla y la tabla solo pinta el texto
// encima (fillColor transparente en esa celda), en vez de que autoTable
// rellene un rectángulo cuadrado que compita con esta curva.
function dibujarEncabezadoRedondeado(doc, x, y, width, height, color) {
  const r = 2;
  doc.setFillColor(...color);
  doc.roundedRect(x, y, width, height, r, r, "F");
  // Reescuadra la mitad inferior de la banda (donde se une con la lista de
  // abajo) tapando la curva de esas dos esquinas con el mismo color.
  doc.rect(x, y + height - r, width, r, "F");
}

// Marca de agua diagonal semitransparente sobre toda la hoja — se dibuja al
// final (encima de todo lo demás) cuando la aspersión ya fue cancelada, para
// que el PDF (que puede haber quedado guardado o reenviado desde antes) no
// se confunda con un aviso vigente.
function dibujarMarcaAguaCancelado(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const texto = "CANCELADO";
  const anguloGrados = 35;

  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.14 }));
  doc.setTextColor(220, 38, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(80);

  // jsPDF no centra bien un texto que combina `align: "center"` con
  // `angle` (el desplazamiento de centrado se aplica ANTES de rotar, así
  // que el ancla queda corrida y el texto rotado se ve descentrado — se
  // vio como "CANCELADO" pegado a la izquierda en vez de en el centro de
  // la hoja). Se calcula a mano el punto de inicio para que el CENTRO del
  // texto (ya rotado) caiga exacto en el centro de la página, dibujando
  // sin `align` (texto alineado a la izquierda desde ese punto).
  const anguloRad = (anguloGrados * Math.PI) / 180;
  const anchoTexto = doc.getTextWidth(texto);
  const x = pageWidth / 2 - (anchoTexto / 2) * Math.cos(anguloRad);
  const y = pageHeight / 2 + (anchoTexto / 2) * Math.sin(anguloRad);
  doc.text(texto, x, y, { angle: anguloGrados });

  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return "—";
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const fecha = new Date(anio, (mes || 1) - 1, dia || 1);
  const texto = fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // "viernes, 14 de..." → "Viernes, 14 de..." — el día de la semana siempre
  // en mayúscula inicial (toLocaleDateString lo devuelve todo en minúscula).
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function generarAvisoAspersionPdf(aspersion) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;

  // `tipo` es un array — el aviso permite marcar varias casillas a la vez.
  const tipos = Array.isArray(aspersion.tipo) ? aspersion.tipo : [aspersion.tipo];
  const tipoLabel = tipos.map((t) => TIPO_LABEL[t] || t).join(" + ");
  const mezclaNombre = aspersion.mezcla?.nombre || aspersion.mezcla?.codigo || "—";
  const unidadSimbolo = aspersion.mezcla?.unidadRendimiento?.simbolo || "";
  // La dosis está en SU PROPIA unidad (dosisPorHectareaUnidad), que puede
  // ser distinta de la unidad de rendimiento de la mezcla (ej. dosis en
  // Galones aunque la mezcla rinda en Litros) — mostrarla con
  // `unidadSimbolo` (rendimiento) etiqueta mal el número.
  const dosisUnidadSimbolo = aspersion.mezcla?.dosisPorHectareaUnidad?.simbolo || unidadSimbolo;
  const dosis = aspersion.mezcla?.dosisPorHectarea != null ? Number(aspersion.mezcla.dosisPorHectarea) : null;

  let cursorY = margin;

  // ── Encabezado: banda verde de marca + título del aviso ──
  doc.setFillColor(...VERDE);
  doc.roundedRect(margin, cursorY, contentWidth, 18, 2, 2, "F");
  doc.setTextColor(...BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CORBANA ZOMAC S.A.S.", margin + 6, cursorY + 8);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`AVISO DE ASPERSIÓN PARA CONTROL DE ${tipoLabel} EN BANANO`, margin + 6, cursorY + 14.5);
  doc.setFontSize(7);
  doc.text("SGC-FO-AA-V1", pageWidth - margin - 6, cursorY + 8, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(aspersion.numero || "", pageWidth - margin - 6, cursorY + 14.5, { align: "right" });
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

  // ── Finca / código / fecha / semana ──
  const ALTURA_BANDA_LIGERA = 7;
  dibujarEncabezadoRedondeado(doc, margin, cursorY, contentWidth, ALTURA_BANDA_LIGERA, VERDE_CLARO);
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    body: [
      [
        { content: "FINCA", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "CÓDIGO", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "FECHA", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
        { content: "SEMANA", styles: { fontStyle: "bold", valign: "middle", minCellHeight: ALTURA_BANDA_LIGERA, textColor: VERDE, fontSize: 7 } },
      ],
      [
        { content: aspersion.finca?.nombre || "—", styles: { fontStyle: "bold" } },
        { content: aspersion.finca?.codigo || "—" },
        { content: formatearFecha(aspersion.fecha), styles: { fontSize: 7.5 } },
        { content: aspersion.semana?.codigo || aspersion.semana?.numeroSemana || "—" },
      ],
    ],
  });
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 3;

  // ── Tipo de aspersión: las tres casillas en una sola fila horizontal ──
  const celdasTipo = ["SIGATOKA_NEGRA", "DEFOLIADOR", "FERTILIZACION"];
  const etiquetasTipo = { SIGATOKA_NEGRA: "SIGATOKA NEGRA", DEFOLIADOR: "DEFOLIADOR", FERTILIZACION: "FERTILIZACIÓN" };
  const celdaTipo = (tipo) => {
    const marcado = tipos.includes(tipo);
    return [
      { content: etiquetasTipo[tipo], styles: { halign: "right", valign: "middle", fontStyle: marcado ? "bold" : "normal", textColor: marcado ? VERDE : GRIS_TEXTO } },
      { content: "", styles: { cellWidth: 12 } },
    ];
  };

  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    styles: { ...tableStyles.styles, fontSize: 9 },
    body: [[...celdaTipo("SIGATOKA_NEGRA"), ...celdaTipo("DEFOLIADOR"), ...celdaTipo("FERTILIZACION")]],
    didDrawCell: (data) => {
      // Columnas de casilla: índices 1, 3, 5 (par etiqueta+casilla × 3 tipos).
      if (![1, 3, 5].includes(data.column.index)) return;
      const tipo = celdasTipo[(data.column.index - 1) / 2];
      const cx = data.cell.x + data.cell.width / 2;
      const cy = data.cell.y + data.cell.height / 2;
      dibujarCasilla(doc, cx, cy, tipos.includes(tipo));
    },
  });
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 3;

  // ── Mezcla utilizada (debajo, ancho completo) ──
  // El aviso identifica la mezcla por su NOMBRE (lo que la finca reconoce),
  // no por el desglose interno de la receta (insumos) — eso es un detalle
  // de preparación, no de identificación del producto aplicado.
  // "Cantidad a preparar" se expresa en la MISMA unidad de la dosis (ej.
  // Galones), no en la de rendimiento de la mezcla — es la unidad en la que
  // el operador realmente piensa la dosis, aunque internamente
  // cantidadCalculada se guarde convertida a la unidad de rendimiento (ver
  // aspersionProgramacion.service.js#calcularCantidad).
  const cantidadAPreparar = dosis != null ? dosis * Number(aspersion.hectareas || 0) : Number(aspersion.cantidadCalculada || 0);
  const cantidadAPrepararUnidad = dosis != null ? dosisUnidadSimbolo : unidadSimbolo;
  const mezclaLineas = [
    { texto: "MEZCLA UTILIZADA", fontSize: 7, bold: true, color: VERDE },
    { texto: mezclaNombre, fontSize: 9.5, bold: true, color: GRIS_TEXTO },
    dosis ? { texto: `Dosis: ${dosis} ${dosisUnidadSimbolo}/ha`, fontSize: 8, bold: false, color: GRIS_TEXTO } : null,
    cantidadAPreparar
      ? { texto: `Cantidad a preparar: ${cantidadAPreparar.toFixed(2)} ${cantidadAPrepararUnidad}`, fontSize: 8, bold: false, color: GRIS_TEXTO }
      : null,
  ].filter(Boolean);

  const alturaMezclaBox = 6 + mezclaLineas.length * 5;
  doc.setFillColor(...VERDE_CLARO);
  doc.roundedRect(margin, cursorY, contentWidth, alturaMezclaBox, 2, 2, "F");
  let mezclaY = cursorY + 6;
  for (const linea of mezclaLineas) {
    doc.setFont("helvetica", linea.bold ? "bold" : "normal");
    doc.setFontSize(linea.fontSize);
    doc.setTextColor(...linea.color);
    doc.text(linea.texto, pageWidth / 2, mezclaY, { align: "center" });
    mezclaY += 5;
  }
  doc.setTextColor(0, 0, 0);
  cursorY += alturaMezclaBox + 3;

  // ── Instrucciones (texto fijo del formato original) ──
  const instrucciones = [
    "Si la aspersión no se realiza o queda inconclusa por algún motivo, se continuará al día siguiente. Avisar con anticipación a personal de la finca, habitantes y contratistas.",
    "No activar el sistema de riego hasta 4 horas después de finalizada la aspersión.",
    "Respetar el período de reentrada indicado en la ficha técnica del producto asperjado.",
    "Mantener el área libre de personal durante la fumigación, conforme a la norma vigente.",
    "Cubrir con plástico los tanques de almacenamiento de agua para consumo humano y animal.",
    "Guardar bajo techo la ropa, los alimentos y los utensilios que puedan contaminarse.",
  ];

  const ALTURA_BANDA = 8;
  dibujarEncabezadoRedondeado(doc, margin, cursorY, contentWidth, ALTURA_BANDA, VERDE);
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    body: [
      [{ content: "INSTRUCCIONES", styles: { fontStyle: "bold", halign: "center", valign: "middle", minCellHeight: ALTURA_BANDA, textColor: BLANCO, fontSize: 9 } }],
      [{ content: instrucciones.map((t) => `•  ${t}`).join("\n"), styles: { halign: "left", fontSize: 8, cellPadding: { top: 4, right: 4, bottom: 4, left: 4 } } }],
    ],
  });
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 4;

  // ── Condiciones climáticas (texto fijo del formato original) ──
  const condiciones = [
    "Humedad relativa mayor o igual al 70%.",
    "Temperatura en el interior de la plantación menor o igual a 30°C.",
    "Velocidad del viento menor o igual a 5 Km/h.",
    "Sin precipitación pluvial al momento de la aspersión.",
    "Sin neblina o bruma.",
  ];

  dibujarEncabezadoRedondeado(doc, margin, cursorY, contentWidth, ALTURA_BANDA, VERDE);
  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    body: [
      [{ content: "CONDICIONES CLIMÁTICAS PARA LA ASPERSIÓN", styles: { fontStyle: "bold", halign: "center", valign: "middle", minCellHeight: ALTURA_BANDA, textColor: BLANCO, fontSize: 9 } }],
      [{ content: condiciones.map((t) => `•  ${t}`).join("\n"), styles: { halign: "left", fontSize: 8, cellPadding: { top: 4, right: 4, bottom: 4, left: 4 } } }],
    ],
  });
  dibujarContenedorRedondeado(doc, margin, cursorY, contentWidth, doc.lastAutoTable.finalY - cursorY);
  cursorY = doc.lastAutoTable.finalY + 4;

  // ── Firmas ──
  // El cargo es el que el usuario tiene cargado en su perfil (Configuración
  // → Usuarios), no un texto fijo — ver aspersion.usuario.cargo (quien
  // programó) y aspersion.administradorFincaCargo (resuelto en el frontend
  // contra los usuarios asignados a la finca, ver aspersiones/page.js).
  // El nombre y el cargo van en la misma celda pero con distinto peso/color
  // (nombre en negrita oscura, cargo en gris claro) — autoTable no permite
  // dos estilos en un mismo texto, así que el cargo se dibuja aparte con
  // `didDrawCell` en vez de ir dentro de `content`.
  const cargosFirma = { 0: aspersion.usuario?.cargo || null, 1: aspersion.administradorFincaCargo || null };
  const filaFirma = (nombre) => ({
    content: nombre || "",
    styles: { halign: "center", valign: "middle", minCellHeight: 12, fontStyle: "bold", cellPadding: { top: 2, right: 3, bottom: 5, left: 3 } },
  });

  autoTable(doc, {
    ...tableStyles,
    startY: cursorY,
    styles: { ...tableStyles.styles, lineColor: GRIS_BORDE },
    body: [
      [filaFirma(aspersion.representanteCorbanaNombre), filaFirma(aspersion.administradorFincaNombre)],
      [
        { content: "REPRESENTANTE CORBANA", styles: { fontStyle: "bold", halign: "center", fontSize: 7.5, fillColor: VERDE_CLARO, textColor: VERDE } },
        { content: "REPRESENTANTE DE FINCA", styles: { fontStyle: "bold", halign: "center", fontSize: 7.5, fillColor: VERDE_CLARO, textColor: VERDE } },
      ],
    ],
    didDrawCell: (data) => {
      if (data.row.index !== 0) return;
      const cargo = cargosFirma[data.column.index];
      if (!cargo) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...GRIS_SUAVE);
      doc.text(cargo, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height - 3, { align: "center" });
      doc.setTextColor(0, 0, 0);
    },
  });
  cursorY = doc.lastAutoTable.finalY + 6;

  // ── Pie de página ──
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.2);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRIS_SUAVE);
  doc.text(
    `Generado automáticamente por Corbana — ${new Date().toLocaleDateString("es-CO")}`,
    margin,
    cursorY + 4,
  );
  doc.setTextColor(0, 0, 0);

  if (aspersion.estado === "CANCELADA") {
    dibujarMarcaAguaCancelado(doc);
  }

  return doc;
}

export function generarAvisoAspersionPdfBlob(aspersion) {
  const doc = generarAvisoAspersionPdf(aspersion);
  const nombre = `Aviso-Aspersion-${aspersion.numero || aspersion.uuid}.pdf`;
  return { blob: doc.output("blob"), nombre };
}

export function descargarAvisoAspersionPdf(aspersion) {
  const doc = generarAvisoAspersionPdf(aspersion);
  doc.save(`Aviso-Aspersion-${aspersion.numero || aspersion.uuid}.pdf`);
}

// Abre el aviso en una pestaña nueva del navegador para solo VERLO, sin
// forzar la descarga — el blob URL queda vivo mientras la pestaña esté
// abierta (no hace falta revocarlo acá, el navegador lo libera al
// cerrarla).
export function verAvisoAspersionPdf(aspersion) {
  const doc = generarAvisoAspersionPdf(aspersion);
  const url = doc.output("bloburl");
  window.open(url, "_blank");
}

const aspersionExport = { generarAvisoAspersionPdf, generarAvisoAspersionPdfBlob, descargarAvisoAspersionPdf, verAvisoAspersionPdf };
export default aspersionExport;
