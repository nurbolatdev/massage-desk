// Design tokens. The user is an elderly master: large text, large touch targets, high contrast.
export const colors = {
  background: "#F6F5F2",
  surface: "#FFFFFF",
  text: "#1B1B1B",
  textMuted: "#5C5C5C",
  primary: "#1F6F5C",
  onPrimary: "#FFFFFF",
  confirmed: "#2E7D32",
  attention: "#E07A00",
  cancelled: "#9E9E9E",
  border: "#DDDAD3",
} as const;

export const fontSize = {
  body: 18,
  bodyLarge: 20,
  title: 24,
  hero: 34,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Minimum touch target, dp. */
export const minTouch = 56;

export const radius = 14;
