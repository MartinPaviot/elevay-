import type { Metadata } from "next";
import "./globals.css";
import { AdminNav } from "../components/admin-nav";

export const metadata: Metadata = {
  title: "LeadSens Admin",
  description: "Agent observability & flywheel dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <AdminNav />
          <main className="flex-1 overflow-auto p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
