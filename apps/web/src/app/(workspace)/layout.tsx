import { redirect } from "next/navigation";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { WorkspaceShell } from "@/components/workspace/templates/workspace-shell";
import { getAuthenticatedUser } from "@/lib/server-auth";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <WorkspaceProvider userEmail={user.email ?? "Signed in"}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
