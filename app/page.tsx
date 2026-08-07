import { AuthGuard } from "@/components/auth-guard";
import { WorkflowManager } from "@/components/workflow-manager";

export default function Home() {
  return (
    <AuthGuard>
      <WorkflowManager />
    </AuthGuard>
  );
}
