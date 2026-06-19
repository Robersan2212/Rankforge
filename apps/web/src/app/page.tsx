import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { getAuthenticatedUser } from "@/lib/server-auth";

export default async function HomePage() {
  if (isDevAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-8 px-4 text-center">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-primary">RANKFORGE</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Project workspaces for SEO teams
        </h1>
        <p className="mt-3 text-muted-foreground">
          Sign in to create isolated projects for audits, briefs, drafts, and
          keywords.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login">
          <Button>Sign in</Button>
        </Link>
        <Link href="/register">
          <Button variant="outline">Register</Button>
        </Link>
      </div>
    </main>
  );
}
