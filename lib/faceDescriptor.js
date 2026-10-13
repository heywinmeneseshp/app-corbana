// Huella facial en el navegador: face-api (mismo motor y mismos modelos que usa la app de campo) calcula un vector de
// 128 números a partir de una imagen o del video de la webcam. Solo esos números se envían al servidor; NO se guarda
// ninguna foto. El motor y los modelos se sirven desde /public/face (sin pasar por el bundler).

const RUTA_MOTOR = "/face/face-api.js";
const RUTA_MODELOS = "/face/models";

// Calidad mínima para aceptar una captura (evita vectores malos que luego dan falsos rechazos).
const CONFIANZA_MIN = 0.5;
const ANCHO_CARA_MIN = 0.18; // la cara debe ocupar al menos 18 % del ancho de la imagen

let promesa = null;

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Solo disponible en el navegador"));
    if (window.faceapi) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el motor de reconocimiento facial"));
    document.head.appendChild(s);
  });
}

// Carga (una sola vez) el motor y los 3 modelos: detector de caras, puntos del rostro y huella facial.
export function cargarMotorFacial() {
  if (!promesa) {
    promesa = (async () => {
      await cargarScript(RUTA_MOTOR);
      const faceapi = window.faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(RUTA_MODELOS),
        faceapi.nets.faceLandmark68Net.loadFromUri(RUTA_MODELOS),
        faceapi.nets.faceRecognitionNet.loadFromUri(RUTA_MODELOS),
      ]);
      return faceapi;
    })().catch((err) => {
      promesa = null;
      throw err;
    });
  }
  return promesa;
}

// `elemento`: <video>, <img> o <canvas>. Devuelve { descriptor: number[128], confianza }.
// Lanza un Error con un mensaje claro si no hay cara, hay varias, es muy pequeña o la confianza es baja.
export async function descriptorDeElemento(elemento) {
  const faceapi = await cargarMotorFacial();
  const detecciones = await faceapi
    .detectAllFaces(elemento, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detecciones.length === 0) throw new Error("No se detecta ninguna cara. Acércate y mira a la cámara.");
  if (detecciones.length > 1) throw new Error("Se detectan varias caras. Debe verse una sola persona.");

  const [d] = detecciones;
  const ancho = elemento.videoWidth || elemento.naturalWidth || elemento.width;
  if (d.detection.score < CONFIANZA_MIN) throw new Error("La cara no se ve con claridad. Mejora la luz y mira de frente.");
  if (ancho && d.detection.box.width / ancho < ANCHO_CARA_MIN) throw new Error("La cara se ve muy lejos. Acércate a la cámara.");

  return { descriptor: Array.from(d.descriptor), confianza: d.detection.score };
}
