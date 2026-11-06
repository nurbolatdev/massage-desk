import {
  Activity,
  Bot,
  Calendar,
  ChartLine,
  MessageSquare,
  SlidersVertical,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { StaffRole } from "@/lib/auth/access";

export type Section = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  roles: readonly StaffRole[];
  description: string;
};

const ADMIN_AND_MASTER: readonly StaffRole[] = ["admin", "master"];
const ADMIN_ONLY: readonly StaffRole[] = ["admin"];

export const sections: readonly Section[] = [
  {
    id: "overview",
    label: "Обзор",
    path: "/",
    icon: ChartLine,
    roles: ADMIN_AND_MASTER,
    description: "Записи, доход, доля бота и загруженность по часам.",
  },
  {
    id: "schedule",
    label: "Расписание",
    path: "/schedule",
    icon: Calendar,
    roles: ADMIN_AND_MASTER,
    description: "Календарь записей с переносом, часы работы и выходные.",
  },
  {
    id: "clients",
    label: "Клиенты",
    path: "/clients",
    icon: Users,
    roles: ADMIN_AND_MASTER,
    description: "Карточки клиентов, визиты, переписка и заметки.",
  },
  {
    id: "conversations",
    label: "Диалоги",
    path: "/conversations",
    icon: MessageSquare,
    roles: ADMIN_AND_MASTER,
    description: "Все переписки бота с фильтрами «Нужна помощь» и «Ошибка».",
  },
  {
    id: "ai",
    label: "AI-диагностика",
    path: "/ai",
    icon: Bot,
    roles: ADMIN_ONLY,
    description: "Каждый ответ бота: что понял, что сделал, сколько стоил и сколько занял.",
  },
  {
    id: "settings",
    label: "Настройки",
    path: "/settings",
    icon: SlidersVertical,
    roles: ADMIN_AND_MASTER,
    description: "Услуги и цены, адрес, часовой пояс, бот и пользователи.",
  },
  {
    id: "system",
    label: "Система",
    path: "/system",
    icon: Activity,
    roles: ADMIN_ONLY,
    description: "Состояние вебхука WhatsApp, очередь напоминаний и журнал действий.",
  },
];

export function canOpen(role: StaffRole, section: Section): boolean {
  return section.roles.includes(role);
}

export function visibleSections(role: StaffRole): Section[] {
  return sections.filter((section) => canOpen(role, section));
}

export function isActive(pathname: string, section: Section): boolean {
  if (section.path === "/") {
    return pathname === "/";
  }
  return pathname === section.path || pathname.startsWith(`${section.path}/`);
}
