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
};
