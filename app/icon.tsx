import { ImageResponse } from "next/og";
import { frauncesFont, MatchdayMark } from "@/lib/brand-icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(<MatchdayMark dim={size.width} scale={0.78} />, {
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
