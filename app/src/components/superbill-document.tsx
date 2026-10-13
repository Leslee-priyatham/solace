import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { PLACE_OF_SERVICE } from "@/lib/constants";

/** Printable superbill (server component) — used by staff and the client portal. */
export async function SuperbillDocument({ superbillId }: { superbillId: string }) {
  const sb = await db.superbill.findUniqueOrThrow({ where: { id: superbillId }, include: { client: { include: { diagnoses: { orderBy: { sortOrder: "asc" } } } } } });
  const [practice, sessions] = await Promise.all([
    db.practice.findFirst(),
    db.session.findMany({ where: { id: { in: sb.sessionIds as string[] } }, include: { provider: true, appointment: true }, orderBy: { startedAt: "asc" } }),
  ]);
  const provider = sessions[0]?.provider;
  const currency = practice?.currency ?? "USD";
  const c = sb.client;
  return (
    <div className="bg-white p-10 text-sm">
      <div className="flex justify-between gap-8">
        <div>
          <div className="text-xl font-semibold">{practice?.displayName || practice?.name}</div>
          <div className="mt-1 whitespace-pre-line text-muted">{[practice?.address, practice?.phone, practice?.email].filter(Boolean).join("\n")}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tracking-tight">SUPERBILL</div>
          <div className="text-muted">{sb.number}</div>
          <div className="text-muted">
            {date(sb.periodStart)} – {date(sb.periodEnd)}
          </div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Client</div>
          <div className="mt-1 font-medium">
            {c.firstName} {c.lastName}
          </div>
          {c.dob && <div>DOB {date(c.dob)}</div>}
          <div className="whitespace-pre-line text-muted">{c.address}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Rendering provider</div>
          {provider && (
            <>
              <div className="mt-1 font-medium">
                {provider.firstName} {provider.lastName}
                {provider.license ? `, ${provider.license}` : ""}
              </div>
              {provider.npi && <div>NPI {provider.npi}</div>}
              {(provider.taxId || practice?.taxId) && <div>Tax ID {provider.taxId || practice?.taxId}</div>}
            </>
          )}
        </div>
      </div>
      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Diagnoses (ICD-10)</div>
        <div className="mt-1">
          {c.diagnoses.length
            ? c.diagnoses.map((d, i) => (
                <div key={d.id}>
                  {String.fromCharCode(65 + i)}. <strong>{d.code}</strong> {d.description}
                </div>
              ))
            : "None recorded"}
        </div>
      </div>
      <table className="mt-6 w-full">
        <thead>
          <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wide">
            <th className="py-2">Date of service</th>
            <th className="py-2">CPT</th>
            <th className="py-2">Place of service</th>
            <th className="py-2">Dx pointer</th>
            <th className="py-2 text-right">Fee</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-b border-line">
              <td className="py-2">{date(s.startedAt)}</td>
              <td className="py-2">{s.cpt ?? "—"}</td>
              <td className="py-2">{s.captureMode === "TELEHEALTH" || s.appointment?.modality === "TELEHEALTH" ? `10 · ${PLACE_OF_SERVICE["10"]}` : `11 · ${PLACE_OF_SERVICE["11"]}`}</td>
              <td className="py-2">{c.diagnoses.length ? c.diagnoses.map((_, i) => String.fromCharCode(65 + i)).join("") : "—"}</td>
              <td className="py-2 text-right tabular-nums">{money(s.feeCents ?? 0, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto flex w-64 justify-between border-t border-ink pt-1 text-base font-semibold">
        <span>Total charges</span>
        <span className="tabular-nums">{money(sb.totalCents, currency)}</span>
      </div>
      <p className="mt-10 text-xs text-muted">
        I certify that the services listed above were provided. Signature: ______________________________ Date: ______________
      </p>
    </div>
  );
}
