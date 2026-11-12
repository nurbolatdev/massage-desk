export const queryKeys = {
  settings: ["settings"] as const,
  clients: {
    all: ["clients"] as const,
    one: (id: string) => ["clients", id] as const,
    search: (q: string) => ["clients", "search", q] as const,
  },
  services: ["services"] as const,
  workingHours: ["workingHours"] as const,
  slots: {
    all: ["slots"] as const,
    one: (serviceId: string, day: string) => ["slots", serviceId, day] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    range: (from: string, to: string) => ["appointments", from, to] as const,
  },
  timeOff: {
    all: ["timeOff"] as const,
    range: (from: string, to: string) => ["timeOff", from, to] as const,
  },
};
