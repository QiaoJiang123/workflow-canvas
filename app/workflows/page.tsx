import { AuthGuard } from "@/components/auth-guard";
import { WorkflowManager } from "@/components/workflow-manager";

export default function WorkflowsPage() {
  return (
    <AuthGuard>
      <WorkflowManager />
    </AuthGuard>
  );
}
