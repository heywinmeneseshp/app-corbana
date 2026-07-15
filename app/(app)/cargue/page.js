"use client";

import { useRef, useState } from "react";

export default function CargueMasivoPage() {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const inputRef = useRef(null);

  const simulate = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(100, (prev ?? 0) + Math.random() * 15 + 5);
        if (next >= 100) clearInterval(interval);
        return next;
      });
    }, 300);
  };

  return (
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Cargue Masivo</h1>
        <p className="text-secondary mb-0">Sube múltiples fincas y lotes a la vez mediante un archivo de datos.</p>
      </div>

      <div className="card border-0 shadow-sm rounded-4 p-4" style={{ maxWidth: "42rem" }}>
        <label
          htmlFor="fileInput"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          className="d-flex flex-column align-items-center justify-content-center text-center rounded-4 py-5 px-3"
          style={{
            border: `2px dashed ${dragOver ? "var(--brand-700)" : "rgba(21,128,61,0.4)"}`,
            backgroundColor: dragOver ? "#f0fdf4" : "var(--brand-50)",
            cursor: "pointer",
          }}
        >
          <div className="mb-2 text-brand">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.5a4 4 0 0 1 1 7.87" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 12v7m0-7 3 3m-3-3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="fw-medium mb-1">Arrastra aquí tu archivo Excel o CSV, o haz clic para explorar</p>
          <p className="small text-secondary mb-0">Formatos soportados: .xlsx, .csv. Máximo 10MB</p>
          <input ref={inputRef} id="fileInput" type="file" accept=".xlsx,.csv" className="d-none" />
        </label>

        <div className="d-flex align-items-center justify-content-between mt-4">
          <button type="button" className="btn btn-link text-brand text-decoration-none p-0" onClick={simulate}>
            Simular subida de archivo →
          </button>
          <button type="button" className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Descargar Plantilla de Ejemplo (.xlsx)
          </button>
        </div>

        {progress !== null && (
          <div className="mt-4">
            <div className="d-flex justify-content-between small mb-1">
              <span className="fw-medium">
                procesando_lotes_corbana.csv{progress >= 100 ? " - completado" : ""}
              </span>
              <span className="text-secondary">{Math.floor(progress)}%</span>
            </div>
            <div className="progress" style={{ height: "0.6rem" }}>
              <div
                className="progress-bar"
                style={{ width: `${progress}%`, backgroundColor: "var(--brand-700)" }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
