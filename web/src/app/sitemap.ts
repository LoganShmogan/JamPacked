import type { MetadataRoute } from "next";
import { programmes } from "@/lib/programmes";
import { site } from "@/lib/site";

export const dynamic = "force-static";

// Every public page. /admin and /welcome are left out (and kept out of search results).
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "monthly" | "yearly" = "monthly") => ({
    url: `${site.url}${path}`, changeFrequency, priority,
  });
  return [
    page("/", 1),
    page("/store/", 0.9),
    page("/programmes/", 0.8),
    ...programmes.map((p) => page(`/programmes/${p.slug}/`, 0.8)),
    page("/contact/", 0.5),
    page("/legal/terms/", 0.3, "yearly"),
    page("/legal/privacy/", 0.3, "yearly"),
    page("/legal/cookies/", 0.3, "yearly"),
  ];
}
