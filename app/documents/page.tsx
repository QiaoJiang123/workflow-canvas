import { AuthGuard } from "@/components/auth-guard";
import { DocumentManagementPage } from "@/components/document-management-page";

export default function DocumentsPage() {
  return (
    <AuthGuard>
      <DocumentManagementPage />
    </AuthGuard>
  );
}
