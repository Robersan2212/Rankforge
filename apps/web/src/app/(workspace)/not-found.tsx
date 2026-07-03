import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        This project resource does not exist or you do not have access to it.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-primary hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
