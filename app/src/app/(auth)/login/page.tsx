import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await db.practice.findFirst())) redirect("/signup");
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to your practice workspace.</p>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">
        New team member? Use the invite link your admin sent you.{" "}
        <Link href="/signup" className="text-brand-700 hover:underline">
          Set up a practice
        </Link>
      </p>
    </>
  );
}
