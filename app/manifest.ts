import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Matchday",
    short_name: "Matchday",
    description: "Predict the scores. Win the bragging rights.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2EDE4",
    theme_color: "#F2EDE4",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/app-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
