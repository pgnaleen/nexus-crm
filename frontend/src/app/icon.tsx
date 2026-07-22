import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Generated, not a static asset: browsers auto-request /favicon.ico on every
// page load. With no file at that path, Next's [tenant] catch-all route was
// treating "favicon.ico" as a tenant slug and logging a NotFoundException
// for every single page load. This file (Next's icon.tsx convention) makes
// Next serve a real icon instead, so that request never reaches routing.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "3px solid #1a2744",
            position: "relative",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -1,
              right: -1,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#6aadff",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
