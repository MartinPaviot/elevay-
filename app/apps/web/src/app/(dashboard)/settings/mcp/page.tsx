import { adminOnlyOrRedirect } from "@/lib/admin-only";
import McpClient from "./mcp-client";

export default async function McpPage() {
  await adminOnlyOrRedirect();
  return <McpClient />;
}
