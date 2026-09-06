import type { ReactNode } from "react";
import clsx from "clsx";

// Panel de cristal oscuro con marco dorado y esquinas en angulo, al estilo de
// los paneles del propio cliente de League. Es el contenedor base para
// formularios y tarjetas de toda la app, para que todas las pantallas
// compartan el mismo lenguaje visual en vez de cada una inventar su propia caja.
export function HextechPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative border border-gold-700/60 bg-panel/80 backdrop-blur-md shadow-[0_0_60px_-15px_rgba(10,200,185,0.25)]",
        className
      )}
    >
      <PanelCorner className="left-0 top-0 -translate-x-px -translate-y-px" />
      <PanelCorner className="right-0 top-0 translate-x-px -translate-y-px rotate-90" />
      <PanelCorner className="bottom-0 right-0 translate-x-px translate-y-px rotate-180" />
      <PanelCorner className="bottom-0 left-0 -translate-x-px translate-y-px -rotate-90" />
      {children}
    </div>
  );
}

function PanelCorner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none absolute h-4 w-4 border-l-2 border-t-2 border-gold-300",
        className
      )}
    />
  );
}
