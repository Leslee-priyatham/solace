"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardHeader, Checkbox, Notice } from "@/components/ui";
import { CopyButton } from "@/components/client-ui";
import { SaveButton } from "../save-bar";
import { savePortalSettings } from "../actions";

export function PortalSettings({ initial, bookingUrl, selfServices, previewHref }: { initial: { selfScheduling: boolean; autoConfirm: boolean; hidePrices: boolean; messaging: boolean }; bookingUrl: string; selfServices: number; previewHref: string | null }) {
  const [s, setS] = useState(initial);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader
          title="Portal features"
          actions={
            previewHref && (
              <a href={previewHref} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-medium text-brand-700">
                Preview portal <ExternalLink className="size-3.5" />
              </a>
            )
          }
        />
        <div className="space-y-3 p-5">
          <Checkbox label="Secure messaging between clients and clinicians" checked={s.messaging} onChange={(e) => setS({ ...s, messaging: e.target.checked })} />
          <Checkbox label="Let clients book sessions online (self-scheduling)" checked={s.selfScheduling} onChange={(e) => setS({ ...s, selfScheduling: e.target.checked })} />
          <div className="space-y-3 pl-6">
            <Checkbox label="Confirm online bookings automatically (otherwise they arrive as requests)" checked={s.autoConfirm} disabled={!s.selfScheduling} onChange={(e) => setS({ ...s, autoConfirm: e.target.checked })} />
            <Checkbox label="Hide prices on the booking page" checked={s.hidePrices} disabled={!s.selfScheduling} onChange={(e) => setS({ ...s, hidePrices: e.target.checked })} />
          </div>
          <SaveButton action={() => savePortalSettings(s)} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Booking page" description="Share this link on your website so new and existing clients can book." />
        <div className="space-y-3 p-5">
          <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
            <span className="flex-1 truncate">{bookingUrl}</span>
            <CopyButton text={bookingUrl} />
          </div>
          {selfServices === 0 && (
            <Notice tone="warn">
              No services allow self-scheduling yet.{" "}
              <Link href="/settings/services" className="font-medium underline">
                Choose bookable services
              </Link>
              .
            </Notice>
          )}
          <p className="text-sm text-muted">
            Bookable times come from your{" "}
            <Link href="/settings/availability" className="text-brand-700">
              availability
            </Link>
            , minus existing appointments and connected calendars, with at least 24 hours' notice.
          </p>
        </div>
      </Card>
    </div>
  );
}
