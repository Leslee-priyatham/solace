import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GuestRoom } from "./guest-room";

export const metadata = { title: "Join your session", robots: { index: false } };

export default async function JoinPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const { slug } = await params;
  const { c } = await searchParams;
  const provider = await db.user.findUnique({ where: { telehealthSlug: slug } });
  if (!provider) notFound();
  const [practice, client] = await Promise.all([db.practice.findFirst(), c ? db.client.findUnique({ where: { portalToken: c } }) : null]);
  return (
    <GuestRoom
      room={slug}
      providerName={`${provider.firstName} ${provider.lastName}`}
      practiceName={practice?.displayName || practice?.name || ""}
      brandColor={practice?.brandColor ?? "#0a8c76"}
      clientName={client ? client.preferredName || client.firstName : ""}
      portalHref={c ? `/portal/${c}` : null}
    />
  );
}
