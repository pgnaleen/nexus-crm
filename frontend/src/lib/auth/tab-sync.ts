// Cross-tab auth sync -- see plan-auth-cross-tab-session-sync.md, Fix B.
// Cookies (access/refresh tokens) are shared across every tab in the
// browser profile, not per-tab. Logging in as a different user in one tab,
// or logging out, silently changes what an already-open tab is acting as
// with no signal today. This broadcasts that change so every OTHER open
// tab reloads and re-renders against whatever the cookies now say.
//
// A single module-level channel instance is used for BOTH posting and
// listening (rather than one-off instances per call) -- BroadcastChannel
// never delivers a message back to the object that posted it, so sharing
// one instance per tab is what stops a tab from reloading itself the
// moment it announces its own login/logout.
const CHANNEL_NAME = "orelia-auth";

let channel: BroadcastChannel | null | undefined;

// Feature-detected -- BroadcastChannel isn't universally available (older
// Safari, some embedded webviews). A tab that can't use it just doesn't
// get cross-tab sync rather than crashing.
function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel =
    typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined"
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;
  return channel;
}

// Called by login()/logout() (see lib/api/auth.ts) on confirmed success.
export function announceAuthChange(): void {
  getChannel()?.postMessage("auth-changed");
}

// Mounted once per tab (see components/providers/TabSyncListener.tsx).
// Silent reload on receiving a broadcast -- matches the Slack/GitHub
// pattern of just re-rendering into whatever the cookies now say, no
// warning toast. A reload re-hits /auth/me server-side and either shows
// the new user's data or bounces to login, whichever the cookies now imply.
export function subscribeToAuthChanges(): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const handleMessage = () => {
    window.location.reload();
  };
  ch.addEventListener("message", handleMessage);
  return () => ch.removeEventListener("message", handleMessage);
}
