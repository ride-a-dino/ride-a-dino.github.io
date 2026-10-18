import Link from "next/link";
import { isFixedTemplate } from "@/lib/fixed-template/mode";
import { siteSkin } from "@/config/skin";
import { assetPath } from "@/lib/urls";
import { siteConfig } from "@/config/site";
import type { InternalLink } from "@/config/types";
import { routePath } from "@/lib/urls";

export function SiteFooter({ coreLinks, legalLinks }: { coreLinks: InternalLink[]; legalLinks: InternalLink[] }) {
  // Use the same site-wide footer on every route, with the approved portal styling.
  if (isFixedTemplate() && siteSkin() === "portal") {
    return (
      <footer className="global-footer" aria-label="Site footer">
        <div className="wrap global-footer-grid">
          <div>
            <div className="global-footer-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo" src={assetPath(siteConfig.assets.logo)} alt="" />
              <strong>{siteConfig.game.name} Wiki</strong>
            </div>
            <p>{siteConfig.description}</p>
            <p>Independent fan-made guide. Not affiliated with Roblox or the game developer.</p>
          </div>
          <nav aria-label="Footer guides">
            <b>Ride a Dino Guides</b>
            {coreLinks.map(link => (
              <Link key={link.slug || "home"} href={routePath(link.slug)}>{link.label}</Link>
            ))}
          </nav>
          <nav aria-label="Footer information">
            <b>About &amp; Sources</b>
            {legalLinks.map(link => (
              <Link key={link.slug} href={routePath(link.slug)}>{link.label}</Link>
            ))}
            {siteConfig.game.officialUrl ? (
              <a href={siteConfig.game.officialUrl} target="_blank" rel="noopener noreferrer">Official Roblox game ↗</a>
            ) : null}
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-20 border-t border-border bg-card/45">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="mb-3 text-lg font-black text-foreground">{siteConfig.siteName}</p>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">{siteConfig.description}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Independent, fan-made and not affiliated with the game developer or platform owner.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-black uppercase tracking-widest text-foreground">Explore</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {coreLinks.map((link) => (
              <li key={link.slug}><Link className="hover:text-primary" href={routePath(link.slug)}>{link.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-black uppercase tracking-widest text-foreground">Site</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {legalLinks.map((link) => (
              <li key={link.slug}><Link className="hover:text-primary" href={routePath(link.slug)}>{link.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
