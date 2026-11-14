import type { MetadataRoute } from "next";

import { messages } from "@/messages/pt-BR";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.appName,
    short_name: messages.appName,
    description: messages.appDescription,
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
