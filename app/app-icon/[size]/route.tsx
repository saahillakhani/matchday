import { ImageResponse } from "next/og";
import { frauncesFont, MatchdayMark } from "@/lib/brand-icon";

/** Home-screen icons for the web app manifest. The "M" is kept well
 *  inside the centre so it survives Android's maskable crop. */
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(
  _req: Request,
  { params }: { params: { size: string } },
) {
  const dim = Number(params.size);
  return new ImageResponse(<MatchdayMark dim={dim} scale={0.56} />, {
    width: dim,
    height: dim,
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
