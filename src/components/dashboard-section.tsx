import type { ReactNode } from "react";

type DashboardSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function DashboardSection({
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-md border border-[#d8d1c4] bg-[#fffdf8] p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#6f6658]">{description}</p>
      </div>
      {children}
    </section>
  );
}
