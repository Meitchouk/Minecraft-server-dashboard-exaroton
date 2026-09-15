import { Cpu } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)]"><Cpu className="size-5" /></span>
          <span>
            <span className="block text-base font-semibold leading-tight tracking-tight">Exaroton Panel</span>
            <span className="block text-[11px] text-muted-foreground leading-tight">control de servidor</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
