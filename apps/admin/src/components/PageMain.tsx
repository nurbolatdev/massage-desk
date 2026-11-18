import type { ReactNode } from "react";

export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-col gap-20 px-14 py-20 md:px-32 md:pt-28 md:pb-40">{children}</main>
  );
}
