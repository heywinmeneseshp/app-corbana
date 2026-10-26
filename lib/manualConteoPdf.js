import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Manual de usuario del módulo Conteo de inventario, en PDF. Se arma en el navegador (mismo verde de marca que el resto de los PDFs de la
// app, ver existenciasExport.js). Si cambia el flujo del conteo (conteo.service.js / páginas de conteos), actualizar este texto.

const VERDE = [22, 101, 52];
const VERDE_CLARO = [240, 253, 244];
const GRIS = [55, 65, 81];
const GRIS_SUAVE = [100, 116, 139];

const SECCIONES = [
  {
    titulo: "1. Para qué sirve",
    parrafos: [
      "El conteo de inventario es la toma física de inventario: se cuenta lo que realmente hay en un almacén y se compara con las existencias del sistema. Al cerrarlo, el sistema corrige las diferencias con ajustes en el kárdex, de modo que la existencia queda igual a lo contado.",
      "Se usa para el inventario periódico (mensual, trimestral o de cierre de año) y para verificar un grupo de artículos puntual cuando se sospecha una diferencia.",
    ],
  },
  {
    titulo: "2. Dónde está",
    parrafos: [
      "Menú Inventarios > Resumen y stock > botón «Conteo» en la barra superior. Desde ahí también se llega a Existencias, Kárdex y Movimientos.",
    ],
  },
  {
    titulo: "3. Crear un conteo",
    pasos: [
      "Pulsa «Nuevo conteo».",
      "Elige el almacén que se va a contar.",
      "Opcional: elige una categoría para contar solo ese grupo de artículos (por ejemplo, solo insumos). Sin categoría se cuentan todos los artículos del almacén.",
      "Opcional: marca «Conteo ciego» si quieres que quien cuenta NO vea el saldo del sistema (recomendado para inventarios de control, evita que se copie el saldo).",
      "Escribe observaciones si hace falta (responsables, motivo del conteo) y pulsa «Crear y empezar a contar».",
    ],
    notas: [
      "Solo puede haber un conteo abierto (en borrador) por almacén y categoría. Si ya existe uno, ciérralo o anúlalo antes de crear otro.",
      "Se cargan los artículos activos que manejan inventario en ese almacén. El conteo queda con un número del tipo CNT-00001.",
    ],
  },
  {
    titulo: "4. Digitar lo contado",
    pasos: [
      "Abre el conteo desde la lista (clic en la fila).",
      "Escribe en la columna «Contado» la cantidad física de cada artículo, en la unidad que muestra la fila.",
      "Pulsa «Guardar» cada cierto tiempo: el botón indica cuántas filas tienen cambios sin guardar. Puedes cerrar la página y seguir después; lo guardado se conserva.",
      "Usa «Buscar» (código o nombre), el filtro de categoría y «Mostrar» para ubicarte: «Pendientes por contar» deja solo lo que falta, y «Con diferencia» (si el conteo no es ciego) muestra lo que no cuadra con el sistema.",
    ],
    notas: [
      "Si un artículo no se digita, NO se ajusta al cerrar: su existencia queda como estaba. Para registrar que no hay nada, escribe 0.",
      "Mientras el conteo está en borrador, la columna «Saldo sistema» muestra la existencia actual y «Diferencia» lo que se ajustaría (contado - saldo). En un conteo ciego esas columnas no aparecen.",
    ],
  },
  {
    titulo: "5. Cerrar el conteo (aplicar los ajustes)",
    pasos: [
      "Cuando termines de contar, pulsa «Guardar» y luego «Cerrar conteo».",
      "Elige el motivo del ajuste (por defecto «Ajuste por conteo de inventario») y agrega observaciones si quieres.",
      "Confirma. El sistema compara cada artículo contado contra su saldo en ese momento y registra la diferencia.",
    ],
    tabla: {
      cabecera: ["Resultado del artículo", "Qué hace el sistema"],
      filas: [
        ["Contado mayor que el saldo (sobrante)", "Registra un AJUSTE DE ENTRADA por la diferencia."],
        ["Contado menor que el saldo (faltante)", "Registra un AJUSTE DE SALIDA por la diferencia."],
        ["Contado igual al saldo", "No registra movimiento."],
        ["Sin digitar", "No se toca; queda el saldo del sistema."],
      ],
    },
    notas: [
      "Los ajustes quedan en el kárdex con el documento del conteo (CNT-xxxxx), el motivo y la fecha del conteo, así se pueden auditar.",
      "La diferencia se calcula contra el saldo en el momento de cerrar: si hubo movimientos mientras se contaba, se tienen en cuenta.",
      "Un conteo cerrado ya no se puede modificar ni anular. Si hubo un error, se corrige con otro conteo o con un ajuste en Movimientos.",
    ],
  },
  {
    titulo: "6. Anular un conteo",
    parrafos: [
      "Un conteo en borrador se puede anular con «Anular conteo». No se aplica ningún ajuste y el almacén queda libre para abrir un conteo nuevo. Un conteo cerrado no se puede anular porque ya generó ajustes.",
    ],
  },
  {
    titulo: "7. Estados del conteo",
    tabla: {
      cabecera: ["Estado", "Significado"],
      filas: [
        ["Borrador", "Abierto: se está contando, se puede digitar, guardar, cerrar o anular."],
        ["Cerrado", "Se aplicaron los ajustes. Solo lectura: muestra el saldo al cierre y la diferencia de cada artículo."],
        ["Anulado", "Se descartó sin aplicar ajustes."],
      ],
    },
  },
  {
    titulo: "8. Permisos",
    tabla: {
      cabecera: ["Permiso", "Qué permite"],
      filas: [
        ["Ver conteos", "Ver la lista y el detalle de los conteos."],
        ["Crear conteos", "Crear un conteo, digitar y guardar cantidades, y anular un borrador."],
        ["Cerrar conteos", "Cerrar el conteo y aplicar los ajustes al inventario."],
      ],
    },
    parrafos: ["Los permisos se asignan por rol en Maestros > Roles. Se recomienda que quien cierra sea distinto de quien cuenta."],
  },
  {
    titulo: "9. Recomendaciones",
    puntos: [
      "Cuenta con el almacén quieto: evita entradas y salidas durante el conteo, o regístralas antes de empezar.",
      "Usa conteo ciego para los inventarios de control y conteo normal para revisar diferencias puntuales.",
      "Divide los almacenes grandes por categoría para que varias personas cuenten en paralelo.",
      "Antes de cerrar, revisa «Con diferencia»: una diferencia muy grande suele ser un error de digitación o de unidad.",
      "Después del cierre, revisa el Kárdex o descarga el Excel de Movimientos para dejar el soporte del inventario.",
    ],
  },
];

export function descargarManualConteo() {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 50;
  const util = ancho - margen * 2;
  let y = 0;

  function encabezado() {
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, ancho, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Manual de usuario · Conteo de inventario", margen, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Corbana · Módulo de Inventarios", margen, 48);
    y = 90;
  }

  function nuevaPaginaSiHaceFalta(alto_necesario) {
    if (y + alto_necesario > alto - 60) {
      doc.addPage();
      encabezado();
    }
  }

  function parrafo(texto, { sangria = 0, prefijo = "" } = {}) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRIS);
    const lineas = doc.splitTextToSize(texto, util - sangria - (prefijo ? 14 : 0));
    nuevaPaginaSiHaceFalta(lineas.length * 14 + 4);
    if (prefijo) {
      doc.setFont("helvetica", "bold");
      doc.text(prefijo, margen + sangria, y);
      doc.setFont("helvetica", "normal");
    }
    doc.text(lineas, margen + sangria + (prefijo ? 14 : 0), y);
    y += lineas.length * 14 + 4;
  }

  encabezado();

  for (const s of SECCIONES) {
    nuevaPaginaSiHaceFalta(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...VERDE);
    doc.text(s.titulo, margen, y);
    y += 18;

    for (const p of s.parrafos || []) parrafo(p);
    (s.pasos || []).forEach((p, i) => parrafo(p, { sangria: 6, prefijo: `${i + 1}.` }));
    for (const p of s.puntos || []) parrafo(p, { sangria: 6, prefijo: "•" });

    if (s.tabla) {
      autoTable(doc, {
        startY: y,
        margin: { left: margen, right: margen },
        head: [s.tabla.cabecera],
        body: s.tabla.filas,
        styles: { fontSize: 9, cellPadding: 5, textColor: GRIS },
        headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: VERDE_CLARO },
        columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" } },
        didDrawPage: (data) => {
          if (data.pageNumber > 1 && data.cursor && data.cursor.y < 90) encabezado();
        },
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    if (s.notas?.length) {
      const textos = s.notas.map((n) => doc.splitTextToSize(n, util - 24));
      const altoCaja = textos.reduce((a, l) => a + l.length * 13 + 4, 0) + 16;
      nuevaPaginaSiHaceFalta(altoCaja);
      doc.setFillColor(...VERDE_CLARO);
      doc.setDrawColor(...VERDE);
      doc.roundedRect(margen, y - 4, util, altoCaja, 4, 4, "FD");
      let yy = y + 10;
      doc.setFontSize(9);
      for (const l of textos) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...VERDE);
        doc.text("Nota:", margen + 10, yy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRIS);
        doc.text(l, margen + 40, yy);
        yy += l.length * 13 + 4;
      }
      y += altoCaja + 8;
    }
    y += 8;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_SUAVE);
    doc.text(`Página ${i} de ${total}`, ancho - margen, alto - 30, { align: "right" });
    doc.text(`Generado el ${new Date().toLocaleDateString("es-CO")}`, margen, alto - 30);
  }

  doc.save("Manual-Conteo-de-inventario.pdf");
}
