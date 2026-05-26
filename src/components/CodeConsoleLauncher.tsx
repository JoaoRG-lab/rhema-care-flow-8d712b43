import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_EMAIL = "joaooz123@gmail.com";

export default function CodeConsoleLauncher() {
  const [allowed, setAllowed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setAllowed(data.user?.email?.toLowerCase() === ALLOWED_EMAIL);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAllowed(session?.user?.email?.toLowerCase() === ALLOWED_EMAIL);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
