// Grafo bidireccional de conversiones entre unidades — mismo algoritmo que
// el backend (api-rest-corbana/src/utils/unidadConversion.js), para que
// "qué se puede convertir" responda igual en las dos puntas. Cada fila de
// `unidad_conversiones` (origen→destino, factor) también habilita el
// sentido inverso (destino→origen, 1/factor), y se puede resolver un
// camino encadenado aunque no exista una conversión DIRECTA entre dos
// unidades (ej. ml→L→Ton).
export function construirGrafoUnidades(conversiones) {
  const grafo = new Map();
  const agregarArista = (desde, hasta, factor) => {
    if (!desde || !hasta || !Number.isFinite(factor) || factor === 0) return;
    if (!grafo.has(desde)) grafo.set(desde, []);
    grafo.get(desde).push({ hasta, factor });
  };
  for (const c of conversiones) {
    const origenUuid = c.unidadOrigen?.uuid;
    const destinoUuid = c.unidadDestino?.uuid;
    const factor = Number(c.factor);
    agregarArista(origenUuid, destinoUuid, factor);
    agregarArista(destinoUuid, origenUuid, 1 / factor);
  }
  return grafo;
}

// BFS: la primera vez que se llega al destino ya es el camino más corto.
export function convertirCantidad(grafo, origenUuid, destinoUuid, cantidad) {
  if (!origenUuid || !destinoUuid) return null;
  if (origenUuid === destinoUuid) return cantidad;
  const visitados = new Set([origenUuid]);
  const cola = [{ id: origenUuid, factorAcumulado: 1 }];
  while (cola.length) {
    const { id, factorAcumulado } = cola.shift();
    for (const { hasta, factor } of grafo.get(id) || []) {
      if (visitados.has(hasta)) continue;
      const nuevoFactor = factorAcumulado * factor;
      if (hasta === destinoUuid) return cantidad * nuevoFactor;
      visitados.add(hasta);
      cola.push({ id: hasta, factorAcumulado: nuevoFactor });
    }
  }
  return null;
}

// Todas las unidades alcanzables desde `unidadBaseUuid` (incluida ella
// misma) — usado para sugerir en un selector solo las unidades
// "compatibles" con el artículo elegido (la suya propia, más las que se
// puedan convertir directa o encadenadamente a esa), en vez de mostrar
// todo el catálogo sin filtrar.
export function unidadesAlcanzables(grafo, unidadBaseUuid) {
  const alcanzables = new Set();
  if (!unidadBaseUuid) return alcanzables;
  alcanzables.add(unidadBaseUuid);
  const cola = [unidadBaseUuid];
  while (cola.length) {
    const id = cola.shift();
    for (const { hasta } of grafo.get(id) || []) {
      if (alcanzables.has(hasta)) continue;
      alcanzables.add(hasta);
      cola.push(hasta);
    }
  }
  return alcanzables;
}
