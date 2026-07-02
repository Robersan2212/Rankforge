import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getDevAuthToken,
  getDevAuthUser,
  isDevAuthBypassEnabled,
} from "@/lib/dev-auth";

export const getAuthenticatedUser = cache(async () => {
  if (isDevAuthBypassEnabled()) {
    return getDevAuthUser();
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getApiAuthorizationHeader = cache(async (): Promise<string | null> => {
  if (isDevAuthBypassEnabled()) {
    return `Bearer ${getDevAuthToken()}`;
  }

  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
});
