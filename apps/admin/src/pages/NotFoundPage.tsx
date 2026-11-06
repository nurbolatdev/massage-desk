import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { PageMain } from "@/components/PageMain";
import { StateCard } from "@/components/StateCard";
import { buttonVariants } from "@/components/ui/button-variants";

export function NotFoundPage() {
  return (
    <PageMain>
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
    </PageMain>
  );
}
