// PDF del detalle de una aspersión (lo mismo que muestra el modal de Programación de Aspersiones al hacer clic en la fila):
// datos de la programación, receta con dosis por hectárea y cantidades, observaciones y revisión. Mismo estilo que el aviso
// (banda verde de encabezado, franjas verde claro) — ver aspersionExport.js.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const VERDE = [22, 101, 52];
const VERDE_CLARO = [240, 253, 244];
const GRIS_BORDE = [226, 232, 240];
const GRIS_TEXTO = [55, 65, 81];
const GRIS_SUAVE = [148, 163, 184];
const BLANCO = [255, 255, 255];

const MEDIO_LABEL = { AVION: "Avión", DRON: "Dron" };
const TIPO_LABEL = { SIGATOKA_NEGRA: "Sigatoka Negra", DEFOLIADOR: "Defoliador", FERTILIZACION: "Fertilización" };
const ESTADO_LABEL = { PROGRAMADA: "Programada", EJECUTADA: "Ejecutada", CANCELADA: "Cancelada" };

const num = (v, dec = 2) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: dec });
const nombreUsuario = (u) => (u ? [u.nombre, u.apellido].filter(Boolean).join(" ") || u.usuario : "—");
const fechaHora = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
};

export function generarDetalleAspersionPdf(a) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const ancho = pageWidth - margin * 2;
  let y = margin;
  const hectareas = Number(a.hectareas) || 0;
  const ejecutada = a.estado === "EJECUTADA";

  // ── Encabezado ──
  doc.setFillColor(...VERDE);
  doc.roundedRect(margin, y, ancho, 18, 2, 2, "F");
  doc.setTextColor(...BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CORBANA ZOMAC S.A.S.", margin + 6, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("DETALLE DE PROGRAMACIÓN DE ASPERSIÓN", margin + 6, y + 14.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(a.numero || "", pageWidth - margin - 6, y + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(ESTADO_LABEL[a.estado] || a.estado || "", pageWidth - margin - 6, y + 14.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 22;

  const titulo = (texto) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...VERDE);
    doc.text(texto, margin, y + 3);
    doc.setTextColor(0, 0, 0);
    y += 5;
  };

  // Rejilla de datos: cada fila es una lista de celdas [etiqueta, valor, columnas que ocupa (de 4)]; la etiqueta va arriba
  // (verde claro) y el valor abajo.
  const rejilla = (filas) => {
    const body = [];
    for (const fila of filas) {
      body.push(
        fila.map(([etq, , span = 1]) => ({
          content: etq,
          colSpan: span,
          styles: { fontStyle: "bold", fontSize: 6.5, textColor: VERDE, fillColor: VERDE_CLARO, cellPadding: { top: 1.5, bottom: 1, left: 2.5, right: 2.5 } },
        })),
      );
      body.push(
        fila.map(([, val, span = 1]) => ({
          content: val ?? "—",
          colSpan: span,
          styles: { fontSize: 8.5, textColor: GRIS_TEXTO, cellPadding: { top: 1.2, bottom: 2.2, left: 2.5, right: 2.5 } },
        })),
      );
    }
    autoTable(doc, {
      startY: y,
      theme: "plain",
      body,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", lineColor: GRIS_BORDE },
      columnStyles: Object.fromEntries([0, 1, 2, 3].map((i) => [i, { cellWidth: ancho / 4 }])),
    });
    doc.setDrawColor(...GRIS_BORDE);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, ancho, doc.lastAutoTable.finalY - y, 2, 2, "S");
    y = doc.lastAutoTable.finalY + 5;
  };

  titulo("PROGRAMACIÓN");
  rejilla([
    [
      ["FINCA", a.finca?.nombre || "—"],
      ["SEMANA", a.semana?.codigo || "—"],
      ["FECHA PROGRAMADA", a.fecha || "—"],
      ["FECHA DE EJECUCIÓN", a.fechaEjecucion || "—"],
    ],
    [
      ["MEZCLA", a.mezcla?.nombre || a.mezcla?.codigo || "—", 3],
      ["TIPO", Array.isArray(a.tipo) && a.tipo.length ? a.tipo.map((t) => TIPO_LABEL[t] || t).join(", ") : "—"],
    ],
    [
      ["VEHÍCULO", MEDIO_LABEL[a.medio] || "—"],
      ["PISTA", a.pista?.nombre || "—"],
      ["HECTÁREAS", `${num(hectareas)} ha`],
      ["CANTIDAD A PREPARAR", a.cantidadCalculada != null ? `${num(a.cantidadCalculada)} ${a.mezcla?.unidadRendimiento?.simbolo || ""}` : "—"],
    ],
    [
      ["ALMACÉN", a.almacen?.nombre || "—", 2],
      ["INTERVALO DESDE LA ANTERIOR", a.diasDesdeUltima != null ? `${a.diasDesdeUltima} días` : "—", 2],
    ],
  ]);

  titulo("RESPONSABLES");
  rejilla([
    [
      ["REPRESENTANTE CORBANA", a.representanteCorbanaNombre || "—"],
      ["ADMINISTRADOR DE FINCA", a.administradorFincaNombre || "—"],
      ["PROGRAMÓ", nombreUsuario(a.usuario)],
      ["REVISADO POR", a.revisadoPor ? `${nombreUsuario(a.revisadoPor)}\n${fechaHora(a.revisadoEn)}` : "Sin revisar"],
    ],
  ]);

  titulo(`RECETA Y CANTIDADES ${ejecutada ? "UTILIZADAS" : "A UTILIZAR"}`);
  const componentes = a.componentes || [];
  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [["INSUMO", "UNIDAD", "DOSIS POR HECTÁREA", ejecutada ? "CANTIDAD UTILIZADA" : "CANTIDAD"]],
    body: componentes.length
      ? componentes.map((c) => {
          const s = c.unidad?.simbolo || "";
          return [
            c.articulo?.nombre || "—",
            s || c.unidad?.nombre || "—",
            c.cantidad != null && hectareas > 0 ? `${num(Number(c.cantidad) / hectareas, 2)} ${s}/ha` : "—",
            c.cantidad != null ? `${num(c.cantidad, 4)} ${s}` : "—",
          ];
        })
      : [[{ content: "Sin insumos guardados.", colSpan: 4, styles: { halign: "center", textColor: GRIS_SUAVE } }]],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 8.5, textColor: GRIS_TEXTO, cellPadding: 2, lineColor: GRIS_BORDE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: VERDE_CLARO, textColor: VERDE, fontStyle: "bold", fontSize: 7 },
    columnStyles: { 0: { fontStyle: "bold" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index >= 2) data.cell.styles.halign = "right";
    },
  });
  y = doc.lastAutoTable.finalY + 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRIS_SUAVE);
  doc.text(
    ejecutada
      ? `Cantidades definitivas: las que se descontaron del inventario al ejecutar (${num(hectareas)} ha).`
      : `Cantidades para ${num(hectareas)} ha; se descuentan del inventario al ejecutar.`,
    margin,
    y + 3,
  );
  doc.setTextColor(0, 0, 0);
  y += 9;

  if (a.observaciones) {
    titulo("OBSERVACIONES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS_TEXTO);
    const lineas = doc.splitTextToSize(a.observaciones, ancho);
    doc.text(lineas, margin, y + 3);
    y += lineas.length * 4 + 4;
    doc.setTextColor(0, 0, 0);
  }

  // ── Pie ──
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRIS_SUAVE);
  doc.text(`Generado automáticamente por Corbana — ${new Date().toLocaleDateString("es-CO")}`, margin, y + 4);
  return doc;
}

export function descargarDetalleAspersionPdf(aspersion) {
  generarDetalleAspersionPdf(aspersion).save(`Detalle-Aspersion-${aspersion.numero || aspersion.uuid}.pdf`);
}
