import { apiFetchBlob } from "@/lib/api";

// Firma (PNG) de un usuario, recortada a su trazo. El panel guarda el lienzo completo (casi toda la pantalla); si la persona firmó
// pequeño o en una esquina, al escalar el lienzo entero el trazo queda diminuto en el PDF. Se quita el margen vacío (transparente o
// blanco) y se deja un pequeño borde. Devuelve { dataUrl, width, height } o null si no tiene firma o falla.
export async function cargarFirmaRecortada(path) {
  try {
    const blob = await apiFetchBlob(path);
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 100;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, w, h);
      let x0 = w;
      let y0 = h;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const k = (y * w + x) * 4;
          const tinta = data[k + 3] > 20 && (data[k] < 200 || data[k + 1] < 200 || data[k + 2] < 200);
          if (tinta) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return { dataUrl: canvas.toDataURL("image/png"), width: w, height: h };
      const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04) + 4;
      x0 = Math.max(0, x0 - pad);
      y0 = Math.max(0, y0 - pad);
      x1 = Math.min(w - 1, x1 + pad);
      y1 = Math.min(h - 1, y1 + pad);
      const cw = x1 - x0 + 1;
      const ch = y1 - y0 + 1;
      const recorte = document.createElement("canvas");
      recorte.width = cw;
      recorte.height = ch;
      recorte.getContext("2d").drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
      return { dataUrl: recorte.toDataURL("image/png"), width: cw, height: ch };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}
