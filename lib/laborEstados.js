"use client";

import { getCurrentUser } from "./auth";

// Estados y reglas de bloqueo de las labores programadas. Hay 3 estados
// (programada, completada y cancelada); "retrasada" es un derivado: una
// programada cuya fecha ya pasó.

export function fechaHoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// PROGRAMADA cuya fecha ya pasó.
export function esOcurrenciaRetrasada(oc) {
  return oc.estado === "PROGRAMADA" && oc.fecha < fechaHoyIso();
}

// Días de retraso de una ocurrencia (si los hubo). Completada: días entre la
// fecha programada y la ejecutada. Programada vencida: días entre la fecha
// programada y hoy. Nunca negativo.
export function diasRetraso(oc) {
  const base = oc.estado === "COMPLETADA" ? oc.ejecutadaEl : oc.fecha;
  if (!base) return 0;
  const inicio = new Date(`${oc.fecha}T00:00:00`);
  const fin = new Date(`${base}T00:00:00`);
  const dias = Math.round((fin - inicio) / 86400000);
  return dias > 0 ? dias : 0;
}

// Tareas que no deberían editarse: completadas o con fecha ya pasada.
export function estaBloqueada(oc) {
  return oc.estado === "COMPLETADA" || oc.fecha < fechaHoyIso();
}

export function esAdministrador() {
  return (getCurrentUser()?.roles || []).includes("Administrador");
}

// ¿El usuario actual puede editar esta ocurrencia? Solo si es administrador
// o la tarea no está bloqueada.
export function puedeEditarOcurrencia(oc) {
  return esAdministrador() || !estaBloqueada(oc);
}