"use client";

import { Lock, Mail, UserPlus } from "lucide-react";
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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleSignUp() {
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
        <AuthCardIcon icon={UserPlus} />
        <AuthCardHeader
          title="Create account with email"
          description="Start building isolated SEO project workspaces for your team."
        />

        <form onSubmit={handleRegister} className="mt-8 space-y-4">
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
            minLength={6}
            showPasswordToggle
          />
          <AuthField
            id="confirm"
            type="password"
            icon={Lock}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            minLength={6}
            showPasswordToggle
          />
          {error && <AuthError message={error} />}
          <AuthPrimaryButton loading={loading} loadingLabel="Creating account…">
            Get Started
          </AuthPrimaryButton>
        </form>

        <AuthDivider label="Or sign up with" />
        <GoogleAuthButton onClick={handleGoogleSignUp} label="Sign up with Google" />

        <AuthFooterLink
          prompt="Already have an account?"
          linkHref="/login"
          linkLabel="Sign in"
        />
      </AuthCard>
    </AuthPageShell>
  );
}
