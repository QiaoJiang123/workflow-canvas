"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function DynamicIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Circle;
  return <Icon size={size} strokeWidth={1.8} />;
}
