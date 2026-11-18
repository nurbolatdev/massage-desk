function hasUnsafeChar(text: string): boolean {
  return [...text].some((ch) => ch === "\\" || ch.charCodeAt(0) <= 0x20);
}

/** Accepts only same-site paths, so `?redirect=` cannot send a user to another site. */
export function safeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/")) {
    return "/";
  }
  if (target.startsWith("//") || hasUnsafeChar(target)) {
    return "/";
  }
  if (target.startsWith("/sign-in")) {
    return "/";
  }
  return target;
}
