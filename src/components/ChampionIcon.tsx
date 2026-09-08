import { useState } from "react";
import { championIconUrl } from "../lib/api";

// Retrato circular de un campeon con marco hextech. Si el icono todavia no esta
// poblado en la base de datos (404, campeones antiguos antes de que existiera este
// campo), se degrada a una insignia con la inicial en vez de un hueco de <img> roto.
export function ChampionIcon({ name, size = 40 }: { name: string; size?: number }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-gold-700/50 bg-void-950/80 font-display text-gold-300"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={championIconUrl(name)}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className="shrink-0 rounded-full border border-gold-700/60 bg-void-950 object-cover shadow-[0_0_10px_-3px_rgba(200,155,60,0.5)]"
      style={{ width: size, height: size }}
    />
  );
}
