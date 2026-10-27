import type { Appointment } from "@/types";

// Temporary data until the app is connected to the database.
function today(hours: number, minutes = 0): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export const mockToday: Appointment[] = [
  { id: "1", clientName: "Айдар", clientPhone: "+998901112233", serviceName: "Массаж спины", start: today(10), end: today(11), status: "confirmed", source: "bot" },
  { id: "2", clientName: "Гульнара", clientPhone: "+998902223344", serviceName: "Общий массаж", start: today(12), end: today(13, 30), status: "confirmed", source: "manual" },
  { id: "3", clientName: "Тимур", clientPhone: "+998903334455", serviceName: "Шейно-воротниковая зона", start: today(15), end: today(15, 30), status: "confirmed", source: "bot" },
  { id: "4", clientName: "Дильноза", clientPhone: "+998904445566", serviceName: "Массаж спины", start: today(17), end: today(18), status: "cancelled", source: "bot" },
];
