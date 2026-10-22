import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Reporte en PDF de las existencias (saldo por almacén y artículo). Mismo verde de marca que el resto de los PDFs de la app
// (ver aspersionExport.js). Se arma en el navegador con las filas que ya trae la pantalla.

const VERDE = [22, 101, 52]; // #166534
const VERDE_CLARO = [240, 253, 244]; // #f0fdf4
const GRIS_TEXTO = [55, 65, 81]; // #374151
const GRIS_SUAVE = [148, 163, 184]; // #94a3b8

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/**
 * @param {Array<{almacen:string, codigo:string, articulo:string, saldo:number, unidad:string}>} filas
 * @param {{ filtros?: string, fecha?: string }} [opciones]  Filtros aplicados (se imprimen bajo el título) y, si es un día pasado (AAAA-MM-DD), el saldo es el de esa fecha.
 */
export function generarExistenciasPdf(filas, { filtros = "", fecha = "" } = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 12;

  doc.setFillColor(...VERDE);
  doc.rect(0, 0, ancho, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(fecha ? "Existencias de inventario (histórico)" : "Existencias de inventario", margen, 12.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dia = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
  doc.text(`${fecha ? "Saldo al " : ""}${dia.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}`, ancho - margen, 12.5, { align: "right" });

  doc.setTextColor(...GRIS_TEXTO);
  doc.setFontSize(9);
  doc.text(`${filas.length} artículo(s) con existencia${filtros ? ` · ${filtros}` : ""}`, margen, 27);

  autoTable(doc, {
    startY: 31,
    margin: { left: margen, right: margen, bottom: 16 },
    head: [["Almacén", "Código", "Artículo", "Saldo", "Unidad"]],
    body: filas.map((f) => [f.almacen, f.codigo || "—", f.articulo, nf.format(f.saldo), f.unidad || ""]),
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 1.8, textColor: GRIS_TEXTO, lineColor: [226, 232, 240], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: VERDE_CLARO },
    columnStyles: { 1: { cellWidth: 20 }, 3: { halign: "right", cellWidth: 26 }, 4: { cellWidth: 16 } },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index === 3) d.cell.styles.halign = "right";
      if (d.section === "body" && d.column.index === 3 && filas[d.row.index]?.saldo < 0) d.cell.styles.textColor = [185, 28, 28];
    },
  });

  const paginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_SUAVE);
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }
  return doc;
}

export function descargarExistenciasPdf(filas, opciones) {
  const hoy = new Date().toISOString().slice(0, 10);
  generarExistenciasPdf(filas, opciones).save(`existencias_${opciones?.fecha || hoy}.pdf`);
}
