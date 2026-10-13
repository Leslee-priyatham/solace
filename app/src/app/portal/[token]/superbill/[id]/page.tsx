import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SuperbillDocument } from "@/components/superbill-document";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Superbill", robots: { index: false } };

export default async function PortalSuperbill({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const sb = await db.superbill.findFirst({ where: { id, client: { portalToken: token }, sentAt: { not: null } } });
  if (!sb) notFound();
  return (
    <div className="min-h-screen bg-canvas py-8">
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between px-4">
        <Link href={`/portal/${token}`} className="text-sm font-medium text-brand-700">
          ← Back to portal
        </Link>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-line">
        <SuperbillDocument superbillId={sb.id} />
      </div>
    </div>
  );
}
