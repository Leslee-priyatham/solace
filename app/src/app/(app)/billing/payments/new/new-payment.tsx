"use client";

import { useRouter } from "next/navigation";
import { PaymentForm } from "../payment-modal";

export function NewPayment({ clients, clientId }: { clients: { id: string; name: string }[]; clientId?: string }) {
  const router = useRouter();
  return <PaymentForm clients={clients} clientId={clientId} onDone={() => router.push("/billing/payments")} />;
}
