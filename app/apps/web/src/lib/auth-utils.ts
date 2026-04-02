import { auth } from "@/auth";

export interface AuthContext {
  userId: string;
  tenantId: string;
  appUserId: string;
}

/**
 * Get authenticated user context with tenant information.
 * Returns null if not authenticated or tenant is missing.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const tenantId = (session as any).tenantId as string | undefined;
  const appUserId = (session as any).appUserId as string | undefined;

  // Require tenant context for all data operations
  if (!tenantId) return null;

  return {
    userId: session.user.id,
    tenantId,
    appUserId: appUserId || session.user.id,
  };
}
