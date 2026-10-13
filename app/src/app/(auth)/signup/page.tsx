import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Set up your practice" };

export default async function SignupPage() {
  if (await db.practice.findFirst()) redirect("/login");
  return (
    <>
      <h1 className="text-2xl font-semibold">Set up your practice</h1>
      <p className="mt-1 text-sm text-muted">You'll be the admin. You can invite your team afterwards.</p>
      <SignupForm />
    </>
  );
}
