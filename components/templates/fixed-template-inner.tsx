import { NativeAdSlot } from "@/components/integrations/native-ad-slot";
import { JsonLd } from "@/components/site/json-ld";
import { siteConfig } from "@/config/site";
import { siteSkin } from "@/config/skin";
import type { SeoPageDefinition } from "@/config/types";
import { enabledLegalPages, getRelatedPages, visibleCorePages } from "@/content/registry";
import { esc, renderFixedDocument, renderStructuredSections } from "@/lib/fixed-template/render";
import { pageSchemas } from "@/lib/schema";
import { assetPath, routePath } from "@/lib/urls";

function articleInner(page: SeoPageDefinition): string {
  const sections = renderStructuredSections(page.sections);
  const faq = page.faq?.length
    ? `<section id="faq"><h2>FAQ</h2>${page.faq.map((item) => `<p><b>${esc(item.question)}</b> ${esc(item.answer)}</p>`).join("")}</section>`
    : "";
  const related = getRelatedPages(page);
  const relatedHtml = related.length
    ? `<section id="related"><h2>Related</h2><ul>${related.map((item) => `<li><a href="${esc(siteSkin() === "arcade-play" ? assetPath(routePath(item.slug)) : routePath(item.slug))}">${esc(item.navLabel)}</a></li>`).join("")}</ul></section>`
    : "";
  return `<p>${esc(page.hero.lead)}</p>${sections}${faq}${relatedHtml}`;
}

export function FixedTemplateInner({ page }: { page: SeoPageDefinition }) {
  const skin = siteSkin();
  const nav = visibleCorePages
    .filter((item) => item.slug.replace(/^\/+|\/+$/g, ""))
    .map((item) => ({ slug: item.slug.replace(/^\/+|\/+$/g, ""), label: item.navLabel, href: routePath(item.slug) }));
  const rendered = renderFixedDocument({
    skin,
    page: "inner",
    accentColorId: siteConfig.theme.accentColorId,
    gameName: siteConfig.game.name || siteConfig.shortName,
    nav,
    currentSlug: page.slug,
    homeHref: skin === "arcade-play" ? assetPath("/") : "/",
    logoUrl: skin === "arcade-play" ? assetPath(siteConfig.assets.logo) : null,
    legalLinks: enabledLegalPages.map(item => ({ slug: item.slug, label: item.navLabel, href: skin === "arcade-play" ? assetPath(routePath(item.slug)) : routePath(item.slug) })),
    heading: page.hero.heading,
    lead: page.hero.lead,
    articleHtml: articleInner(page),
  });
  return (
    <>
      <JsonLd data={pageSchemas(page)} />
      <div dangerouslySetInnerHTML={{ __html: rendered.rest }} />
      <div className="site-container"><NativeAdSlot /></div>
    </>
  );
}
