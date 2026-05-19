import { ImageResponse } from "next/og";
import { frauncesFont, MatchdayMark } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<MatchdayMark dim={size.width} scale={0.62} />, {
    ...size,
    fonts: [
      {
        name: "Fraunces",
        data: await frauncesFont(),
        weight: 600,
        style: "normal",
      },
    ],
  });
}
