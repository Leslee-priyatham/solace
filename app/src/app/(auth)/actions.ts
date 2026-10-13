"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { endSession, hashPassword, startSession, verifyPassword, audit } from "@/lib/auth";
import { seedDemoClient, seedLibrary, slugify } from "@/lib/bootstrap";
import { token } from "@/lib/crypto";

export type AuthState = { error?: string } | undefined;

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match an account." };
  }
  if (user.status !== "ACTIVE") return { error: "This account is not active. Ask your practice admin." };
  await startSession(user.id);
  await audit(user.id, "login", "User", user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/home");
}

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  practiceName: z.string().trim().min(1, "Practice name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  country: z.string().default("US"),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  if (await db.practice.findFirst()) {
    return { error: "This workspace is already set up. Ask an admin to invite you." };
  }
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const tz = String(form.get("timezone") || "America/New_York");
  await db.practice.create({
    data: {
      name: d.practiceName,
      displayName: d.practiceName,
      email: d.email,
      country: d.country,
      timezone: tz,
      slug: slugify(d.practiceName),
      settings: {
        reminders: { channels: ["EMAIL"], first: 24, second: 1, enabled: false },
        portal: { selfScheduling: false, messaging: true },
        billing: { invoiceDueDays: 14, lateCancelFeeCents: 0 },
        compliance: { autoRun: false },
      },
    },
  });
  const user = await db.user.create({
    data: {
      email: d.email,
      passwordHash: await hashPassword(d.password),
      firstName: d.firstName,
      lastName: d.lastName,
      role: "ADMIN",
      timezone: tz,
      telehealthSlug: `${slugify(d.firstName + "-" + d.lastName)}-${token(3).toLowerCase()}`,
      preferences: { providerTerm: "Therapist", clientTerm: "Client", pronouns: "" },
    },
  });
  for (let day = 1; day <= 5; day++) {
    await db.availabilityRule.create({ data: { userId: user.id, weekday: day, startMin: 9 * 60, endMin: 17 * 60 } });
  }
  await seedLibrary();
  await seedDemoClient(user.id);
  await startSession(user.id);
  await audit(user.id, "signup", "Practice");
  redirect("/home");
}

export async function acceptInvite(_: AuthState, form: FormData): Promise<AuthState> {
  const inviteToken = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const user = await db.user.findUnique({ where: { inviteToken } });
  if (!user) return { error: "This invite link is no longer valid." };
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), status: "ACTIVE", inviteToken: null },
  });
  await startSession(user.id);
  redirect("/home");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
