import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "ghost";

// Boton con feedback tactil (se encoge un poco al pulsar) mediante una
// transicion CSS normal, no con una libreria de animacion: es un cambio de
// estado simple y predecible (":active"), y las transiciones CSS van por GPU
// sin depender de JS para algo que ocurre en cada clic.
export function HextechButton({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 border px-6 py-2.5 font-display text-sm font-semibold tracking-wide uppercase",
        "transition-[transform,box-shadow,background-color] duration-150 ease-out active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        variant === "primary" &&
          "border-teal-400/70 bg-teal-400/10 text-teal-300 hover:bg-teal-400/20 hover:shadow-[0_0_24px_-4px_rgba(10,200,185,0.55)]",
        variant === "ghost" &&
          "border-gold-700/70 bg-transparent text-gold-200 hover:bg-gold-700/10 hover:border-gold-300",
        className
      )}
    >
      {props.children}
    </button>
  );
}
