export const queryKeys = {
  settings: ["settings"] as const,
  clients: {
    all: ["clients"] as const,
    one: (id: string) => ["clients", id] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    range: (from: string, to: string) => ["appointments", from, to] as const,
  },
};
