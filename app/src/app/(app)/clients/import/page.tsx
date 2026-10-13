import { redirect } from "next/navigation";

export default function ClientImportRedirect() {
  redirect("/settings/imports");
}
