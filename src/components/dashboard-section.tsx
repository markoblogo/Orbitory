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
    <section className="rounded-lg border border-[#d8d1c4] bg-[#fffdf8] p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#6f6658]">{description}</p>
      </div>
      {children}
    </section>
  );
}
