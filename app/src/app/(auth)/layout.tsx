import { APP_NAME } from "@/lib/constants";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[42%] flex-col justify-between bg-sidebar p-10 text-white lg:flex">
        <Logo light />
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Less paperwork. More presence.</h2>
          <p className="mt-3 max-w-md text-white/70">
            {APP_NAME} turns your sessions into clinical notes, keeps your caseload, calendar and billing in one place, and works with the AI
            provider you choose.
          </p>
        </div>
        <p className="text-sm text-white/50">Runs locally. Your data stays in your own database.</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
