import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, Crown, Flag, Loader2, LogOut, RotateCcw, Swords } from "lucide-react";
import { HextechPanel } from "./HextechPanel";
import { HextechButton } from "./HextechButton";
import { ChampionAutocomplete } from "./ChampionAutocomplete";
import { ChampionIcon } from "./ChampionIcon";
import {
  ApiError,
  abandonRoom,
  fetchRoomMediaUrl,
  getChampionNames,
  getRoomState,
  leaveRoom,
  rematchRoom,
  type FieldResult,
  type GuessBroadcast,
  type MatchResult,
  type Room,
  type YearHint,
} from "../lib/api";
import { RoomSocket } from "../lib/ws";
import {
  genderLabel,
  positionLabel,
  rangeTypeLabel,
  regionLabel,
  resourceLabel,
  speciesLabel,
} from "../lib/championLabels";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type LiveGuess = GuessBroadcast & { id: number };

// El tablero real de una partida (1v1 o solo): historial de intentos en vivo por
// WebSocket, mas el estado inicial por REST para poder reconstruirlo si se recarga
// la pagina o se entra despues de que ya haya intentos hechos.
export function GameBoard({ room: initialRoom, username, onExit }: { room: Room; username: string; onExit: () => void }) {
  const code = initialRoom.code;
  const gameMode = initialRoom.gameMode;
  const isSolo = initialRoom.solo;

  const [room, setRoom] = useState(initialRoom);
  const [guesses, setGuesses] = useState<LiveGuess[]>([]);
  const [championNames, setChampionNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hintUrl, setHintUrl] = useState<string | null>(null);
  const socketRef = useRef<RoomSocket | null>(null);
  const hintUrlRef = useRef<string | null>(null);
  const nextGuessId = useRef(0);

  async function loadHint() {
    if (gameMode === "CLASSIC") return;
    try {
      const url = await fetchRoomMediaUrl(code);
      if (hintUrlRef.current) URL.revokeObjectURL(hintUrlRef.current);
      hintUrlRef.current = url;
      setHintUrl(url);
    } catch {
      // Sin pista disponible no es un fallo critico: se puede seguir jugando a ciegas.
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [state, names] = await Promise.all([getRoomState(code), getChampionNames()]);
        if (cancelled) return;
        setRoom(state.room);
        const ordered = [...state.guesses].reverse().map((g) => ({ ...g, id: nextGuessId.current++ }));
        setGuesses(ordered);
        setChampionNames(names);
        await loadHint();
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudo cargar la partida");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [code]);

  useEffect(() => {
    const socket = new RoomSocket(code, {
      onRoomUpdate: (updated) => {
        setRoom((prev) => {
          const wasTerminal = prev.status === "FINISHED" || prev.status === "ABANDONED";
          if (wasTerminal && updated.status === "IN_PROGRESS") {
            setGuesses([]);
            setError(null);
            void loadHint();
          }
          return updated;
        });
      },
      onGuess: (guess) => {
        setPending(false);
        setGuesses((prev) => [{ ...guess, id: nextGuessId.current++ }, ...prev]);
        setRoom((prev) => ({
          ...prev,
          status: guess.roomFinished ? "FINISHED" : prev.status,
          winnerUsername: guess.winnerUsername ?? prev.winnerUsername,
          currentTurnUsername: guess.nextTurnUsername ?? prev.currentTurnUsername,
        }));
      },
      onError: (message) => {
        setPending(false);
        setError(message);
      },
    });
    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line
  }, [code]);

  useEffect(() => {
    return () => {
      if (hintUrlRef.current) URL.revokeObjectURL(hintUrlRef.current);
    };
  }, []);

  const isMyTurn =
    room.status === "IN_PROGRESS" &&
    (isSolo || (room.currentTurnUsername?.toLowerCase() ?? "") === username.toLowerCase());
  const opponentUsername = isSolo
    ? null
    : room.hostUsername.toLowerCase() === username.toLowerCase()
      ? room.guestUsername
      : room.hostUsername;
  const isTerminal = room.status === "FINISHED" || room.status === "ABANDONED";

  function handleGuess(name: string) {
    if (!socketRef.current || pending || !isMyTurn) return;
    setError(null);
    setPending(true);
    socketRef.current.guess(code, name);
  }

  async function handleAbandon() {
    setError(null);
    setPending(true);
    try {
      await abandonRoom(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo rendir la partida");
    } finally {
      setPending(false);
    }
  }

  async function handleRematch() {
    setError(null);
    setPending(true);
    try {
      await rematchRoom(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo pedir otra partida");
      setPending(false);
    }
  }

  async function handleLeave() {
    setPending(true);
    try {
      await leaveRoom(code);
    } catch {
      // Si la sala ya no existe (el rival tambien salio y se borro), da igual: salimos.
    } finally {
      socketRef.current?.disconnect();
      onExit();
    }
  }

  function endMessage(): string {
    if (room.status === "FINISHED") {
      if (isSolo) {
        const revealed = guesses.find((g) => g.result?.correctGuess)?.result?.guessedChampion;
        return revealed ? `Acertaste. Era ${revealed}.` : "Acertaste.";
      }
      return room.winnerUsername?.toLowerCase() === username.toLowerCase()
        ? "Has ganado el duelo."
        : `Ha ganado ${room.winnerUsername ?? "tu rival"}.`;
    }
    if (isSolo) return "Te has rendido.";
    if (room.winnerUsername?.toLowerCase() === username.toLowerCase()) {
      return "Tu rival ha abandonado: has ganado.";
    }
    return "Has abandonado la partida.";
  }

  const won = room.status === "FINISHED" && (isSolo || room.winnerUsername?.toLowerCase() === username.toLowerCase());
  const revealedName = won && isSolo ? guesses.find((g) => g.result?.correctGuess)?.result?.guessedChampion : null;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gold-300" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      <DuelBanner room={room} username={username} isSolo={isSolo} opponentUsername={opponentUsername} isMyTurn={isMyTurn} />

      {gameMode !== "CLASSIC" && (
        <HintPanel gameMode={gameMode} hintUrl={hintUrl} guessCount={guesses.length} />
      )}

      <AnimatePresence mode="wait">
        {isTerminal && (
          <EndBanner
            key={room.status}
            won={won}
            message={endMessage()}
            revealedName={revealedName}
            isSolo={isSolo}
            pending={pending}
            onRematch={handleRematch}
            onLeave={handleLeave}
          />
        )}
      </AnimatePresence>

      {room.status === "IN_PROGRESS" && (
        <HextechPanel
          className={`flex flex-col gap-3 p-4 transition-shadow duration-300 ${
            isMyTurn ? "shadow-[0_0_34px_-10px_rgba(10,200,185,0.45)]" : ""
          }`}
        >
          <ChampionAutocomplete names={championNames} disabled={!isMyTurn || pending} onGuess={handleGuess} />
          <div className="flex items-center justify-between">
            {!isMyTurn && !isSolo && <p className="text-xs text-gold-200/50">Espera tu turno...</p>}
            <button
              type="button"
              onClick={handleAbandon}
              disabled={pending}
              className="ml-auto flex items-center gap-1.5 text-xs text-gold-200/40 transition-colors duration-150 hover:text-blood-500 disabled:opacity-40"
            >
              <Flag className="h-3.5 w-3.5" /> Rendirse
            </button>
          </div>
        </HextechPanel>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border border-blood-500/40 bg-blood-500/10 px-4 py-2 text-center text-sm text-blood-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {guesses.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex min-w-[680px] flex-col gap-1.5">
            {gameMode === "CLASSIC" && (
              <div className="grid grid-cols-[minmax(9rem,1.3fr)_repeat(7,1fr)] gap-1.5 px-1 text-[10px] uppercase tracking-wider text-gold-200/50">
                <span>Campeon</span>
                <span>Genero</span>
                <span>Posicion</span>
                <span>Especie</span>
                <span>Recurso</span>
                <span>Alcance</span>
                <span>Region</span>
                <span>Año</span>
              </div>
            )}
            {guesses.map((guess) => (
              <GuessRow key={guess.id} guess={guess} mode={gameMode} showUsername={!isSolo} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DuelBanner({
  room,
  username,
  isSolo,
  opponentUsername,
  isMyTurn,
}: {
  room: Room;
  username: string;
  isSolo: boolean;
  opponentUsername: string | null;
  isMyTurn: boolean;
}) {
  const modeLabel = room.gameMode === "CLASSIC" ? "Clasico" : room.gameMode === "ABILITY" ? "Habilidad" : "Splash Art";

  if (isSolo) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-gold-200/50">
          <Swords className="h-3.5 w-3.5 text-teal-300" strokeWidth={1.5} /> Solo infinito
        </p>
        <p className="font-display text-2xl font-bold text-gold-100">{modeLabel}</p>
      </div>
    );
  }

  const hostIsMe = room.hostUsername.toLowerCase() === username.toLowerCase();
  const myTurnSide = hostIsMe ? "host" : "guest";

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs uppercase tracking-[0.25em] text-gold-200/50">{modeLabel}</p>
      <div className="flex w-full items-center justify-center gap-4 sm:gap-8">
        <PlayerChip
          label={room.hostUsername}
          isYou={hostIsMe}
          active={room.status === "IN_PROGRESS" && isMyTurn === (myTurnSide === "host")}
        />
        <span className="font-display text-lg font-bold tracking-widest text-gold-300/70">VS</span>
        <PlayerChip
          label={opponentUsername ?? room.guestUsername ?? "?"}
          isYou={!hostIsMe}
          active={room.status === "IN_PROGRESS" && isMyTurn === (myTurnSide === "guest")}
        />
      </div>
    </div>
  );
}

function PlayerChip({ label, isYou, active }: { label: string; isYou: boolean; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex h-11 w-11 items-center justify-center">
        {active && <span className="absolute inset-0 animate-ping rounded-full bg-teal-400/25" />}
        <div
          className={`relative flex h-11 w-11 items-center justify-center rounded-full border font-display text-lg font-bold transition-colors duration-300 ${
            active
              ? "border-teal-400/80 bg-teal-400/10 text-teal-200 shadow-[0_0_18px_-4px_rgba(10,200,185,0.6)]"
              : "border-gold-700/50 bg-void-950/60 text-gold-200/70"
          }`}
        >
          {label.charAt(0).toUpperCase()}
        </div>
      </div>
      <span className={`text-xs font-semibold ${active ? "text-teal-300" : "text-gold-200/60"}`}>
        {label}
        {isYou ? " (tu)" : ""}
      </span>
    </div>
  );
}

function HintPanel({
  gameMode,
  hintUrl,
  guessCount,
}: {
  gameMode: Room["gameMode"];
  hintUrl: string | null;
  guessCount: number;
}) {
  return (
    <HextechPanel className="mx-auto flex w-full max-w-xs flex-col items-center gap-3 p-4">
      <p className="text-xs uppercase tracking-widest text-gold-200/60">
        {gameMode === "ABILITY" ? "Icono de habilidad" : "Splash art"}
      </p>
      <div className="relative h-40 w-40 overflow-hidden rounded-sm border border-gold-700/50 bg-void-950/70">
        <AnimatePresence mode="wait">
          {hintUrl ? (
            <motion.img
              key={hintUrl}
              src={hintUrl}
              alt="Pista del campeon secreto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full object-cover"
              style={
                gameMode === "SPLASH_ART"
                  ? { transform: `scale(${Math.max(1, 3.2 - guessCount * 0.4)})`, transition: "transform 0.4s ease-out" }
                  : undefined
              }
            />
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full w-full items-center justify-center"
            >
              <Loader2 className="h-5 w-5 animate-spin text-gold-300" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(0,0,0,0.55)]" />
      </div>
    </HextechPanel>
  );
}

function EndBanner({
  won,
  message,
  revealedName,
  isSolo,
  pending,
  onRematch,
  onLeave,
}: {
  won: boolean;
  message: string;
  revealedName?: string | null;
  isSolo: boolean;
  pending: boolean;
  onRematch: () => void;
  onLeave: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      <HextechPanel
        className={`relative flex flex-col items-center gap-4 overflow-hidden p-6 text-center ${
          won ? "border-teal-400/50" : "border-blood-500/40"
        }`}
      >
        {won && (
          <motion.div
            initial={{ x: "-130%" }}
            animate={{ x: "130%" }}
            transition={{ duration: 1.1, ease: EASE_OUT }}
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-teal-300/15 to-transparent"
          />
        )}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.05, ease: EASE_OUT }}
        >
          {won ? (
            <Crown className="h-8 w-8 text-teal-300" strokeWidth={1.5} />
          ) : (
            <Flag className="h-8 w-8 text-blood-500/80" strokeWidth={1.5} />
          )}
        </motion.div>
        <div>
          <p className="font-display text-lg font-semibold text-gold-100">{message}</p>
          {revealedName && !message.includes(revealedName) && (
            <p className="mt-1 text-sm text-gold-200/60">Era {revealedName}.</p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <HextechButton onClick={onRematch} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {isSolo ? "Otra partida" : "Revancha"}
          </HextechButton>
          <HextechButton variant="ghost" onClick={onLeave} disabled={pending}>
            <LogOut className="h-4 w-4" /> Salir
          </HextechButton>
        </div>
      </HextechPanel>
    </motion.div>
  );
}

function cellClasses(result?: MatchResult) {
  switch (result) {
    case "CORRECT":
      return "border-teal-400/60 bg-teal-400/15 text-teal-100";
    case "PARTIAL":
      return "border-gold-300/60 bg-gold-300/15 text-gold-100";
    case "INCORRECT":
      return "border-blood-500/50 bg-blood-500/10 text-blood-400";
    default:
      return "border-gold-700/40 bg-void-950/60 text-gold-200/60";
  }
}

function Cell({ label, result, delay = 0 }: { label: string; result?: MatchResult; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, delay, ease: EASE_OUT }}
      className={`flex min-h-[3rem] items-center justify-center border px-1.5 py-1 text-center text-xs ${cellClasses(result)}`}
    >
      {label}
    </motion.div>
  );
}

function NameCell({ name, correct, delay = 0 }: { name: string; correct: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, delay, ease: EASE_OUT }}
      className={`flex min-h-[3rem] items-center gap-2 border px-2 py-1 text-xs font-display font-semibold ${cellClasses(
        correct ? "CORRECT" : "INCORRECT"
      )}`}
    >
      <ChampionIcon name={name} size={28} />
      <span className="truncate">{name}</span>
    </motion.div>
  );
}

function YearCell({ fieldResult, hint, delay = 0 }: { fieldResult?: FieldResult<number> | null; hint?: YearHint | null; delay?: number }) {
  if (!fieldResult) return <Cell label="?" delay={delay} />;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, delay, ease: EASE_OUT }}
      className={`flex min-h-[3rem] items-center justify-center gap-1 border px-1.5 py-1 text-xs ${cellClasses(fieldResult.result)}`}
    >
      <span>{fieldResult.value}</span>
      {hint === "HIGHER" && <ArrowUp className="h-3.5 w-3.5" />}
      {hint === "LOWER" && <ArrowDown className="h-3.5 w-3.5" />}
    </motion.div>
  );
}

function GuessRow({
  guess,
  mode,
  showUsername,
}: {
  guess: GuessBroadcast;
  mode: Room["gameMode"];
  showUsername: boolean;
}) {
  const r = guess.result;

  if (mode !== "CLASSIC") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className={`flex items-center gap-3 border px-3 py-2 text-sm ${
          r?.correctGuess
            ? "border-teal-400/60 bg-teal-400/15 text-teal-100"
            : "border-blood-500/40 bg-blood-500/10 text-blood-400"
        }`}
      >
        {r?.guessedChampion && <ChampionIcon name={r.guessedChampion} size={30} />}
        <span className="flex-1">{r?.guessedChampion ?? "?"}</span>
        {showUsername && <span className="text-xs text-gold-200/50">{guess.username}</span>}
      </motion.div>
    );
  }

  if (!r) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="flex flex-col gap-1"
    >
      {showUsername && <span className="px-1 text-[10px] uppercase tracking-wider text-gold-200/40">{guess.username}</span>}
      <div className="grid grid-cols-[minmax(9rem,1.3fr)_repeat(7,1fr)] gap-1.5">
        <NameCell name={r.guessedChampion} correct={r.correctGuess} delay={0} />
        <Cell label={genderLabel(r.gender?.value)} result={r.gender?.result} delay={0.02} />
        <Cell
          label={(r.positions?.value ?? []).map(positionLabel).join(" / ") || "?"}
          result={r.positions?.result}
          delay={0.04}
        />
        <Cell label={speciesLabel(r.species?.value)} result={r.species?.result} delay={0.06} />
        <Cell label={resourceLabel(r.resource?.value)} result={r.resource?.result} delay={0.08} />
        <Cell label={rangeTypeLabel(r.rangeType?.value)} result={r.rangeType?.result} delay={0.1} />
        <Cell label={regionLabel(r.region?.value)} result={r.region?.result} delay={0.12} />
        <YearCell fieldResult={r.year} hint={r.yearHint} delay={0.14} />
      </div>
    </motion.div>
  );
}
