import { siteConfig } from "@/config/site";
import { siteSkin } from "@/config/skin";
import type { InternalLink } from "@/config/types";
import { homePage } from "@/content/home";
import { isFixedTemplate } from "@/lib/fixed-template/mode";
import { renderFixedDocument } from "@/lib/fixed-template/render";
import { assetPath, routePath } from "@/lib/urls";

export function FixedTemplateHeader({ links }: { links: InternalLink[] }) {
  if (!isFixedTemplate()) return null;
  const skin = siteSkin();
  const page = "home" as const;
  const nav = links
    .filter((link) => link.slug.replace(/^\/+|\/+$/g, ""))
    .map((link) => ({
      slug: link.slug.replace(/^\/+|\/+$/g, ""),
      label: link.label,
      href: routePath(link.slug),
    }));
  const rendered = renderFixedDocument({
    skin,
    page,
    accentColorId: siteConfig.theme.accentColorId,
    gameName: siteConfig.game.name || siteConfig.shortName,
    nav,
    homeHref: "/",
    logoUrl: assetPath(siteConfig.assets.logo),
    bannerUrl: assetPath(siteConfig.assets.cover),
    heading: homePage.hero.heading,
    lead: homePage.hero.lead,
  });
  return <div dangerouslySetInnerHTML={{ __html: rendered.chrome }} />;
}
