export const queryKeys = {
  settings: ["settings"] as const,
  workingHours: ["workingHours"] as const,
  appointments: {
    all: ["appointments"] as const,
    range: (from: string, to: string) => ["appointments", from, to] as const,
  },
  timeOff: {
    all: ["timeOff"] as const,
    range: (from: string, to: string) => ["timeOff", from, to] as const,
  },
  slots: {
    all: ["slots"] as const,
    one: (serviceId: string, day: string) => ["slots", serviceId, day] as const,
  },
  clients: {
    all: ["clients"] as const,
    lists: ["clients", "list"] as const,
    list: (term: string) => ["clients", "list", term] as const,
    one: (id: string) => ["clients", "one", id] as const,
    stats: (id: string) => ["clients", "stats", id] as const,
    history: (id: string) => ["clients", "history", id] as const,
  },
};
