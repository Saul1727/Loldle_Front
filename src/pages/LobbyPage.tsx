import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Brain, Copy, Check, LogOut, Sparkles, Image as ImageIcon, Loader2, Swords, User } from "lucide-react";
import { HextechPanel } from "../components/HextechPanel";
import { HextechButton } from "../components/HextechButton";
import { GameBoard } from "../components/GameBoard";
import { ApiError, createRoom, getRoom, joinRoom, type GameMode, type Room } from "../lib/api";

const MODES: { id: GameMode; label: string; description: string; icon: typeof Brain }[] = [
  {
    id: "CLASSIC",
    label: "Clasico",
    description: "Compara genero, region, especie y mas pistas en cada intento.",
    icon: Brain,
  },
  {
    id: "ABILITY",
    label: "Habilidad",
    description: "Adivina al campeon por el icono de una de sus habilidades.",
    icon: Sparkles,
  },
  {
    id: "SPLASH_ART",
    label: "Splash Art",
    description: "Adivina al campeon por su arte, revelado poco a poco.",
    icon: ImageIcon,
  },
];

export function LobbyPage({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [selectedMode, setSelectedMode] = useState<GameMode>("CLASSIC");
  const [room, setRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(code: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const updated = await getRoom(code);
        setRoom(updated);
        if (updated.status !== "WAITING" && pollRef.current) {
          window.clearInterval(pollRef.current);
        }
      } catch {
        // Fallo puntual de red al comprobar la sala: se reintenta en el siguiente ciclo.
      }
    }, 2000);
  }

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      const created = await createRoom(selectedMode);
      setRoom(created);
      startPolling(created.code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la sala");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSolo() {
    setError(null);
    setBusy(true);
    try {
      const created = await createRoom(selectedMode, true);
      setRoom(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo empezar la partida en solitario");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const joined = await joinRoom(joinCode.trim().toUpperCase());
      setRoom(joined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo unir a la sala");
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative min-h-screen px-4 py-8">
      <header className="mx-auto mb-10 flex max-w-4xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-teal-300" strokeWidth={1.5} />
          <span className="font-display text-lg font-bold tracking-[0.1em] text-gold-100">LOLDLE 1V1</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gold-200/70">{username}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-gold-200/50 transition-colors duration-150 hover:text-blood-500"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>

      {room ? (
        room.status === "WAITING" ? (
          <WaitingRoom room={room} onCopy={copyCode} copied={copied} />
        ) : (
          <GameBoard room={room} username={username} onExit={() => setRoom(null)} />
        )
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="mx-auto flex max-w-4xl flex-col gap-10"
        >
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-gold-100">Elige tu duelo</h1>
            <p className="mt-2 text-sm text-gold-200/60">
              El modo lo decide quien crea la sala. Tu rival lo hereda al unirse.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {MODES.map((mode, index) => {
              const Icon = mode.icon;
              const active = selectedMode === mode.id;
              return (
                <motion.button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
                  className={`flex flex-col items-center gap-3 border p-6 text-center transition-colors duration-150 ${
                    active
                      ? "border-teal-400/80 bg-teal-400/10 shadow-[0_0_30px_-8px_rgba(10,200,185,0.5)]"
                      : "border-gold-700/40 bg-panel/60 hover:border-gold-300/50"
                  }`}
                >
                  <Icon className={`h-7 w-7 ${active ? "text-teal-300" : "text-gold-300"}`} strokeWidth={1.5} />
                  <span className="font-display text-base font-semibold text-gold-100">{mode.label}</span>
                  <span className="text-xs text-gold-200/60">{mode.description}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <HextechPanel className="flex flex-col gap-4 p-6">
              <h2 className="font-display text-lg font-semibold text-gold-100">Crear sala</h2>
              <p className="text-sm text-gold-200/60">
                Se genera un codigo para que tu rival se una en modo {MODES.find((m) => m.id === selectedMode)?.label}.
              </p>
              <HextechButton onClick={handleCreate} disabled={busy} className="mt-auto w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear sala"}
              </HextechButton>
            </HextechPanel>

            <HextechPanel className="flex flex-col gap-4 p-6">
              <h2 className="font-display text-lg font-semibold text-gold-100">Unirse a sala</h2>
              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                <input
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Codigo de sala"
                  className="border border-gold-700/50 bg-void-950/70 px-3 py-2.5 text-center text-sm uppercase tracking-[0.2em] text-gold-100 outline-none transition-colors duration-150 placeholder:tracking-normal placeholder:text-gold-200/30 focus:border-teal-400/70"
                />
                <HextechButton type="submit" variant="ghost" disabled={busy} className="w-full">
                  Unirme
                </HextechButton>
              </form>
            </HextechPanel>

            <HextechPanel className="flex flex-col gap-4 p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-gold-100">
                <User className="h-4 w-4 text-teal-300" /> Solo infinito
              </h2>
              <p className="text-sm text-gold-200/60">
                Sin rival: adivina en modo {MODES.find((m) => m.id === selectedMode)?.label} y encadena partidas seguidas.
              </p>
              <HextechButton variant="ghost" onClick={handleCreateSolo} disabled={busy} className="mt-auto w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Jugar solo"}
              </HextechButton>
            </HextechPanel>
          </div>

          {error && (
            <p className="mx-auto border border-blood-500/40 bg-blood-500/10 px-4 py-2 text-sm text-blood-500">
              {error}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

function WaitingRoom({ room, onCopy, copied }: { room: Room; onCopy: () => void; copied: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="mx-auto max-w-md"
    >
      <HextechPanel className="flex flex-col items-center gap-5 p-10 text-center">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-400" />
        </span>
        <p className="text-sm uppercase tracking-widest text-gold-200/60">Esperando rival</p>

        <button
          onClick={onCopy}
          className="group flex items-center gap-3 border border-gold-700/50 bg-void-950/70 px-6 py-3 transition-colors duration-150 hover:border-teal-400/60"
        >
          <span className="font-display text-3xl font-bold tracking-[0.3em] text-gold-100">{room.code}</span>
          {copied ? (
            <Check className="h-4 w-4 text-teal-300" />
          ) : (
            <Copy className="h-4 w-4 text-gold-200/50 transition-colors duration-150 group-hover:text-gold-200" />
          )}
        </button>

        <p className="text-xs text-gold-200/50">Comparte este codigo con tu rival para que se una.</p>
      </HextechPanel>
    </motion.div>
  );
}
