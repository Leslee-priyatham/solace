import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const u = await requireUser();
  return (
    <>
      <PageHeader title="My profile" />
      <ProfileForm user={{ firstName: u.firstName, middleName: u.middleName ?? "", lastName: u.lastName, suffix: u.suffix ?? "", email: u.email, phone: u.phone ?? "", timezone: u.timezone, role: u.role }} />
    </>
  );
}
