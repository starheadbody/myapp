import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Per-request client bound to the caller's session. All reads/writes go
// through RLS — this client can never enumerate other users.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          list: { name: string; value: string; options?: object }[],
        ) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions
          }
        },
      },
    },
  );
}
