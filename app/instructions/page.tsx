import { AuthGuard } from "@/components/auth-guard";
import { InstructionPage } from "@/components/instruction-page";

export default function InstructionsPage() {
  return (
    <AuthGuard>
      <InstructionPage />
    </AuthGuard>
  );
}
