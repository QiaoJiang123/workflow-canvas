"use client";

import { clearAuthSession, getAuthSession } from "@/lib/local-auth";
import { LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

export function AuthStatus({ compact = false }: { compact?: boolean }) {
  const [session, setSession] = useState<ReturnType<typeof getAuthSession>>(null);

  useEffect(() => {
    setSession(getAuthSession());
  }, []);

  if (!session) return null;

  function signOut() {
    clearAuthSession();
    window.location.assign("/login");
  }

  return (
    <div className={compact ? "auth-status compact" : "auth-status"}>
      <span className="auth-avatar" aria-hidden="true">
        <UserRound size={14} />
      </span>
      <div>
        <strong>{session.user.name}</strong>
        {!compact ? <small>{session.user.role}</small> : null}
      </div>
      <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out">
        <LogOut size={14} />
      </button>
    </div>
  );
}

