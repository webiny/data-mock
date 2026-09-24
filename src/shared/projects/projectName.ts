/**
 * Turns whatever was supplied as a project name into something that reads like a name.
 *
 * Projects registered before the folder-based flow carry their whole path as their name — the
 * `.projects.json` on this machine holds
 * `"Users/brunozoric/work/webiny/webiny-js-6.5"` — which then appears in every list, badge and
 * confirmation dialog. A slash in a Webiny project name is a mistake, not a choice, so the last
 * segment is used instead.
 *
 * A name that is only separators, or empty, is left to the caller's validation rather than being
 * silently replaced with something invented.
 */
export function toProjectName(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed.includes("/") && !trimmed.includes("\\")) {
    return trimmed;
  }

  const segments = trimmed.split(/[/\\]+/).filter((segment) => segment !== "");
  const last = segments[segments.length - 1];

  return last ?? trimmed;
}
