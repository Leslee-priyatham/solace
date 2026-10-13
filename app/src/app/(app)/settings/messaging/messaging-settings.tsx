"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { SaveButton } from "../save-bar";
import { saveMessagingName } from "../actions";
import { setBlocked } from "../../inbox/actions";

export function MessagingSettings({ displayName, blocked }: { displayName: string; blocked: { id: string; name: string }[] }) {
  const [name, setName] = useState(displayName);
  const [pending, start] = useTransition();
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Your display name" description="What clients see next to your messages." />
        <div className="flex items-end gap-3 p-5">
          <Field label="Display name" className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <SaveButton action={() => saveMessagingName(name)} />
        </div>
      </Card>
      <Card>
        <CardHeader title={`Blocked clients (${blocked.length})`} description="Blocked clients can't send messages. Announcements still reach everyone else." />
        <ul className="divide-y divide-line">
          {blocked.length === 0 && <li className="px-5 py-4 text-sm text-muted">No one is blocked.</li>}
          {blocked.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
              {b.name}
              <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => void (await setBlocked(b.id, false)))}>
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
