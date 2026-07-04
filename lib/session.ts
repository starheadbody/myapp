import { supabaseServer } from './supabase/server';
import type { UserProfile } from './types';

// Central gate. Three states drive routing everywhere:
//  - no auth user            -> not signed in (auth UI is future scope)
//  - auth user, no profile   -> "Learn" track: view-only, unmatchable, no messaging
//  - auth user + profile row -> activated (profile row can only exist with proof_of_work_url)
export async function getSessionState() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { authUser: null, profile: null as UserProfile | null };

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { authUser: user, profile: (profile as UserProfile) ?? null };
}
