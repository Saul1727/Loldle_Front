import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RiftBackground } from "./components/RiftBackground";
import { AuthPage } from "./pages/AuthPage";
import { LobbyPage } from "./pages/LobbyPage";

type Session = { token: string; username: string } | null;

export default function App() {
  const [session, setSession] = useState<Session>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("loldle_token");
    const username = localStorage.getItem("loldle_username");
    if (token && username) {
      setSession({ token, username });
    }
    setCheckedStorage(true);
  }, []);

  function handleAuthenticated(token: string, username: string) {
    localStorage.setItem("loldle_token", token);
    localStorage.setItem("loldle_username", username);
    setSession({ token, username });
  }

  function handleLogout() {
    localStorage.removeItem("loldle_token");
    localStorage.removeItem("loldle_username");
    setSession(null);
  }

  if (!checkedStorage) {
    return <RiftBackground />;
  }

  return (
    <>
      <RiftBackground />
      <AnimatePresence mode="wait">
        {session ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <LobbyPage username={session.username} onLogout={handleLogout} />
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AuthPage onAuthenticated={handleAuthenticated} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
