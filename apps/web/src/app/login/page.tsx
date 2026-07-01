"use client";

import { LogIn, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AuthCard,
  AuthCardHeader,
  AuthCardIcon,
  AuthDivider,
  AuthError,
  AuthField,
  AuthFooterLink,
  AuthPageShell,
  AuthPrimaryButton,
  GoogleAuthButton,
} from "@/components/auth/auth-page";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    const origin = window.location.origin;
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <AuthPageShell>
      <AuthCard>
        <AuthCardIcon icon={LogIn} />
        <AuthCardHeader
          title="Sign in with email"
          description="Access your Rankforge workspaces for audits, briefs, drafts, and keywords."
        />

        <form onSubmit={handleEmailSignIn} className="mt-8 space-y-4">
          <AuthField
            id="email"
            type="email"
            icon={Mail}
            placeholder="Email"
            value={email}
            onChange={setEmail}
            required
          />
          <AuthField
            id="password"
            type="password"
            icon={Lock}
            placeholder="Password"
            value={password}
            onChange={setPassword}
            required
            showPasswordToggle
          />
          {error && <AuthError message={error} />}
          <AuthPrimaryButton loading={loading} loadingLabel="Signing in…">
            Get Started
          </AuthPrimaryButton>
        </form>

        <AuthDivider label="Or sign in with" />
        <GoogleAuthButton onClick={handleGoogleSignIn} label="Sign in with Google" />

        <AuthFooterLink
          prompt="No account?"
          linkHref="/register"
          linkLabel="Register"
        />
      </AuthCard>
    </AuthPageShell>
  );
}
