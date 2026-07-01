import { redirect } from "next/navigation";
import { StoreProvider } from "@/lib/store/provider";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/db/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Middleware already redirects unauthenticated requests, but a signed-in
  // Supabase user with no matching Prisma User/UserRole row (not yet
  // provisioned as an office account) would otherwise see an empty shell —
  // send them back to login rather than a broken dashboard.
  if (!user) redirect("/login");

  return (
    <StoreProvider
      initialRole={user.dashboardRole}
      currentUser={{ fullName: user.fullName, email: user.email, officeLabel: user.officeLabel }}
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-5 lg:p-7">{children}</main>
        </div>
      </div>
    </StoreProvider>
  );
}
