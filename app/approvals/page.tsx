import { ApprovalWorkQueuePage } from "@/components/approval-work-queue-page";
import { AuthGuard } from "@/components/auth-guard";

export default function ApprovalsPage() {
  return (
    <AuthGuard>
      <ApprovalWorkQueuePage />
    </AuthGuard>
  );
}
