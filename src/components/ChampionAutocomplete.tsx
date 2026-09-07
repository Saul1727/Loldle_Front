import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { HextechButton } from "./HextechButton";

// Campo de texto con desplegable de sugerencias para escribir un intento. Solo deja
// mandar un nombre que exista de verdad en la lista de campeones (comparacion sin
// mayusculas): si no hay coincidencia exacta, el formulario no hace nada en vez de
// mandar un intento que el backend va a rechazar como "campeon no encontrado".
export function ChampionAutocomplete({
  names,
  disabled,
  onGuess,
}: {
  names: string[];
  disabled?: boolean;
  onGuess: (championName: string) => void;
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    const starts = names.filter((n) => n.toLowerCase().startsWith(query));
    const rest = names.filter((n) => !n.toLowerCase().startsWith(query) && n.toLowerCase().includes(query));
    return [...starts, ...rest].slice(0, 6);
  }, [names, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function commit(candidate: string) {
    const exact = names.find((n) => n.toLowerCase() === candidate.trim().toLowerCase());
    if (!exact) return;
    onGuess(exact);
    setValue("");
    setOpen(false);
    setHighlight(0);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (open && matches[highlight]) {
      commit(matches[highlight]);
    } else {
      commit(value);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Nombre del campeon..."
          autoComplete="off"
          className="w-full border border-gold-700/50 bg-void-950/70 px-3 py-2.5 text-sm text-gold-100 outline-none transition-colors duration-150 placeholder:text-gold-200/30 focus:border-teal-400/70 disabled:opacity-40"
        />
        <HextechButton type="submit" disabled={disabled} className="shrink-0">
          Adivinar
        </HextechButton>
      </form>

      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full border border-gold-700/50 bg-void-950/95 backdrop-blur-sm">
          {matches.map((name, index) => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(name)}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors duration-100 ${
                  index === highlight ? "bg-teal-400/15 text-teal-200" : "text-gold-100 hover:bg-gold-700/10"
                }`}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
