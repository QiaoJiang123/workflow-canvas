"use client";

import { DEMO_PASSWORD, DEMO_USERS, type DemoUser } from "@/domain/fake-users";

const SESSION_KEY = "workflow-canvas:auth-session";

export interface AuthSession {
  user: DemoUser;
  signedInAt: string;
}

export function authenticateDemoUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = DEMO_USERS.find((item) => item.email.toLowerCase() === normalizedEmail);
  if (!user || password !== DEMO_PASSWORD) return null;
  const session: AuthSession = { user, signedInAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.user || !DEMO_USERS.some((user) => user.id === parsed.user?.id)) return null;
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
}

