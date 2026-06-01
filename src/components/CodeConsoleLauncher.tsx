import { Link, useLocation } from "react-router-dom";
import { Terminal } from "lucide-react";
import { useUltimateAccess } from "@/hooks/useUltimateAccess";

export default function CodeConsoleLauncher() {
  const { allowed } = useUltimateAccess();
  const location = useLocation();

  if (!allowed) return null;
  if (location.pathname === "/code-console") return null;

  return (
    <Link
      to="/code-console"
      aria-label="Abrir Code Console"
      className="fixed bottom-6 left-6 z-[60] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:opacity-90 transition"
    >
      <Terminal className="h-5 w-5" aria-hidden="true" />
      <span className="text-sm font-medium hidden sm:inline">Code Console</span>
    </Link>
  );
}
