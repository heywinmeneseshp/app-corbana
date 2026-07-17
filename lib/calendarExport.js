import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DIAS } from "./calendarBuilder";
import { COLOR_HEX, COLOR_TEXT } from "./semanaColor";

const BLOCKS_PER_ROW = 3;
const BLOCK_COLS = 9; // 1 (semana) + 7 (dias) + 1 (espacio)
const BLOCK_ROWS = 9; // titulo + encabezado dias + 6 filas semana + espacio

function hexToArgb(hex) {
  return "FF" + hex.replace("#", "").toUpperCase();
}

export async function downloadCalendarExcel(year, months) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Calendario ${year}`);

  const totalCols = BLOCKS_PER_ROW * BLOCK_COLS - 1;
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `CALENDARIO ${year}`;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center" };

  months.forEach((mes, idx) => {
    const blockRow = Math.floor(idx / BLOCKS_PER_ROW);
    const blockCol = idx % BLOCKS_PER_ROW;
    const startRow = 3 + blockRow * BLOCK_ROWS;
    const startCol = 1 + blockCol * BLOCK_COLS;

    sheet.mergeCells(startRow, startCol, startRow, startCol + 7);
    const monthCell = sheet.getCell(startRow, startCol);
    monthCell.value = mes.nombre;
    monthCell.font = { bold: true, size: 12 };
    monthCell.alignment = { horizontal: "center" };
    monthCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

    const headerRow = startRow + 1;
    sheet.getCell(headerRow, startCol).value = "";
    DIAS.forEach((d, i) => {
      const c = sheet.getCell(headerRow, startCol + 1 + i);
      c.value = d;
      c.font = { bold: true };
      c.alignment = { horizontal: "center" };
    });

    mes.rows.forEach((row, rIdx) => {
      const r = headerRow + 1 + rIdx;
      const weekCell = sheet.getCell(r, startCol);
      if (row.semana) {
        weekCell.value = row.semana.numeroSemana;
        const colorName = row.semana.color;
        weekCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(COLOR_HEX[colorName] || "#94a3b8") } };
        weekCell.font = { bold: true, color: { argb: hexToArgb(COLOR_TEXT[colorName] || "#111827") } };
      }
      weekCell.alignment = { horizontal: "center" };

      row.days.forEach((day, dIdx) => {
        const dc = sheet.getCell(r, startCol + 1 + dIdx);
        dc.value = day.day;
        dc.alignment = { horizontal: "center" };
        if (!day.inMonth) {
          dc.font = { color: { argb: "FFB0B0B0" } };
        }
      });
    });
  });

  for (let c = 1; c <= totalCols; c++) {
    sheet.getColumn(c).width = (c % BLOCK_COLS === 0) ? 2 : 5;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calendario_${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCalendarPdf(year, months) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 24;
  const tableWidth = (pageWidth - marginX * 2 - 20 * 2) / 3;

  doc.setFontSize(16);
  doc.text(`Calendario ${year}`, pageWidth / 2, 30, { align: "center" });

  let cursorY = 45;
  const quarters = [];
  for (let i = 0; i < months.length; i += 3) quarters.push(months.slice(i, i + 3));

  quarters.forEach((trio, qIdx) => {
    if (qIdx > 0) {
      doc.addPage();
      cursorY = 30;
    }
    let maxFinalY = cursorY;

    trio.forEach((mes, i) => {
      const startX = marginX + i * (tableWidth + 20);
      const body = mes.rows.map((row) => [
        row.semana ? String(row.semana.numeroSemana) : "",
        ...row.days.map((d) => String(d.day)),
      ]);

      autoTable(doc, {
        head: [[mes.nombre, ...DIAS]],
        body,
        startY: cursorY,
        margin: { left: startX, right: pageWidth - startX - tableWidth },
        tableWidth,
        theme: "grid",
        styles: { fontSize: 7, halign: "center", cellPadding: 2 },
        headStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: "bold" },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          if (data.column.index === 0) {
            const row = mes.rows[data.row.index];
            if (row.semana) {
              const colorHex = COLOR_HEX[row.semana.color] || "#94a3b8";
              data.cell.styles.fillColor = colorHex;
              data.cell.styles.textColor = COLOR_TEXT[row.semana.color] || "#111827";
              data.cell.styles.fontStyle = "bold";
            }
          } else {
            const row = mes.rows[data.row.index];
            const day = row.days[data.column.index - 1];
            if (day && !day.inMonth) {
              data.cell.styles.textColor = "#b0b0b0";
            }
          }
        },
      });

      const finalY = doc.lastAutoTable.finalY;
      if (finalY > maxFinalY) maxFinalY = finalY;
    });

    cursorY = maxFinalY + 20;
  });

  doc.save(`calendario_${year}.pdf`);
}
