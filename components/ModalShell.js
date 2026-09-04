export default function ModalShell({ title, onClose, children, size, width, height, minHeight, fullscreen }) {
  const alto = fullscreen ? "100vh" : height || "85vh";
  return (
    <div
      className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${fullscreen ? "" : "p-3"}`}
      style={{ backgroundColor: "rgba(15,23,42,0.4)", zIndex: 1050 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white shadow w-100 d-flex flex-column ${fullscreen ? "" : "rounded-4"}`}
        style={{
          maxWidth: fullscreen ? "100vw" : width || (size === "xl" ? "64rem" : size === "lg" ? "36rem" : "28rem"),
          maxHeight: alto,
          minHeight: fullscreen ? undefined : minHeight,
          height: fullscreen ? "100vh" : undefined,
        }}
      >
        <div className={`d-flex align-items-center justify-content-between ${fullscreen ? "px-3 py-2 border-bottom" : "p-4 pb-0"}`}>
          <h3 className={`fw-bold mb-0 ${fullscreen ? "h6" : "h5"}`}>{title}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar"></button>
        </div>
        <div
          className={fullscreen ? "flex-grow-1 d-flex flex-column overflow-hidden" : "p-4 overflow-y-auto"}
          style={{ maxHeight: fullscreen ? undefined : `calc(${alto} - 4rem)` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
