"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { token } from "@/lib/crypto";
import { nextMrn } from "@/lib/bootstrap";
import { parseCsv } from "@/lib/csv";
import { ICD10 } from "@/lib/library";

type Summary = { created: number; skipped: number; errors: string[] };

// Header aliases from common EHR exports → our fields.
const FIELDS: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first", "given name", "client first name"],
  lastName: ["last name", "lastname", "last", "surname", "family name", "client last name"],
  preferredName: ["preferred name", "nickname"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "mobile", "phone number", "cell", "mobile phone"],
  dob: ["dob", "date of birth", "birthdate", "birth date"],
  pronouns: ["pronouns"],
  gender: ["gender", "sex"],
  address: ["address", "street address", "home address"],
  status: ["status", "client status"],
  diagnosis: ["diagnosis", "diagnoses", "dx", "icd10", "icd-10"],
  notes: ["notes", "comments"],
};

function mapHeaders(headers: string[]) {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/[_]+/g, " ");
    for (const [field, aliases] of Object.entries(FIELDS)) if (aliases.includes(key) && map[field] === undefined) map[field] = i;
  });
  return map;
}

export async function previewCsv(form: FormData) {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Choose a CSV file." };
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The file has no data rows." };
  const map = mapHeaders(rows[0]);
  if (map.firstName === undefined || map.lastName === undefined) return { error: "We couldn't find first-name and last-name columns. Check the header row." };
  return { headers: rows[0], mapped: Object.fromEntries(Object.entries(map).map(([k, v]) => [k, rows[0][v]])), sample: rows.slice(1, 6), total: rows.length - 1 };
}

export async function importClientsCsv(form: FormData): Promise<{ error?: string; summary?: Summary }> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Choose a CSV file." };
  const rows = parseCsv(await file.text());
  const map = mapHeaders(rows[0] ?? []);
  if (map.firstName === undefined || map.lastName === undefined) return { error: "Missing first-name / last-name columns." };
  const get = (r: string[], f: string) => (map[f] !== undefined ? (r[map[f]] ?? "").trim() : "");
  const summary: Summary = { created: 0, skipped: 0, errors: [] };
  for (const [i, r] of rows.slice(1).entries()) {
    const firstName = get(r, "firstName");
    const lastName = get(r, "lastName");
    if (!firstName || !lastName) {
      summary.errors.push(`Row ${i + 2}: missing name`);
      continue;
    }
    const email = get(r, "email").toLowerCase() || null;
    if (email && (await db.client.findFirst({ where: { email } }))) {
      summary.skipped++;
      continue;
    }
    const dobRaw = get(r, "dob");
    const dob = dobRaw ? new Date(dobRaw) : null;
    const statusRaw = get(r, "status").toUpperCase();
    const dxCodes = get(r, "diagnosis").split(/[;|,]/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z]\d/.test(x));
    try {
      await db.client.create({
        data: {
          mrn: await nextMrn(),
          firstName,
          lastName,
          preferredName: get(r, "preferredName") || null,
          email,
          phone: get(r, "phone") || null,
          dob: dob && !isNaN(dob.getTime()) ? dob : null,
          pronouns: get(r, "pronouns") || null,
          gender: get(r, "gender") || null,
          address: get(r, "address") || null,
          notes: get(r, "notes") || null,
          status: ["ACTIVE", "PROSPECT", "INACTIVE", "DISCHARGED"].includes(statusRaw) ? statusRaw : "ACTIVE",
          portalToken: token(),
          providerId: user.id,
          diagnoses: { create: dxCodes.map((code, k) => ({ code, description: ICD10.find(([c]) => c === code)?.[1] ?? code, sortOrder: k })) },
        },
      });
      summary.created++;
    } catch (e) {
      summary.errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message.slice(0, 120) : "failed"}`);
    }
  }
  await db.importJob.create({ data: { kind: "CSV_CLIENTS", fileName: file.name, summary } });
  await audit(user.id, "import", "Client", undefined, `${summary.created} created`);
  revalidatePath("/settings/imports");
  revalidatePath("/clients");
  return { summary };
}
