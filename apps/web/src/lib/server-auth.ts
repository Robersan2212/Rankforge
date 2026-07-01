import { createClient } from "@/lib/supabase/server";
import {
  getDevAuthToken,
  getDevAuthUser,
  isDevAuthBypassEnabled,
} from "@/lib/dev-auth";

export async function getAuthenticatedUser() {
  if (isDevAuthBypassEnabled()) {
    return getDevAuthUser();
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getApiAuthorizationHeader(): Promise<string | null> {
  if (isDevAuthBypassEnabled()) {
    return `Bearer ${getDevAuthToken()}`;
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}
