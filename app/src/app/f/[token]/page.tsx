import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { FillForm } from "./fill-form";
import type { Answers, FormField } from "@/lib/forms";

export const metadata = { title: "Complete your form" };

export default async function PublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await db.formRequest.findUnique({ where: { token }, include: { form: true, client: true } });
  if (!r) notFound();
  const practice = await db.practice.findFirst();
  return (
    <PublicShell practice={practice} backHref={`/portal/${r.client.portalToken}`}>
      {r.status === "REVOKED" ? (
        <p className="text-center text-muted">This form is no longer active. Please contact your clinician.</p>
      ) : (
        <FillForm
          token={token}
          title={r.form.name}
          description={r.form.description}
          fields={r.form.fields as unknown as FormField[]}
          initial={r.answers as unknown as Answers}
          completed={r.status === "COMPLETED"}
          portalHref={`/portal/${r.client.portalToken}`}
        />
      )}
    </PublicShell>
  );
}
