"use client";

import { useActionState } from "react";
import { signInAction, type SignInResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StarMark } from "@/components/icons/star-mark";

const initialState: SignInResult = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-muted)] p-4">
      <StarMark className="pointer-events-none absolute -left-24 -top-24 h-[28rem] w-[28rem] text-[var(--color-primary)] opacity-[0.05]" />
      <StarMark className="pointer-events-none absolute -bottom-32 -right-20 h-[24rem] w-[24rem] text-[var(--color-brass)] opacity-[0.06]" />

      <div className="relative w-full max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] text-[var(--color-brass)]">
            <StarMark className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Masjid Mumineen</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Sign in with your office account</p>
        </div>

        <form action={formAction} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <Input name="email" type="email" autoComplete="username" required placeholder="treasurer@masjidulmumineen.org" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>

          {state.error && (
            <p className="rounded-[var(--radius)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-2.5 text-sm text-[var(--color-danger)]">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--color-muted-foreground)]">
          Each office (President, Treasurer, Administrator, Imam, Secretary) has one shared
          login — ask whoever set up the account for the password.
        </p>
      </div>
    </div>
  );
}
