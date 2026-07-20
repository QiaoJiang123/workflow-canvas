import { WorkflowEditor } from "@/components/workflow-editor";

export default function WorkflowEditorPage({ params }: { params: { id: string } }) {
  return <WorkflowEditor workflowId={params.id} />;
}
