import { SettingsNav } from "./settings-nav";
import { requireUser } from "@/lib/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <SettingsNav isAdmin={user.role === "ADMIN"} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
