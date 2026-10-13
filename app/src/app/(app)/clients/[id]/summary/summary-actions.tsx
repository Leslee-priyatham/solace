"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Share2, Sparkles } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { generateSummary, shareSummaryToPortal } from "../../actions";

export function SummaryActions({ clientId, hasSummary, sharedText, plainText }: { clientId: string; hasSummary: boolean; sharedText: string | null; plainText: string }) {
  const [pending, start] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);
  const [text, setText] = useState(sharedText ?? plainText);
  const toast = useToast();
  const generate = () =>
    start(async () => {
      const r = await generateSummary(clientId);
      if (r.error) toast(r.error, "error");
    });
  if (!hasSummary) {
    return (
      <Button onClick={generate} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate summary
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
        <Share2 className="size-4" /> {sharedText ? "Shared with client" : "Share to portal"}
      </Button>
      <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Regenerate
      </Button>
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        size="lg"
        title="Share summary in the client portal"
        description="Review and edit what your client will see. Remove anything clinical you don't want to share."
        footer={
          <>
            {sharedText && (
              <Button
                variant="outline"
                className="mr-auto"
                onClick={() =>
                  start(async () => {
                    await shareSummaryToPortal(clientId, null);
                    toast("Removed from portal");
                    setShareOpen(false);
                  })
                }
              >
                Stop sharing
              </Button>
            )}
            <Button
              disabled={!text.trim() || pending}
              onClick={() =>
                start(async () => {
                  await shareSummaryToPortal(clientId, text);
                  toast("Shared to the client portal");
                  setShareOpen(false);
                })
              }
            >
              Share
            </Button>
          </>
        }
      >
        <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </div>
  );
}
