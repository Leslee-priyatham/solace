"use client";

import { useState, useTransition } from "react";
import { UserPlus, Copy } from "lucide-react";
import { Avatar, Badge, Button, Field, Input, Notice, Select, Table, Td, Th, statusColor } from "@/components/ui";
import { Menu, Modal, useToast } from "@/components/client-ui";
import { ago } from "@/lib/format";
import { ROLES } from "@/lib/constants";
import { inviteMember, regenerateInvite, updateMember } from "../actions";

type U = { id: string; name: string; email: string; role: string; status: string; clients: number; lastLoginAt: string | null; inviteToken: string | null; telehealthSlug: string };

export function TeamView({ users, meId }: { users: U[]; meId: string }) {
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const toast = useToast();
  const copyInvite = async (path: string) => {
    const url = `${location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setLink(url);
    toast("Invite link copied");
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setInviting(true)}>
          <UserPlus className="size-4" /> Invite member
        </Button>
      </div>
      {link && (
        <Notice tone="success" className="flex items-center justify-between gap-3">
          <span className="truncate">Send this link to your new team member: {link}</span>
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(link)}>
            <Copy className="size-4" />
          </Button>
        </Notice>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Clients</Th>
            <Th>Last login</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} size="sm" />
                  <div>
                    <div className="font-medium">
                      {u.name} {u.id === meId && <span className="text-xs text-muted">(you)</span>}
                    </div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </div>
                </div>
              </Td>
              <Td>{ROLES[u.role as keyof typeof ROLES]}</Td>
              <Td>
                <Badge color={statusColor(u.status === "INVITED" ? "PENDING" : u.status === "DISABLED" ? "VOID" : "ACTIVE")}>{u.status.toLowerCase()}</Badge>
              </Td>
              <Td>{u.clients}</Td>
              <Td className="text-muted">{u.lastLoginAt ? ago(u.lastLoginAt) : "—"}</Td>
              <Td className="text-right">
                <Menu
                  items={[
                    u.status === "INVITED" && u.inviteToken ? { label: "Copy invite link", onClick: () => copyInvite(`/invite/${u.inviteToken}`) } : null,
                    u.status === "INVITED" ? { label: "Create new invite link", onClick: async () => { const r = await regenerateInvite(u.id); if (r.link) copyInvite(r.link); } } : null,
                    ...Object.entries(ROLES)
                      .filter(([k]) => k !== u.role)
                      .map(([k, v]) => ({ label: `Make ${v.toLowerCase()}`, onClick: async () => toast((await updateMember(u.id, { role: k })).error ?? "Role updated") })),
                    u.status === "DISABLED"
                      ? { label: "Reactivate", onClick: async () => toast((await updateMember(u.id, { status: "ACTIVE" })).error ?? "Reactivated") }
                      : u.id !== meId
                        ? { label: "Deactivate", danger: true, onClick: async () => confirm(`Deactivate ${u.name}? They won't be able to log in.`) && toast((await updateMember(u.id, { status: "DISABLED" })).error ?? "Deactivated") }
                        : null,
                  ]}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {inviting && <InviteModal onClose={() => setInviting(false)} onInvited={(path) => copyInvite(path)} />}
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: (path: string) => void }) {
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", role: "CLINICIAN" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title="Invite a team member"
      description="You'll get a private link to send them. They choose their own password."
      footer={
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await inviteMember(f);
              if (r.error) setError(r.error);
              else {
                onInvited(r.link!);
                onClose();
              }
            })
          }
        >
          Create invite
        </Button>
      }
    >
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        </Field>
        <Field label="Last name">
          <Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Role" className="sm:col-span-2">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="CLINICIAN">Clinician — sees clients, writes notes</option>
            <option value="BILLER">Biller — payments and insurance</option>
            <option value="ADMIN">Admin — everything, including settings</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
