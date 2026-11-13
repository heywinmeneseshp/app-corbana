// Informe del servicio de mantenimiento de una orden, en dos partes (como los documentos del servicio de 100 h del DJI Agras T100):
//  1. FORMATO PARA EJECUCIÓN DE SERVICIO: identificación del equipo y del servicio, checklist por secciones con su calificación y observaciones,
//     observaciones y acciones correctivas, cierre y firmas.
//  2. ANEXO TÉCNICO: por sección, los hallazgos con su acción ejecutada, repuesto pendiente y recomendación; partes registradas, repuestos y costos,
//     y la lista de evidencias.
// Se arma en el navegador (jsPDF); el backend no genera PDFs. Mismo estilo que los demás PDF de la app (banda verde de encabezado).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const VERDE = [22, 101, 52];
const VERDE_CLARO = [240, 253, 244];
const GRIS_BORDE = [226, 232, 240];
const GRIS_TEXTO = [55, 65, 81];
const GRIS_SUAVE = [148, 163, 184];
const BLANCO = [255, 255, 255];
const CALIF = {
  SATISFACTORIO: { label: "Satisfactorio", fondo: [220, 252, 231], texto: [21, 128, 61] },
  OBSERVACION: { label: "Observación", fondo: [254, 243, 199], texto: [180, 83, 9] },
  INSATISFACTORIO: { label: "Insatisfactorio", fondo: [254, 226, 226], texto: [185, 28, 28] },
  NA: { label: "N/A", fondo: [241, 245, 249], texto: [100, 116, 139] },
  PENDIENTE: { label: "Pendiente", fondo: [248, 250, 252], texto: [71, 85, 105] },
};
const TIPO_PARTE = { BATERIA: "Batería", CONTROL_REMOTO: "Control remoto", CARGADOR: "Cargador", ANTENA: "Antena", OTRO: "Otro" };
const TIPO_ADJUNTO = { FOTO: "Foto", CARTA_AUTORIZACION: "Carta de autorización", INFORME: "Informe / anexo" };

const num = (v, d = 2) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: d }));
const fecha = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const dinero = (v) => `$ ${num(v, 0)}`;

// Agrupa los ítems del checklist por sección, en el orden de la plantilla.
const porSeccion = (items) => {
  const mapa = new Map();
  for (const it of items) {
    if (!mapa.has(it.seccion)) mapa.set(it.seccion, []);
    mapa.get(it.seccion).push(it);
  }
  return [...mapa.entries()];
};

export function generarInformeServicioPdf({ orden, equipo, servicio, checklist, partes = [] }) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 14;
  const util = ancho - margen * 2;
  let y = margen;

  const espacio = (necesario) => {
    if (y + necesario > alto - 18) {
      doc.addPage();
      y = margen;
    }
  };

  const encabezado = (titulo, subtitulo) => {
    doc.setFillColor(...VERDE);
    doc.roundedRect(margen, y, util, 18, 2, 2, "F");
    doc.setTextColor(...BLANCO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("CORBANA ZOMAC S.A.S.", margen + 6, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(titulo, margen + 6, y + 14.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(orden.numero || "", ancho - margen - 6, y + 8, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(subtitulo || "", ancho - margen - 6, y + 14.5, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 23;
  };

  const titulo = (texto) => {
    espacio(14);
    doc.setFillColor(...VERDE_CLARO);
    doc.rect(margen, y, util, 6.5, "F");
    doc.setTextColor(...VERDE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(texto, margen + 2.5, y + 4.6);
    doc.setTextColor(0, 0, 0);
    y += 8.5;
  };

  const parrafo = (texto, opciones = {}) => {
    const lineas = doc.splitTextToSize(texto, util - 2);
    espacio(lineas.length * 4 + 2);
    doc.setFont("helvetica", opciones.negrita ? "bold" : "normal");
    doc.setFontSize(opciones.tam || 8.5);
    doc.setTextColor(...(opciones.color || GRIS_TEXTO));
    doc.text(lineas, margen + 1, y + 3);
    doc.setTextColor(0, 0, 0);
    y += lineas.length * 4 + 2;
  };

  // Rejilla de datos: filas de pares etiqueta / valor; un valor puede ocupar varias columnas.
  const rejilla = (filas) => {
    const body = [];
    for (const fila of filas) {
      body.push(fila.map(([etiqueta, , span = 1]) => ({ content: etiqueta, colSpan: span, styles: { fontSize: 6.5, textColor: GRIS_SUAVE, fontStyle: "bold", cellPadding: { top: 1.6, bottom: 0.2, left: 2.5, right: 2.5 } } })));
      body.push(fila.map(([, valor, span = 1]) => ({ content: valor || "—", colSpan: span, styles: { fontSize: 8.5, textColor: GRIS_TEXTO, cellPadding: { top: 0.8, bottom: 2, left: 2.5, right: 2.5 } } })));
    }
    espacio(20);
    autoTable(doc, { startY: y, theme: "plain", body, margin: { left: margen, right: margen }, styles: { font: "helvetica", lineColor: GRIS_BORDE }, columnStyles: Object.fromEntries([0, 1, 2, 3].map((i) => [i, { cellWidth: util / 4 }])) });
    doc.setDrawColor(...GRIS_BORDE);
    doc.setLineWidth(0.3);
    doc.roundedRect(margen, y, util, doc.lastAutoTable.finalY - y, 2, 2, "S");
    y = doc.lastAutoTable.finalY + 5;
  };

  const celdaCalificacion = (c) => {
    const k = CALIF[c] || CALIF.PENDIENTE;
    return { content: k.label, styles: { fillColor: k.fondo, textColor: k.texto, fontStyle: "bold", halign: "center", valign: "middle" } };
  };

  const items = checklist?.items || [];
  const hallazgos = checklist?.hallazgos || [];
  const resumen = checklist?.resumen || {};
  const proveedor = servicio?.proveedor?.nombre;
  const participantes = (servicio?.participantes || []).map((p) => p.nombre).join(", ");
  const rc = partes.find((p) => p.tipo === "CONTROL_REMOTO");
  const lecturaHoras = servicio?.lecturaHoras ?? orden.lecturaHoras;
  const lecturaKm = servicio?.lecturaKm ?? orden.lecturaKm;
  const esPendiente = (h) => h.estado !== "RESUELTO";

  // ════════ 1. FORMATO PARA EJECUCIÓN DE SERVICIO ════════
  encabezado("FORMATO PARA EJECUCIÓN DE SERVICIO", orden.estado === "CERRADA" ? "Cerrada" : orden.estado || "");
  titulo("IDENTIFICACIÓN DEL EQUIPO Y DEL SERVICIO");
  rejilla([
    [["CLIENTE / OPERADOR", "CORBANA ZOMAC S.A.S."], ["EQUIPO", `${equipo?.codigo || orden.equipo?.codigo || ""} · ${equipo?.nombre || orden.equipo?.nombre || ""}`, 2], ["TIPO DE MANTENIMIENTO", orden.plan?.nombre || orden.tipo]],
    [["MARCA / MODELO", [equipo?.marca, equipo?.modelo].filter(Boolean).join(" / ")], ["SERIE", equipo?.serie], ["CONFIGURACIÓN", equipo?.configuracion], ["CONTROL REMOTO (SERIE)", rc ? `${rc.descripcion || rc.codigo} · ${rc.serie || "sin serie"}` : "—"]],
    [["HORAS TOTALES AL INGRESO", lecturaHoras != null ? `${num(lecturaHoras)} h` : "—"], ["KILOMETRAJE AL INGRESO", lecturaKm != null && Number(lecturaKm) > 0 ? `${num(lecturaKm)} km` : "—"], ["FECHA DE INICIO", fecha(servicio?.fechaInicio || orden.fecha)], ["FECHA DE CIERRE", fecha(orden.fechaCierre)]],
    [["EJECUTA", servicio?.ejecutorTipo === "EXTERNO" ? `Proveedor externo${proveedor ? `: ${proveedor}` : ""}` : "Personal propio", 2], ["TÉCNICO RESPONSABLE", servicio?.tecnicoResponsable || orden.responsable?.nombre], ["PARTICIPANTES ENTRENAMIENTO", participantes]],
  ]);

  titulo("LISTA DE VERIFICACIÓN DE MANTENIMIENTO (CHECKLIST)");
  if (items.length === 0) {
    parrafo("Esta orden no tiene checklist.", { color: GRIS_SUAVE });
  } else {
    parrafo(`Resumen: ${Object.entries(CALIF).map(([k, v]) => `${v.label} ${resumen[k] || 0}`).join(" · ")} (de ${items.length} ítems).`, { color: GRIS_SUAVE, tam: 8 });
    porSeccion(items).forEach(([seccion, lista], i) => {
      espacio(24);
      autoTable(doc, {
        startY: y,
        head: [[{ content: `${i + 1}. ${seccion}`, colSpan: 3, styles: { halign: "left" } }], ["Ítem evaluado", "Calificación", "Observaciones / evidencia"]],
        body: lista.map((it) => [it.descripcion, celdaCalificacion(it.calificacion), it.observaciones || ""]),
        margin: { left: margen, right: margen },
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7.5, textColor: GRIS_TEXTO, lineColor: GRIS_BORDE, cellPadding: 1.6 },
        headStyles: { fillColor: VERDE, textColor: BLANCO, fontSize: 8 },
        columnStyles: { 0: { cellWidth: util * 0.44 }, 1: { cellWidth: util * 0.14 }, 2: { cellWidth: util * 0.42 } },
        didParseCell: (d) => {
          if (d.section === "head" && d.row.index === 1) {
            d.cell.styles.fillColor = [46, 125, 79];
            d.cell.styles.fontSize = 7;
          }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    });
  }

  titulo("OBSERVACIONES Y ACCIONES CORRECTIVAS");
  const abiertos = hallazgos.filter(esPendiente);
  parrafo(
    `${hallazgos.length} hallazgo(s) en este servicio, ${abiertos.length} sin resolver. El detalle de hallazgos, acciones ejecutadas, repuestos pendientes y recomendaciones está en el Anexo técnico.`,
  );
  if (orden.observaciones) parrafo(orden.observaciones);

  titulo("CIERRE");
  espacio(40);
  rejilla([[["FECHA DE CIERRE", fecha(orden.fechaCierre)], ["FECHA DE ACEPTACIÓN", fecha(servicio?.fechaAceptacion)], ["RECIBIDO POR", servicio?.recibidoPor, 2]]]);
  y += 8;
  espacio(28);
  doc.setDrawColor(...GRIS_SUAVE);
  doc.setLineWidth(0.3);
  const mitad = util / 2;
  doc.line(margen + 4, y + 12, margen + mitad - 8, y + 12);
  doc.line(margen + mitad + 8, y + 12, margen + util - 4, y + 12);
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text("Técnico responsable", margen + 4, y + 16.5);
  doc.text(servicio?.tecnicoResponsable || "", margen + 4, y + 20.5);
  doc.text("Representante / CORBANA ZOMAC S.A.S.", margen + mitad + 8, y + 16.5);
  doc.text(servicio?.recibidoPor || "", margen + mitad + 8, y + 20.5);
  y += 26;

  // ════════ 2. ANEXO TÉCNICO ════════
  doc.addPage();
  y = margen;
  encabezado("ANEXO TÉCNICO – SERVICIO DE MANTENIMIENTO", `Equipo ${equipo?.codigo || orden.equipo?.codigo || ""}`);
  titulo("1. IDENTIFICACIÓN Y ALCANCE");
  rejilla([
    [["CLIENTE", "CORBANA ZOMAC S.A.S."], ["EQUIPO", `${equipo?.codigo || ""} · ${equipo?.nombre || ""}`, 2], ["SERIE", equipo?.serie]],
    [["HORAS TOTALES", lecturaHoras != null ? `${num(lecturaHoras)} h` : "—"], ["FECHA INICIO", fecha(servicio?.fechaInicio || orden.fecha)], ["FECHA FINAL", fecha(orden.fechaCierre)], ["TÉCNICO RESPONSABLE", servicio?.tecnicoResponsable]],
    [["ALCANCE", orden.descripcion, 4]],
  ]);

  titulo("2. HALLAZGOS, ACCIONES Y RECOMENDACIONES");
  if (hallazgos.length === 0) {
    parrafo(items.length ? "No se registraron hallazgos: todos los ítems calificados quedaron satisfactorios, N/A o pendientes." : "No hay hallazgos registrados.", { color: GRIS_SUAVE });
  } else {
    const seccionDe = (h) => h.seccion || "Otros hallazgos";
    const grupos = new Map();
    for (const h of hallazgos) {
      if (!grupos.has(seccionDe(h))) grupos.set(seccionDe(h), []);
      grupos.get(seccionDe(h)).push(h);
    }
    for (const [seccion, lista] of grupos) {
      espacio(26);
      autoTable(doc, {
        startY: y,
        head: [[{ content: seccion, colSpan: 3, styles: { halign: "left" } }], ["Estado / calificación", "Hallazgo / evidencia", "Acción ejecutada · Pendiente / repuesto · Recomendación"]],
        body: lista.map((h) => [
          { content: `${CALIF[h.calificacion]?.label || h.calificacion}\n${h.estado === "RESUELTO" ? "Resuelto" : h.estado === "EN_SEGUIMIENTO" ? "En seguimiento" : "Abierto"}`, styles: { fillColor: (CALIF[h.calificacion] || CALIF.OBSERVACION).fondo, textColor: (CALIF[h.calificacion] || CALIF.OBSERVACION).texto, fontStyle: "bold", halign: "center" } },
          `${h.descripcion}${h.itemDescripcion ? `\n(Ítem: ${h.itemDescripcion})` : ""}`,
          [h.accionEjecutada && `Acción ejecutada: ${h.accionEjecutada}`, h.pendienteRepuesto && `Pendiente/repuesto: ${h.pendienteRepuesto}`, h.recomendacion && `Recomendación: ${h.recomendacion}`].filter(Boolean).join("\n") || "—",
        ]),
        margin: { left: margen, right: margen },
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7.5, textColor: GRIS_TEXTO, lineColor: GRIS_BORDE, cellPadding: 1.8 },
        headStyles: { fillColor: VERDE, textColor: BLANCO, fontSize: 8 },
        columnStyles: { 0: { cellWidth: util * 0.15 }, 1: { cellWidth: util * 0.42 }, 2: { cellWidth: util * 0.43 } },
        didParseCell: (d) => {
          if (d.section === "head" && d.row.index === 1) {
            d.cell.styles.fillColor = [46, 125, 79];
            d.cell.styles.fontSize = 7;
          }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }
  }

  if (partes.length > 0) {
    titulo("3. PARTES Y ACCESORIOS REGISTRADOS");
    espacio(20);
    autoTable(doc, {
      startY: y,
      head: [["Código", "Tipo", "Serie", "Ciclos", "Estado"]],
      body: partes.map((p) => [p.codigo, TIPO_PARTE[p.tipo] || p.tipo, p.serie || "—", num(p.ciclos, 0), p.estado === "ACTIVA" ? "Activa" : p.estado === "EN_REVISION" ? "En revisión" : "Retirada"]),
      margin: { left: margen, right: margen },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, textColor: GRIS_TEXTO, lineColor: GRIS_BORDE, cellPadding: 1.6 },
      headStyles: { fillColor: VERDE, textColor: BLANCO, fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  const repuestos = orden.detalles || [];
  const manoObra = orden.manoObra || [];
  const servicios = orden.servicios || [];
  if (repuestos.length || manoObra.length || servicios.length) {
    titulo("4. REPUESTOS, MANO DE OBRA Y SERVICIOS");
    espacio(20);
    const filas = [
      ...repuestos.map((r) => ["Repuesto", `${r.articulo?.codigo || ""} ${r.articulo?.nombre || ""}`.trim(), num(r.cantidad), dinero(r.costoTotal)]),
      ...manoObra.map((m) => ["Mano de obra", m.descripcion, `${num(m.horas)} h`, dinero(m.costoTotal)]),
      ...servicios.map((s) => ["Servicio externo", s.descripcion || s.proveedor || "", "", dinero(s.costoTotal ?? s.costo)]),
    ];
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Descripción", "Cantidad", "Costo"]],
      body: filas,
      foot: [[{ content: "Total de la orden", colSpan: 3, styles: { halign: "right" } }, dinero(orden.costoTotal)]],
      margin: { left: margen, right: margen },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, textColor: GRIS_TEXTO, lineColor: GRIS_BORDE, cellPadding: 1.6 },
      headStyles: { fillColor: VERDE, textColor: BLANCO, fontSize: 8 },
      footStyles: { fillColor: VERDE_CLARO, textColor: VERDE, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  const adjuntos = servicio?.adjuntos || [];
  titulo(`${partes.length > 0 ? 5 : 4}. EVIDENCIAS Y DOCUMENTOS`);
  if (adjuntos.length === 0) parrafo("No hay archivos adjuntos en el sistema.", { color: GRIS_SUAVE });
  else {
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Archivo", "Enlace (Google Drive)"]],
      body: adjuntos.map((a) => [TIPO_ADJUNTO[a.tipo] || a.tipo, a.nombre || "", a.urlDrive || ""]),
      margin: { left: margen, right: margen },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7, textColor: GRIS_TEXTO, lineColor: GRIS_BORDE, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: VERDE, textColor: BLANCO, fontSize: 8 },
      columnStyles: { 0: { cellWidth: util * 0.2 }, 1: { cellWidth: util * 0.3 }, 2: { cellWidth: util * 0.5 } },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  // Pie de página con la numeración.
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS_SUAVE);
    doc.text(`Orden ${orden.numero || ""} · ${equipo?.codigo || ""}`, margen, alto - 8);
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 8, { align: "right" });
  }

  return doc;
}

export function descargarInformeServicioPdf(datos) {
  const doc = generarInformeServicioPdf(datos);
  doc.save(`Informe_servicio_${datos.orden.numero || "orden"}_${datos.equipo?.codigo || ""}.pdf`.replace(/\s+/g, "_"));
}
