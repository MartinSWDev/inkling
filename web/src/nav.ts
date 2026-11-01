/** Path-based routing helpers (prompts/14 A). Keeps /r/<code> working. */
export function navigate(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export const currentPath = () => window.location.pathname;
