import { AuthGuard } from "@/components/auth-guard";
import { WorkflowEditor } from "@/components/workflow-editor";

export default function WorkflowEditorPage({ params }: { params: { id: string } }) {
  return (
    <AuthGuard>
      <WorkflowEditor workflowId={params.id} />
    </AuthGuard>
  );
}
