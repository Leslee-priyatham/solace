import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "solace_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  return new TextEncoder().encode(process.env.APP_SECRET);
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function startSession(userId: string) {
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  // Secure cookies only over HTTPS: on http://localhost some browsers (Safari) drop them and login fails.
  const h = await headers();
  const https = h.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || (h.get("origin") ?? "").startsWith("https://");
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: MAX_AGE,
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function sessionUserId(): Promise<string | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const id = await sessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  return user && user.status === "ACTIVE" ? user : null;
}

/** For server components and actions: the signed-in user, or redirect to login. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/home");
  return user;
}

export async function practice() {
  const p = await db.practice.findFirst();
  if (!p) redirect("/signup");
  return p;
}

export async function audit(userId: string | null, action: string, entity: string, entityId?: string, detail?: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, detail } });
}
