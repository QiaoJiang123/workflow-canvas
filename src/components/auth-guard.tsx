"use client";

import { getAuthSession } from "@/lib/local-auth";
import { LoadingFlow } from "./loading-flow";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (getAuthSession()) {
      setAuthorized(true);
      return;
    }
    const next = pathname && pathname !== "/" ? pathname : "/workflows";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [pathname, router]);

  if (!authorized) {
    return <LoadingFlow title="Loading Flow..." detail="Checking access and opening your saved workspace." />;
  }

  return children;
}
