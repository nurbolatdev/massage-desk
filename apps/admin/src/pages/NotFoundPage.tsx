import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { StateCard } from "@/components/StateCard";
import { buttonVariants } from "@/components/ui/button-variants";

export function NotFoundPage() {
  return (
    <main className="flex flex-col px-32 pt-28 pb-40">
      <StateCard
        icon={Search}
        title="Страница не найдена"
        text="Такой страницы нет. Выберите раздел в меню."
        action={
          <Link to="/" className={buttonVariants({ variant: "secondary" })}>
            На главную
          </Link>
        }
      />
    </main>
  );
}
