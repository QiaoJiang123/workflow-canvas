import { AgentsPage } from "@/components/agents-page";
import { AuthGuard } from "@/components/auth-guard";

export default function AgentsRoute() {
  return (
    <AuthGuard>
      <AgentsPage />
    </AuthGuard>
  );
}
