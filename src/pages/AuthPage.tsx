import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Loader2 } from "lucide-react";
import { HextechPanel } from "../components/HextechPanel";
import { HextechButton } from "../components/HextechButton";
import { ApiError, loginUser, registerUser } from "../lib/api";

type Mode = "login" | "register";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (token: string, username: string) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await registerUser(username, password);
      }
      const auth = await loginUser(username, password);
      onAuthenticated(auth.token, auth.username);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo conectar con el servidor");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center border border-gold-300/70 bg-void-950/60">
            <Swords className="h-6 w-6 text-teal-300" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-[0.15em] text-gold-100 text-glow-teal">
            LOLDLE <span className="text-teal-300">1V1</span>
          </h1>
          <p className="max-w-xs text-sm text-gold-200/70">
            Duelo por turnos: adivina al campeon secreto antes que tu rival.
          </p>
        </div>

        <HextechPanel className="p-8">
          <div className="relative mb-6 flex border-b border-gold-700/40">
            {(["login", "register"] as Mode[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                  setError(null);
                }}
                className={`relative flex-1 pb-3 text-sm font-semibold uppercase tracking-wide transition-colors duration-150 ${
                  mode === tab ? "text-teal-300" : "text-gold-200/50 hover:text-gold-200"
                }`}
              >
                {tab === "login" ? "Iniciar sesion" : "Crear cuenta"}
                {mode === tab && (
                  <motion.span
                    layoutId="auth-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-teal-400"
                    transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }}
                  />
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-gold-200/60">
                Nombre de invocador
              </span>
              <input
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="border border-gold-700/50 bg-void-950/70 px-3 py-2.5 text-sm text-gold-100 outline-none transition-colors duration-150 placeholder:text-gold-200/30 focus:border-teal-400/70"
                placeholder="TuNombre"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-gold-200/60">Contrasena</span>
              <input
                required
                minLength={8}
                maxLength={72}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="border border-gold-700/50 bg-void-950/70 px-3 py-2.5 text-sm text-gold-100 outline-none transition-colors duration-150 placeholder:text-gold-200/30 focus:border-teal-400/70"
                placeholder="Minimo 8 caracteres"
              />
            </label>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border border-blood-500/40 bg-blood-500/10 px-3 py-2 text-sm text-blood-500"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <HextechButton type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Entrar a la grieta"
              ) : (
                "Crear cuenta"
              )}
            </HextechButton>
          </form>
        </HextechPanel>
      </motion.div>
    </div>
  );
}
