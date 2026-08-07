"use client";

import { DEMO_PASSWORD, DEMO_USERS } from "@/domain/fake-users";
import { authenticateDemoUser } from "@/lib/local-auth";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

export function LoginPage({ next = "/workflows" }: { next?: string }) {
  const safeNext = useMemo(() => (next.startsWith("/") && !next.startsWith("//") ? next : "/workflows"), [next]);
  const [email, setEmail] = useState(DEMO_USERS[0]?.email ?? "");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const session = authenticateDemoUser(email, password);
    if (!session) {
      setError("Use one of the demo users and password 123456.");
      return;
    }
    window.location.assign(safeNext);
  }

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-label="Flow Canvas sign in">
        <div className="auth-hero">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>Flow Canvas</strong>
            <span>Demo authentication for AI workflows and approval chains</span>
          </div>
        </div>

        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-header">
            <span aria-hidden="true">
              <LockKeyhole size={18} />
            </span>
            <div>
              <h1>Sign in</h1>
              <p>All demo users use password <strong>{DEMO_PASSWORD}</strong>.</p>
            </div>
          </div>

          <label className="manager-field">
            <span>User</span>
            <select value={email} onChange={(event) => setEmail(event.target.value)}>
              {DEMO_USERS.map((user) => (
                <option key={user.id} value={user.email}>
                  {user.name} - {user.role}
                </option>
              ))}
            </select>
          </label>

          <label className="manager-field">
            <span>Password</span>
            <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="create-workflow-button" type="button" onClick={() => submit()}>
            <LockKeyhole size={16} />
            Sign in
          </button>
        </form>

        <aside className="auth-users" aria-label="Demo users">
          {DEMO_USERS.map((user) => (
            <button className={user.email === email ? "auth-user selected" : "auth-user"} key={user.id} type="button" onClick={() => setEmail(user.email)}>
              <span className="auth-avatar" aria-hidden="true">
                <UserRound size={15} />
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
                <em>{user.team} / {user.role}</em>
              </span>
            </button>
          ))}
        </aside>
      </section>
    </main>
  );
}
