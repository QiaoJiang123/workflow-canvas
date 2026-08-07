import { z } from "zod";

export const mcpToolDescriptorSchema = z.object({
  serverId: z.string().min(1),
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  writeRisk: z.enum(["read", "write", "destructive"]).default("read")
});

export const mcpToolResultSchema = z.object({
  serverId: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(["completed", "failed", "blocked"]),
  output: z.unknown().optional(),
  error: z.string().optional()
});

export type McpToolDescriptor = z.infer<typeof mcpToolDescriptorSchema>;
export type McpToolResult = z.infer<typeof mcpToolResultSchema>;
