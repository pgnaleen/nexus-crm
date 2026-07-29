import { io, Socket } from "socket.io-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Epic 3, Story 3.4 -- one shared connection for the whole tab, lazily
// created on first use and reused by every consumer (the board today, task
// chat in Story 3.5) rather than one socket per component. `withCredentials`
// so the browser attaches the httpOnly orelia_access_token cookie to the
// handshake, same as every apiFetch call already relies on -- the backend
// gateway verifies that same cookie by hand (no separate WS auth scheme).
let socket: Socket | null = null;

export function getRealtimeSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getRealtimeSocket() can only be called in the browser");
  }
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}
