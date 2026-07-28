import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The Nexus mark in brand red. Red rather than white because a tab icon sits
// on browser chrome we don't control -- the white lockup vanishes on a light
// tab strip. Path data is copied from brand-assets/nexus-mark-red.svg; the
// literal hex is deliberate here and is the one place it isn't tokenised,
// because this route renders outside the document and so has no access to the
// CSS custom properties declared in globals.css.
//
// Drawn as a data-URI <img> rather than inline JSX <svg>: this route renders
// through Satori (next/og), whose support for inline SVG elements is partial,
// but which handles data-URI images reliably.
const MARK_SVG = `<svg width="320" height="323" viewBox="0 0 320 323" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M61.9033 32.4812C43.1722 27.1973 30.2767 37.5859 30.2597 57.4822C30.1912 138.077 30.2414 218.673 30.1765 299.268C30.1731 303.486 30.1141 307.867 29.0248 311.885C27.1967 318.63 22.0191 322.308 15.1883 322.379C8.24093 322.451 3.31471 318.501 1.4951 311.803C0.399489 307.771 0.177511 303.404 0.171333 299.187C0.0530242 218.592 -0.0164465 137.997 0.00334993 57.402C0.00953065 32.2028 13.0529 12.1011 34.3496 3.88372C56.2664 -4.57289 76.9563 0.796921 94.717 19.836C143.649 72.2904 192.511 124.81 241.399 177.306C242.515 178.504 243.646 179.692 244.703 180.943C252.092 189.689 252.515 198.133 245.902 204.461C238.993 211.073 231.349 210.218 222.966 201.272C176.824 152.031 130.834 102.647 84.6403 53.4551C77.7478 46.1151 72.0587 37.3829 61.9033 32.4812Z" fill="#ED1B24"/><path d="M319.085 114.045C319.074 165.131 319.228 215.235 318.987 265.336C318.847 294.41 300.405 316.753 272.66 321.778C253.873 325.18 237.163 319.699 224.245 306.097C179.826 259.327 135.932 212.059 91.8463 164.973C90.7284 163.779 89.6453 162.544 88.6398 161.255C82.7295 153.676 82.7641 144.627 88.6923 139.098C95.1615 133.064 103.792 133.93 111.241 141.643C121.249 152.005 131.151 162.47 141.004 172.979C175.043 209.282 209.055 245.61 243.044 281.961C252.12 291.668 261.519 294.47 272.037 290.384C283.122 286.078 288.612 277.675 288.623 264.11C288.678 189.447 288.641 114.784 288.635 40.1208C288.635 33.8989 288.604 27.6768 288.643 21.4551C288.731 7.73703 294.032 0.409864 303.792 0.449639C313.326 0.488456 318.992 8.20624 319.031 21.6985C319.12 52.1528 319.076 82.6076 319.085 114.045Z" fill="#ED1B24"/></svg>`;

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`}
          alt=""
          width={28}
          height={28}
        />
      </div>
    ),
    { ...size },
  );
}
