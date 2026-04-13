import { isCurrentUserAdmin } from "@/lib/admin-only";
import SettingsSidebar from "./settings-sidebar";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isCurrentUserAdmin();
  return <SettingsSidebar isAdmin={isAdmin}>{children}</SettingsSidebar>;
}
