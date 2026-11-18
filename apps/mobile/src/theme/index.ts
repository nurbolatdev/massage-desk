import type { TextStyle, ViewStyle } from "react-native";

// Design tokens. The user is an elderly master: large text, large touch targets, high contrast.
export const colors = {
  background: "#F6F5F2",
  surface: "#FFFFFF",
  text: "#1B1B1B",
  textMuted: "#5C5C5C",
  primary: "#1F6F5C",
  onPrimary: "#FFFFFF",
  onPrimaryMuted: "#CDEDE3",
  confirmed: "#2E7D32",
  attention: "#E07A00",
  cancelled: "#9E9E9E",
  border: "#DDDAD3",
  // Design-language keys (DESIGN.md).
  bg: "#FAF6EF",
  ink: "#14332E",
  muted: "#4F615B",
  borderStrong: "#8A8478",
  primaryMid: "#1E8A72",
  brandMid: "#34A88C",
  stoneLight: "#7FD6BE",
  accent: "#F0603C",
  dangerSoft: "#F6D9D4",
  dangerStrong: "#8A1F12",
  segmentBg: "#EFE7DA",
  textStrong: "#34433F",
  neutralStrong: "#4A4840",
  scrim: "rgba(20,51,46,0.5)",
  primaryStrong: "#155445",
  primarySoft: "#DDF0E9",
  line: "#E6DCCB",
  borderDashed: "#B5AC9C",
  neutralSoft: "#ECE7DF",
  neutralFg: "#6B675C",
  disabledBg: "#E3DCCF",
  danger: "#B3261E",
  dangerBorder: "#E9B4A6",
  note: "#FFF6DE",
  divider: "#F0E8DB",
  accentSoft: "#FDE3D6",
  accentStrong: "#8A2E12",
  primaryFaint: "#EEF7F3",
  infoSoft: "#EEF3F7",
  infoStrong: "#1D3A52",
  warningIcon: "#C2451F",
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

// Design-language tokens (DESIGN.md). The old keys above (background, text, fontSize,
// spacing, radius, ...) belong to screens that have not yet moved to the design language;
// new screens and components use only `colors` design keys, typography, space, radii, size.
export const typography = {
  title: { fontSize: 32, fontWeight: "800", lineHeight: 37 },
  titleS: { fontSize: 24, fontWeight: "800", lineHeight: 29 },
  body: { fontSize: 18, fontWeight: "500", lineHeight: 26 },
  secondary: { fontSize: 16, fontWeight: "500", lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  display: { fontSize: 46, fontWeight: "800", lineHeight: 48 },
  subtitle: { fontSize: 21, fontWeight: "700", lineHeight: 26 },
} as const satisfies Record<string, TextStyle>;

export const space = {
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48,
  56: 56,
  64: 64,
} as const;

export const radii = {
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  18: 18,
  22: 22,
  28: 28,
  full: 999,
} as const;

export const size = {
  field: 58,
  button: 60,
  buttonSecondary: 56,
  iconButton: 48,
  progress: 6,
} as const;

// DESIGN.md section 6: level 1 = mobile card / row. No blur, so it takes no layout space.
export const depth = {
  level1: { boxShadow: `0 1px 0 ${colors.line}` },
} as const satisfies Record<string, ViewStyle>;
