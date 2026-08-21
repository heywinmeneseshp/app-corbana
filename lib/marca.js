"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

// Nombre y logo de la app, configurables desde Configuración → Marca de la
// App (solo Administrador). Público (sin auth) porque el login y el
// sidebar necesitan mostrarlo antes de iniciar sesión.
export const MARCA_DEFAULT = { nombreApp: "Corbana", logoUrl: null };

let cache = null; // null = todavía no se cargó
let cargando = null;
const listeners = new Set();

function notificar() {
  listeners.forEach((fn) => fn(cache));
}

async function cargar() {
  if (cache) return cache;
  if (cargando) return cargando;
  cargando = apiFetch("/configuraciones/marca")
    .then((data) => {
      cache = { ...MARCA_DEFAULT, ...data };
      notificar();
      return cache;
    })
    .catch(() => {
      cache = MARCA_DEFAULT;
      return cache;
    })
    .finally(() => {
      cargando = null;
    });
  return cargando;
}

// Llamar después de guardar cambios en el formulario de configuración, para
// que el Sidebar y el resto de la app reflejen el cambio sin recargar.
export function refrescarMarca() {
  cache = null;
  return cargar();
}

// Hook para componentes cliente (Sidebar, login, etc.).
export function useMarca() {
  const [marca, setMarca] = useState(cache || MARCA_DEFAULT);

  useEffect(() => {
    const listener = (nueva) => setMarca(nueva);
    listeners.add(listener);
    cargar().then(setMarca);
    return () => listeners.delete(listener);
  }, []);

  return marca;
}

// Para código no-React (ej. generación de PDF): trae la marca actual
// (usando el cache si ya está listo).
export function obtenerMarca() {
  return cargar();
}
