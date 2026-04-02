import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { chatThreads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { PersistentChatBar } from "@/components/persistent-chat-bar";
import { PostHogPageTracker } from "@/components/posthog-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const initials = (session.user.name?.charAt(0) || "?").toUpperCase();

  let recentChats: Array<{ id: string; title: string | null }> = [];
  try {
    // Resolve app user ID from auth user ID for thread lookup
    const { users } = await import("@/db/schema");
    const [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, session.user.id!))
      .limit(1);

    if (appUser) {
      recentChats = await db
        .select({ id: chatThreads.id, title: chatThreads.title })
        .from(chatThreads)
        .where(eq(chatThreads.userId, appUser.id))
        .orderBy(desc(chatThreads.updatedAt))
        .limit(5);
    }
  } catch {
    // DB not available
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userName={session.user.name || "User"}
        userInitials={initials}
        recentChats={recentChats}
        onSignOut={handleSignOut}
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">{children}</div>
        <PersistentChatBar />
        <PostHogPageTracker userId={session.user.id} />
      </main>
    </div>
  );
}
