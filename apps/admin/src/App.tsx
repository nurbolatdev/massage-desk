import { BrandLogo } from "@/components/BrandLogo";

export function App() {
  return (
    <main className="flex min-h-screen flex-col justify-between gap-40 bg-stone-dark p-48">
      <BrandLogo mark={44} text="title-s" />
      <h1 className="text-hero text-surface">Админка</h1>
    </main>
  );
}
