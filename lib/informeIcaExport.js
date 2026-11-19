import ExcelJS from "exceljs";

// Llena la plantilla oficial del ICA (public/plantillas/formato-ica.xlsx, hoja «FORMATO INFORME FITO») con el informe
// trimestral de una finca. Las demás hojas, estilos y celdas combinadas quedan tal cual. Lo que el sistema no maneja
// (incidencias, trampas, PTO) se deja como está en la plantilla para completarlo a mano.
export const FILAS_APLICACIONES = 16; // filas 89 a 104 de la plantilla
const CASILLA_PERIODO = { 1: "H5", 2: "L5", 3: "P5", 4: "T5" };

const vacio = (v) => (v === null || v === undefined || v === "" ? null : v);
const numeroSiSePuede = (v) => {
  const t = String(v ?? "").trim();
  return /^\d+$/.test(t) && t.length < 16 ? Number(t) : vacio(t);
};

export async function descargarInformeIca({ informe, aplicaciones, kgCaja, fechaReporte }) {
  const res = await fetch("/plantillas/formato-ica.xlsx");
  if (!res.ok) throw new Error("No se encontró la plantilla del formato ICA");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  const ws = wb.getWorksheet("FORMATO INFORME FITO");
  if (!ws) throw new Error("La plantilla no tiene la hoja «FORMATO INFORME FITO»");
  const set = (celda, valor) => {
    ws.getCell(celda).value = valor === undefined ? null : valor;
  };
  const d = informe.datosIca || {};

  // Período reportado y fecha del reporte.
  for (const c of Object.values(CASILLA_PERIODO)) set(c, null);
  set(CASILLA_PERIODO[informe.trimestre], "X");
  const [fa, fm, fd] = fechaReporte.split("-").map(Number);
  set("AD5", fd);
  set("AF5", fm);
  set("AH5", fa);

  // I. Datos del predio.
  set("A9", informe.finca.nombre);
  set("I9", vacio(d.registroIca));
  set("M9", vacio(d.titular));
  set("V9", numeroSiSePuede(d.telefono));
  set("AA9", vacio(d.correo));
  set("D11", vacio(d.departamento));
  set("K11", vacio(d.municipio));
  set("S11", vacio(d.vereda));
  set("AF11", d.areaRegistrada === null || d.areaRegistrada === undefined || d.areaRegistrada === "" ? null : Number(d.areaRegistrada));

  // II. Asistente técnico.
  set("A15", vacio(d.asistenteNombre));
  set("J15", numeroSiSePuede(d.asistenteDocumento));
  set("O15", vacio(d.asistenteTarjeta));
  set("S15", vacio(d.asistenteCursoSv));
  set("V15", vacio(d.asistenteSensorExterno));
  set("Y15", numeroSiSePuede(d.asistenteTelefono));
  set("AC15", vacio(d.asistenteCorreo));

  // V. Monitoreo: se conservan especie y plagas; se actualizan las áreas y se limpia lo que se llena a mano.
  for (const r of [50, 51, 52]) {
    set(`E${r}`, null);
    set(`F${r}`, informe.areaProduccion ?? null);
    set(`H${r}`, d.areaRegistrada === null || d.areaRegistrada === undefined || d.areaRegistrada === "" ? null : Number(d.areaRegistrada));
    set(`J${r}`, null);
    set(`AE${r}`, null);
  }

  // VI. Aplicaciones químicas del trimestre.
  for (let i = 0; i < FILAS_APLICACIONES; i++) {
    const r = 89 + i;
    const a = aplicaciones[i];
    set(`A${r}`, a ? "Banano" : null);
    set(`F${r}`, a ? a.blanco : null);
    set(`L${r}`, a ? a.producto : null);
    set(`R${r}`, a ? new Date(`${a.fecha}T00:00:00Z`) : null);
    if (a) ws.getCell(`R${r}`).numFmt = ws.getCell("R89").numFmt || "dd/mm/yyyy";
    set(`U${r}`, a && a.dosis !== null && a.dosis !== "" ? Number(a.dosis) : null);
    set(`W${r}`, a ? (a.unidad ? `${a.unidad}/ha` : null) : null);
    set(`Y${r}`, a ? "Aspersión" : null);
    set(`AC${r}`, a ? Number(a.carencia) || 0 : null);
    set(`AE${r}`, a ? "días" : null);
    set(`AG${r}`, a ? Number(a.reentrada) || 0 : null);
    set(`AI${r}`, a ? "horas" : null);
  }

  // VIII. Producción (kg brutos = cajas 20 kg × peso bruto de la caja).
  const kg = (m) => Math.round((m?.cajas20 || 0) * kgCaja);
  set("A117", "BANANO");
  set("E117", kg(informe.produccion[0]));
  set("I117", kg(informe.produccion[1]));
  set("M117", kg(informe.produccion[2]));
  set("Q117", vacio(d.exportador) || "C.I. BANA RICA S.A.");
  set("X117", "NO");
  set("AB117", kg(informe.pronostico[0]));
  set("AE117", kg(informe.pronostico[1]));
  set("AH117", kg(informe.pronostico[2]));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Informe ICA ${informe.finca.nombre} T${informe.trimestre} ${informe.anio}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
