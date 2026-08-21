import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  ImageRun,
  ShadingType,
} from "docx";
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

// Mismos colores de referencia que el PDF/modal (ver visitaLaborExport.js,
// components/reportes/VisitaLaborModal.js) — sin # porque docx los pide así.
const ESTADO_COLOR = {
  Hecho: "198754",
  "En ejecucion": "B48200",
  Pendiente: "6C757D",
};
const COLOR_SI = "DC3545";
const COLOR_NO = "6C757D";
const COLOR_BORDE = "DEE2E6";
const COLOR_TEXTO_MUTED = "6C757D";

const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const CELDA_SIN_BORDES = { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE };

const bordeTabla = (color = COLOR_BORDE) => ({
  top: { style: BorderStyle.SINGLE, size: 4, color },
  bottom: { style: BorderStyle.SINGLE, size: 4, color },
  left: { style: BorderStyle.SINGLE, size: 4, color },
  right: { style: BorderStyle.SINGLE, size: 4, color },
});

function celdaTextoEstado(texto) {
  const color = ESTADO_COLOR[texto] || "6C757D";
  return new TableCell({
    borders: bordeTabla(),
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: texto || "—", bold: true, color, size: 16 })],
      }),
    ],
  });
}

// Descarga una foto de la visita (autenticada) y la deja lista para
// ImageRun: bytes crudos (sin recodificar, a diferencia del PDF que sí
// rasteriza a JPEG) + dimensiones reales para no distorsionarla.
async function cargarFotoParaWord(fotoUuid) {
  const blob = await apiFetchBlob(`/labores-culturales/fotos/${fotoUuid}/archivo`);
  const arrayBuffer = await blob.arrayBuffer();
  const dimensiones = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo procesar la foto"));
    };
    img.src = url;
  });
  const tipo = blob.type.includes("png") ? "png" : blob.type.includes("gif") ? "gif" : "jpg";
  return { data: arrayBuffer, tipo, ...dimensiones };
}

function tarjetaSiNo({ titulo, valor, detalle, alarmaSi = true }) {
  const esAlarma = alarmaSi ? valor : !valor;
  const color = esAlarma ? COLOR_SI : COLOR_NO;
  const filas = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: detalle ? 40 : 100, left: 120, right: 120 },
          borders: CELDA_SIN_BORDES,
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${titulo}   `, bold: true, size: 18 }),
                new TextRun({ text: valor ? "Sí" : "No", bold: true, color, size: 18 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
  if (detalle) {
    filas.push(
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 0, bottom: 100, left: 120, right: 120 },
            borders: CELDA_SIN_BORDES,
            children: [new Paragraph({ children: [new TextRun({ text: detalle, size: 15, color: COLOR_TEXTO_MUTED })] })],
          }),
        ],
      }),
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordeTabla(),
    rows: filas,
  });
}

function parDeTarjetas(tarjetas) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: CELDA_SIN_BORDES,
    rows: [
      new TableRow({
        children: tarjetas.map(
          (t) =>
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { left: 60, right: 60 },
              borders: CELDA_SIN_BORDES,
              children: [tarjetaSiNo(t)],
            }),
        ),
      }),
    ],
  });
}

function tituloSeccion(texto) {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text: texto, bold: true, size: 22 })],
  });
}

function firmaColumna(nombre, cargo) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { left: 200, right: 200 },
    borders: CELDA_SIN_BORDES,
    children: [
      new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: "" })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000" } },
        children: [new TextRun({ text: nombre || "—", bold: true, size: 18 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cargo || "", size: 16, color: COLOR_TEXTO_MUTED })],
      }),
    ],
  });
}

// Genera el mismo contenido que el PDF/modal de detalle de la visita como un
// documento Word descargable — 100% client-side (librería `docx`), mismo
// patrón sin tocar el backend que lib/visitaLaborExport.js.
export async function downloadVisitaLaborWord(visita) {
  const marca = await obtenerMarca();

  const encabezadoChildren = [
    new TextRun({ text: `Visita Sanidad y Vegetal — ${visita.fincaNombre}`, bold: true, size: 30 }),
  ];

  let logoImageRun = null;
  try {
    if (marca.logoUrl) {
      const formato = marca.logoUrl.match(/^data:image\/(\w+)/)?.[1] || "png";
      const base64 = marca.logoUrl.split(",")[1];
      logoImageRun = new ImageRun({
        data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
        transformation: { width: 36, height: 36 },
        type: formato === "jpeg" ? "jpg" : formato,
      });
    }
  } catch {
    // Sin logo si algo falla — el documento sigue sin él.
  }

  const filasContenido = [];

  filasContenido.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELDA_SIN_BORDES,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: CELDA_SIN_BORDES,
              children: [new Paragraph(logoImageRun ? { children: [logoImageRun] } : {})],
            }),
            new TableCell({
              width: { size: 92, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: CELDA_SIN_BORDES,
              children: [
                new Paragraph({ children: encabezadoChildren }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Semana ${visita.semanaCodigo} · ${visita.fecha}`,
                      size: 18,
                      color: COLOR_TEXTO_MUTED,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 150, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE } },
      children: [new TextRun({ text: "" })],
    }),
  );

  if (visita.clima) {
    filasContenido.push(tituloSeccion("Condiciones climáticas"));
    const partes = [`${visita.clima.mm} mm`];
    if (visita.clima.temperatura != null) partes.push(`${visita.clima.temperatura} °C`);
    if (visita.clima.humedadRelativa != null) partes.push(`${visita.clima.humedadRelativa}% HR`);
    filasContenido.push(new Paragraph({ children: [new TextRun({ text: partes.join("   ·   "), size: 18 })] }));
  }

  filasContenido.push(tituloSeccion("Estado fitosanitario por lote"));
  filasContenido.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: ["Lote", ...COLUMNAS.map((c) => c.label)].map(
            (texto) =>
              new TableCell({
                shading: { type: ShadingType.SOLID, color: "E5E7EB", fill: "E5E7EB" },
                borders: bordeTabla(),
                margins: { top: 60, bottom: 60, left: 80, right: 80 },
                children: [new Paragraph({ children: [new TextRun({ text: texto, bold: true, size: 16 })] })],
              }),
          ),
        }),
        ...visita.lotes.map(
          (l) =>
            new TableRow({
              children: [
                new TableCell({
                  borders: bordeTabla(),
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                  children: [new Paragraph({ children: [new TextRun({ text: l.loteNombre, bold: true, size: 16 })] })],
                }),
                ...COLUMNAS.map((c) => celdaTextoEstado(l[c.key])),
              ],
            }),
        ),
      ],
    }),
  );

  const observacionesLotes = visita.lotes.filter((l) => l.observacion);
  if (observacionesLotes.length > 0) {
    filasContenido.push(
      ...observacionesLotes.map(
        (l) =>
          new Paragraph({
            spacing: { before: 80 },
            children: [
              new TextRun({ text: `${l.loteNombre}: `, bold: true, size: 16 }),
              new TextRun({ text: l.observacion, size: 16 }),
            ],
          }),
      ),
    );
  }

  filasContenido.push(tituloSeccion("Hallazgos"));
  filasContenido.push(
    parDeTarjetas([
      {
        titulo: "Vigilancia Moko",
        valor: visita.mokoPresente,
        detalle:
          visita.mokoPresente && visita.mokoLotes?.length > 0
            ? `Lotes: ${visita.mokoLotes.map((l) => l.loteNombre).join(", ")}`
            : "",
      },
      {
        titulo: "Vigilancia Fusarium Oxysporum Cubense R4",
        valor: visita.fusariumPresente,
        detalle:
          visita.fusariumPresente && visita.fusariumLotes?.length > 0
            ? `Lotes: ${visita.fusariumLotes.map((l) => l.loteNombre).join(", ")}`
            : "",
      },
    ]),
  );

  filasContenido.push(tituloSeccion("Cumplimiento de protocolos de bioseguridad"));
  filasContenido.push(
    parDeTarjetas([
      { titulo: "FOC-R4 (Ley 2081 del 2024)", valor: visita.cumpleProtocoloFocR4, alarmaSi: false },
      { titulo: "Moko (Resolución ICA 1468 del 2013)", valor: visita.cumpleProtocoloMoko, alarmaSi: false },
    ]),
  );

  if (visita.checklistObservacion) {
    filasContenido.push(tituloSeccion("Observaciones y/o plan de acción"));
    filasContenido.push(new Paragraph({ children: [new TextRun({ text: visita.checklistObservacion, size: 18 })] }));
  }

  if (visita.fotos?.length > 0) {
    const resultados = await Promise.allSettled(visita.fotos.map((f) => cargarFotoParaWord(f.uuid)));
    const cargadas = resultados
      .map((r, i) => (r.status === "fulfilled" ? { ...r.value, nombre: visita.fotos[i].nombreOriginal } : null))
      .filter(Boolean);

    if (cargadas.length > 0) {
      filasContenido.push(
        new Paragraph({
          pageBreakBefore: true,
          spacing: { after: 150 },
          children: [new TextRun({ text: "Evidencia fotográfica", bold: true, size: 22 })],
        }),
      );

      // Cuadrícula de 2 columnas con celdas con borde, igual que el PDF —
      // cada foto conserva su proporción (contain) dentro de la celda.
      const anchoCelda = 250;
      const altoCelda = 190;
      const celdaFoto = (foto) => {
        const escala = Math.min(1, anchoCelda / foto.width, altoCelda / foto.height);
        return new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          borders: bordeTabla(),
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: foto.data,
                  type: foto.tipo,
                  transformation: {
                    width: Math.round(foto.width * escala),
                    height: Math.round(foto.height * escala),
                  },
                }),
              ],
            }),
            ...(foto.nombre
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40 },
                    children: [new TextRun({ text: foto.nombre, size: 14, color: COLOR_TEXTO_MUTED })],
                  }),
                ]
              : []),
          ],
        });
      };
      const celdaVacia = () =>
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELDA_SIN_BORDES, children: [] });

      const filasFotos = [];
      for (let i = 0; i < cargadas.length; i += 2) {
        filasFotos.push(
          new TableRow({
            children: [celdaFoto(cargadas[i]), cargadas[i + 1] ? celdaFoto(cargadas[i + 1]) : celdaVacia()],
          }),
        );
      }
      filasContenido.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filasFotos }));
    }
  }

  // Firmas: izquierda = revisor (rol configurable, solo si ya fue revisada),
  // derecha = quien registró la visita — ambas muestran el CARGO de la
  // persona, no su rol de permisos (ver laborCultural.service.js).
  filasContenido.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELDA_SIN_BORDES,
      rows: [
        new TableRow({
          children: [
            firmaColumna(
              visita.revisadoEn ? visita.revisadoPorNombre || "—" : "Pendiente de revisión",
              visita.revisadoEn ? visita.revisadoPorCargo || "Revisor" : "",
            ),
            firmaColumna(visita.usuarioNombre || "—", visita.usuarioCargo || "Responsable"),
          ],
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{ children: filasContenido }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visita_sanidad_vegetal_${visita.fincaNombre}_${visita.fecha}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
