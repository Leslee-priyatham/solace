"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Send, Printer, Loader2, FlaskConical } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Select, statusColor } from "@/components/ui";
import { Menu, useToast } from "@/components/client-ui";
import { CLAIM_STATUS, PLACE_OF_SERVICE } from "@/lib/constants";
import { date, dateTime, money } from "@/lib/format";
import { correctedClaim, deleteClaim, invoicePatientResponsibility, simulateAdjudication, submitClaim, updateClaim, voidClaim } from "../../actions";

type Line = { id: string; sessionId: string | null; serviceDate: string; cpt: string; modifiers: string; pos: string; units: number; chargeCents: number; dxPointers: string; paidCents: number };
type Claim = {
  id: string;
  number: string;
  status: string;
  clientId: string;
  client: { name: string; dob: string | null; address: string | null; gender: string | null };
  policyId: string;
  policy: { payer: string; payerCode: string; memberId: string; groupNumber: string | null; relationship: string; subscriberName: string | null };
  billingProfileId: string | null;
  billingProfile: { name: string; npi: string; taxId: string; address: string | null } | null;
  diagnosisCodes: string[];
  totalCents: number;
  paidCents: number;
  patientRespCents: number;
  payerControlNumber: string | null;
  history: { at: string; status: string; note: string }[];
  lines: Line[];
};

export function ClaimView({
  claim: c,
  policies,
  profiles,
  clientDiagnoses,
  issues,
  practiceName,
}: {
  claim: Claim;
  policies: { id: string; label: string }[];
  profiles: { id: string; label: string }[];
  clientDiagnoses: { code: string; description: string }[];
  issues: string[];
  practiceName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const editable = ["DRAFT", "READY", "REJECTED"].includes(c.status);
  const [policyId, setPolicyId] = useState(c.policyId);
  const [profileId, setProfileId] = useState(c.billingProfileId ?? "");
  const [dx, setDx] = useState(c.diagnosisCodes.join(", "));
  const [lines, setLines] = useState(c.lines.map((l) => ({ ...l, charge: (l.chargeCents / 100).toFixed(2) })));
  const [dirty, setDirty] = useState(false);

  const patchLine = (id: string, p: Partial<(typeof lines)[number]>) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
    setDirty(true);
  };
  const run = (fn: () => Promise<{ error?: string; id?: string }>, success: string, go?: (id?: string) => string) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast(r.error, "error");
      else {
        toast(success);
        if (go) router.push(go(r.id));
        else router.refresh();
      }
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="no-print flex flex-wrap gap-2">
          {editable && (
            <Button disabled={pending || issues.length > 0 || dirty} onClick={() => run(() => submitClaim(c.id), "Claim submitted")}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit claim
            </Button>
          )}
          {editable && dirty && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updateClaim(c.id, {
                      policyId,
                      billingProfileId: profileId || null,
                      diagnosisCodes: dx.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean),
                      lines: lines.map((l) => ({ id: l.id, cpt: l.cpt, modifiers: l.modifiers, pos: l.pos, units: l.units, chargeCents: Math.round(Number(l.charge) * 100), dxPointers: l.dxPointers })),
                    }).then((r) => (setDirty(false), r)),
                  "Claim saved",
                )
              }
            >
              Save changes
            </Button>
          )}
          {c.status === "PAID" && c.patientRespCents > 0 && (
            <Button variant="outline" disabled={pending} onClick={() => run(() => invoicePatientResponsibility(c.id), "Invoice created", (id) => `/billing/invoices/${id}`)}>
              Invoice patient responsibility ({money(c.patientRespCents)})
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
          <Menu
            items={[
              ["REJECTED", "DENIED", "PAID", "PARTIAL"].includes(c.status) ? { label: "Create corrected claim", onClick: () => run(() => correctedClaim(c.id), "Corrected claim created", (id) => `/insurance/claims/${id}`) } : null,
              c.status !== "VOID" && c.status !== "DRAFT" ? { label: "Void claim", danger: true, onClick: () => confirm("Void this claim?") && run(() => voidClaim(c.id), "Claim voided") } : null,
              c.status === "DRAFT" ? { label: "Delete draft", danger: true, onClick: () => confirm("Delete this draft claim?") && run(() => deleteClaim(c.id), "Draft deleted", () => "/insurance") } : null,
            ]}
          />
        </div>

        <Card className="p-6">
          <div className="grid gap-6 text-sm md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Patient</div>
              <div className="mt-1 font-medium">{c.client.name}</div>
              <div className="text-muted">DOB {c.client.dob ? date(c.client.dob) : "—"}</div>
              <div className="whitespace-pre-line text-muted">{c.client.address ?? "No address"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Payer & subscriber</div>
              {editable ? (
                <Select
                  value={policyId}
                  onChange={(e) => {
                    setPolicyId(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1"
                >
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="mt-1 font-medium">{c.policy.payer}</div>
              )}
              <div className="text-muted">Payer ID {c.policy.payerCode}</div>
              <div className="text-muted">
                Member {c.policy.memberId}
                {c.policy.groupNumber && ` · Group ${c.policy.groupNumber}`}
              </div>
              <div className="text-muted">Relationship: {c.policy.relationship.toLowerCase()}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Billing provider</div>
              {editable ? (
                <Select
                  value={profileId}
                  onChange={(e) => {
                    setProfileId(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1"
                >
                  <option value="">Choose…</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="mt-1 font-medium">{c.billingProfile?.name ?? practiceName}</div>
              )}
              {c.billingProfile && (
                <>
                  <div className="text-muted">NPI {c.billingProfile.npi}</div>
                  <div className="text-muted">Tax ID {c.billingProfile.taxId}</div>
                </>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Diagnosis codes</div>
            {editable ? (
              <Field label="" hint={`Client's diagnoses: ${clientDiagnoses.map((d) => d.code).join(", ") || "none"}. Pointer letters follow this order (A, B, C…).`}>
                <Input
                  value={dx}
                  onChange={(e) => {
                    setDx(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1 max-w-md"
                />
              </Field>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {c.diagnosisCodes.map((d, i) => (
                  <Badge key={d}>
                    {String.fromCharCode(65 + i)}. {d}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">Date</th>
                <th className="py-2">CPT</th>
                <th className="py-2">Mod</th>
                <th className="py-2">POS</th>
                <th className="py-2">Dx ptr</th>
                <th className="py-2">Units</th>
                <th className="py-2 text-right">Charge</th>
                <th className="py-2 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-line">
                  <td className="py-2">
                    {l.sessionId ? (
                      <Link href={`/sessions/${l.sessionId}`} className="hover:text-brand-700">
                        {date(l.serviceDate)}
                      </Link>
                    ) : (
                      date(l.serviceDate)
                    )}
                  </td>
                  {editable ? (
                    <>
                      <td className="py-1 pr-2">
                        <Input value={l.cpt} onChange={(e) => patchLine(l.id, { cpt: e.target.value })} className="h-8 w-24" />
                      </td>
                      <td className="py-1 pr-2">
                        <Input value={l.modifiers} onChange={(e) => patchLine(l.id, { modifiers: e.target.value })} className="h-8 w-16" />
                      </td>
                      <td className="py-1 pr-2">
                        <Select value={l.pos} onChange={(e) => patchLine(l.id, { pos: e.target.value })} className="h-8 w-20">
                          {Object.keys(PLACE_OF_SERVICE).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-1 pr-2">
                        <Input value={l.dxPointers} onChange={(e) => patchLine(l.id, { dxPointers: e.target.value.toUpperCase() })} className="h-8 w-16" />
                      </td>
                      <td className="py-1 pr-2">
                        <Input type="number" min={1} value={l.units} onChange={(e) => patchLine(l.id, { units: Number(e.target.value) })} className="h-8 w-16" />
                      </td>
                      <td className="py-1 text-right">
                        <Input type="number" step="0.01" value={l.charge} onChange={(e) => patchLine(l.id, { charge: e.target.value })} className="h-8 w-24 text-right" />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2">{l.cpt}</td>
                      <td className="py-2">{l.modifiers || "—"}</td>
                      <td className="py-2">{l.pos}</td>
                      <td className="py-2">{l.dxPointers}</td>
                      <td className="py-2">{l.units}</td>
                      <td className="py-2 text-right tabular-nums">{money(l.chargeCents)}</td>
                    </>
                  )}
                  <td className="py-2 text-right tabular-nums">{l.paidCents ? money(l.paidCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 ml-auto w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total billed</span>
              <span className="tabular-nums">{money(c.totalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid by payer</span>
              <span className="tabular-nums">{money(c.paidCents)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Patient responsibility</span>
              <span className="tabular-nums">{money(c.patientRespCents)}</span>
            </div>
          </div>
        </Card>
      </div>

      <aside className="no-print space-y-4">
        {editable && (
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Ready to submit?</h3>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" /> All checks passed.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {issues.map((i) => (
                  <li key={i} className="flex gap-2 text-amber-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {i}
                  </li>
                ))}
              </ul>
            )}
            {dirty && <p className="mt-3 text-xs text-muted">Save your changes to re-run the checks.</p>}
          </Card>
        )}
        {(c.status === "SUBMITTED" || c.status === "ACCEPTED") && (
          <Card className="p-5">
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <FlaskConical className="size-4 text-brand-600" /> Simulate payer response
            </h3>
            <p className="mb-3 text-sm text-muted">No clearinghouse is connected. Use these to move the claim through its lifecycle.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending} onClick={() => run(() => simulateAdjudication(c.id, "PAID"), "Payment posted")}>
                Paid (ERA)
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => simulateAdjudication(c.id, "DENIED"), "Claim denied")}>
                Denied
              </Button>
              {c.status === "SUBMITTED" && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => simulateAdjudication(c.id, "REJECTED"), "Claim rejected")}>
                  Rejected
                </Button>
              )}
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="History" description={c.payerControlNumber ? `Payer control # ${c.payerControlNumber}` : undefined} />
          <ol className="space-y-3 px-5 py-4">
            {[...c.history].reverse().map((h, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge color={statusColor(h.status)}>{CLAIM_STATUS[h.status as keyof typeof CLAIM_STATUS] ?? h.status}</Badge>
                  <span className="text-xs text-muted">{dateTime(h.at)}</span>
                </div>
                <p className="mt-1 text-muted">{h.note}</p>
              </li>
            ))}
          </ol>
        </Card>
      </aside>
    </div>
  );
}
