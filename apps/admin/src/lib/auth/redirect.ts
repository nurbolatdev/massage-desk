/** Accepts only same-site paths, so `?redirect=` cannot send a user to another site. */
export function safeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/")) {
    return "/";
  }
  if (target.startsWith("//") || target.startsWith("/\\")) {
    return "/";
  }
  if (target.startsWith("/sign-in")) {
    return "/";
  }
  return target;
}
