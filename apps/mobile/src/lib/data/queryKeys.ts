export const queryKeys = {
  settings: ["settings"] as const,
  appointments: {
    all: ["appointments"] as const,
    range: (from: string, to: string) => ["appointments", from, to] as const,
  },
};
