import { createRoot } from "react-dom/client";
import '@/i18n';
import App from "./App.tsx";
import "./index.css";
import { startLoopDetectorAuto } from "./lib/loopDetectorAutoStart";

// Auto-recover from stale chunk hashes after a redeploy.
// When index-*.js references a Landing-*.js (or any lazy chunk) that no longer
// exists, the dynamic import throws. Force a one-time hard reload to pick up
// the new manifest.
const CHUNK_RELOAD_KEY = "uhs_chunk_reload_attempt";
const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(
    msg,
  );
let lastReloadAttempt = 0;
const tryReload = () => {
  const now = Date.now();
  if (now - lastReloadAttempt < 10_000) return;
  lastReloadAttempt = now;
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
    if (now - last < 10_000) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // sessionStorage unavailable — still attempt reload once
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(now));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};
window.addEventListener("error", (e) => {
  if (e?.message && isChunkLoadError(e.message)) tryReload();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e?.reason?.message || String(e?.reason || "");
  if (isChunkLoadError(msg)) tryReload();
});

// Run the recurrence/loop detector continuously from app boot.
startLoopDetectorAuto();

createRoot(document.getElementById("root")!).render(<App />);
