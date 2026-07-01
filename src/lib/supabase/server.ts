// Server-side Supabase client for Server Components / Server Actions /
// Route Handlers. Session state lives in cookies, managed by @supabase/ssr.
// Uses the publishable key (safe, RLS-scoped) — never the secret key, which
// stays confined to Prisma's direct Postgres connection.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll called from a Server Component — safe to ignore since
          // middleware refreshes the session on every request anyway.
        }
      },
    },
  });
}
