import { WifiOff } from "lucide-react";
import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

export function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-12 rounded-12 bg-text-strong px-16 py-14 text-body text-surface"
    >
      <WifiOff size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
      <span className="flex-1">Нет связи с сервером. Данные могут быть устаревшими.</span>
      <Button variant="secondary" size="small" onClick={onRetry}>
        Повторить
      </Button>
    </div>
  );
}
