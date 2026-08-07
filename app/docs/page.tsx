import { AuthGuard } from "@/components/auth-guard";
import { TechnicalDocsPage } from "@/components/technical-docs-page";

export default function DocsPage() {
  return (
    <AuthGuard>
      <TechnicalDocsPage />
    </AuthGuard>
  );
}

