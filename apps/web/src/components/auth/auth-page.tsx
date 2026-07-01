"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {children}
    </main>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[420px] rounded-[2rem] border border-border/80 bg-card px-8 py-10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)]">
      {children}
    </div>
  );
}

export function AuthCardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-background shadow-sm">
      <Icon className="size-5 text-foreground" strokeWidth={2} />
    </div>
  );
}

export function AuthCardHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

interface AuthFieldProps {
  id: string;
  type?: string;
  icon: LucideIcon;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  showPasswordToggle?: boolean;
}

export function AuthField({
  id,
  type = "text",
  icon: Icon,
  placeholder,
  value,
  onChange,
  required,
  minLength,
  showPasswordToggle = false,
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPasswordToggle && visible ? "text" : type;

  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className={cn(
          "h-12 w-full rounded-2xl border border-border/80 bg-muted/40 px-11 text-sm text-foreground outline-none transition-colors",
          "placeholder:text-muted-foreground focus:border-foreground/20 focus:bg-background focus:ring-2 focus:ring-foreground/5",
          showPasswordToggle && "pr-11"
        )}
      />
      {showPasswordToggle && isPassword && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-6 text-center">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-dashed border-border" />
      </div>
      <span className="relative bg-card px-3 text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  loadingLabel,
}: {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function GoogleAuthButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex size-12 items-center justify-center rounded-2xl border border-border/80 bg-background shadow-sm transition-colors hover:bg-muted/50"
      >
        <GoogleIcon />
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthFooterLink({
  prompt,
  linkHref,
  linkLabel,
}: {
  prompt: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <p className="mt-6 text-center text-sm text-muted-foreground">
      {prompt}{" "}
      <Link
        href={linkHref}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {linkLabel}
      </Link>
    </p>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
