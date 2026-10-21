import { accentOverrideCss, resolveAccent, templatePack, type TemplatePack, type TemplateSkin } from "./catalog";
import { SPEC_HTML } from "./spec-html";
import type { PageSection, DataTable } from "../../config/types";

export interface TemplateLink { slug: string; label: string; href: string; }
export interface TemplateEntry { href: string; title: string; text: string; }
export interface FixedTemplateInput {
  preview?: boolean;
  legalLinks?: TemplateLink[];
  officialGameUrl?: string | null;
  skin: TemplateSkin | string; page: "home" | "inner"; accentColorId?: string | null; gameName: string;
  nav: TemplateLink[]; currentSlug?: string | null; homeHref: string; logoUrl?: string | null; bannerUrl?: string | null;
  heading?: string | null; lead?: string | null; articleHtml?: string | null; entries?: TemplateEntry[] | null; supplementHtml?: string | null;
}

export function esc(value: string): string { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function safeAttr(value: string) { return esc(value).replace(/'/g,"&#39;"); }
function slugOnly(value: string) { return value.replace(/^\/+|\/+$/g, ""); }

export function templateNavLinks(nav: TemplateLink[], page: "home" | "inner", currentSlug?: string | null): string {
  return nav.filter((item)=>slugOnly(item.slug)).map((item)=>{
    const active = page === "inner" && currentSlug && slugOnly(item.slug) === slugOnly(currentSlug);
    return `<a class="nav-link${active ? " active" : ""}" data-nav href="${safeAttr(item.href)}">${esc(item.label)}</a>`;
  }).join("");
}

function firstLetter(gameName: string) { return esc((gameName.trim()[0] || "G").toUpperCase()); }
function logoMarkup(input: FixedTemplateInput) {
  return input.logoUrl
    ? `<img class="brand-logo" alt="" src="${safeAttr(input.logoUrl)}">`
    : `<span class="brand-logo logo-fallback" aria-hidden="true">${firstLetter(input.gameName)}</span>`;
}
function brandMarkup(input: FixedTemplateInput) { return `${logoMarkup(input)}<strong>${esc(input.gameName)}</strong>`; }

function replaceBrand(html: string, input: FixedTemplateInput): string {
  let changed = false;
  let next = html.replace(/<a class="([^"]*\b(?:brand|logo)\b[^"]*)"[^>]*>[\s\S]*?<\/a>/, (_m, cls:string)=>{
    changed = true; return `<a class="${cls}" href="${safeAttr(input.homeHref)}" aria-label="Back to homepage">${brandMarkup(input)}</a>`;
  });
  next = next.replace(/<span class="brand-logo">[\s\S]*?<\/span>/g, logoMarkup(input));
  if (!changed) next = next.replace(/<div class="task">[\s\S]*?<\/div>/, `<a class="task" href="${safeAttr(input.homeHref)}" aria-label="Back to homepage">${esc(input.gameName)}</a>`);
  return next;
}

function replaceNav(html: string, links: string): string {
  const patterns = [
    /<nav class="([^"]*site-nav[^"]*)"[^>]*>[\s\S]*?<\/nav>/,
    /<nav class="(nav)"[^>]*>[\s\S]*?<\/nav>/,
    /<div class="(nav)">[\s\S]*?<\/div>/,
  ];
  for (const pattern of patterns) {
    if (!pattern.test(html)) continue;
    return html.replace(pattern, (full, cls: string) => (
      full.startsWith("<div")
        ? `<div class="${cls}">${links}</div>`
        : `<nav class="${cls}">${links}</nav>`
    ));
  }
  return html;
}

function replaceCrumbs(html: string, homeHref: string, current: string | null): string {
  const body = current ? `<a href="${safeAttr(homeHref)}">Home</a> › ${esc(current)}` : `<a href="${safeAttr(homeHref)}">Home</a>`;
  return html.replace(/<div class="site-breadcrumb">[\s\S]*?<\/div>/g,`<div class="site-breadcrumb">${body}</div>`).replace(/<div class="crumb">[\s\S]*?<\/div>/g,`<div class="crumb">${body}</div>`);
}

function injectTemplateAssets(html: string, input: FixedTemplateInput): string {
  let next = html.replace(/<(?:p|span)[^>]*data-nav-status[^>]*>[\s\S]*?<\/(?:p|span)>/g, "");
  if (input.bannerUrl) {
    const banner = `<img class="template-banner-image" alt="" src="${safeAttr(input.bannerUrl)}">`;
    next = next.replace(/(<(?:div|aside|article)[^>]*class="[^"]*(?:cover-own|hero-cover|hero-art|cover-card|\bcover\b|\bvisual\b)[^"]*"[^>]*>)/, `$1${banner}`);
  }
  return next.replace("</style>", `\n.brand-logo{width:36px;height:36px;object-fit:cover;display:inline-grid;place-items:center;vertical-align:middle}.template-banner-image{width:100%;height:100%;min-height:180px;object-fit:cover;display:block}.template-banner-image~svg{display:none!important}.template-page-list{display:grid;gap:8px;margin:12px 0}.template-page-link{display:block;padding:9px 10px;border:1px solid currentColor;text-decoration:none;opacity:.9}\n</style>`);
}

function replaceFactsWithEntries(html: string, entries: TemplateEntry[] | null | undefined): string {
  if (!entries?.length) return html;
  const list = `<div class="template-page-list">${entries.slice(0,8).map(e=>`<a class="template-page-link" href="${safeAttr(e.href)}"><b>${esc(e.title)}</b></a>`).join("")}</div>`;
  return html.replace(/<table class="facts">[\s\S]*?<\/table>/g, list);
}

function replaceBalanced(html: string, tag: string, className: string, inner: string): string {
  const marker = `<${tag} class="${className}">`; const start = html.indexOf(marker); if (start < 0) return html;
  const openEnd = start + marker.length; const closer = `</${tag}>`; let depth=1,index=openEnd;
  while(index<html.length&&depth>0){const no=html.indexOf(`<${tag}`,index),nc=html.indexOf(closer,index);if(nc<0)return html;if(no!==-1&&no<nc){depth++;index=no+tag.length+1}else{depth--;if(depth===0)return html.slice(0,openEnd)+inner+html.slice(nc);index=nc+closer.length}}
  return html;
}
function applyEntries(html: string, skin: string, entries: TemplateEntry[]): string {
  const cards = entries.slice(0,8).map((entry,index)=>{
    const title=esc(entry.title), text=esc(entry.text), href=safeAttr(entry.href);
    if(skin==="portal")return `<a class="card" href="${href}"><div class="icon">${index+1}</div><h3>${title}</h3><p>${text}</p></a>`;
    if(skin==="wiki")return `<a class="row" href="${href}"><b>${title}</b><span>${text}</span></a>`;
    if(skin==="resource")return `<a class="quick" href="${href}"><b>${title}</b><span>${text}</span></a>`;
    if(skin==="editorial")return `<article class="article"><a href="${href}"><div class="thumb"></div><div class="article-body"><h3>${title}</h3><p>${text}</p></div></a></article>`;
    if(skin==="glass")return `<a class="block" href="${href}"><div class="num">0${index+1}</div><b>${title}</b><p>${text}</p></a>`;
    if(skin==="pixel")return `<a class="tile" href="${href}"><div class="icon">▣</div><b>${title}</b><p>${text}</p></a>`;
    if(skin==="horror")return `<article class="card"><a href="${href}"><div class="tag">GUIDE</div><h3>${title}</h3><p>${text}</p></a></article>`;
    return "";
  }).join("");
  if(!cards)return html;
  if(skin==="portal")return replaceBalanced(html,"div","grid",cards);
  if(skin==="wiki")return replaceBalanced(html,"div","list",cards);
  if(skin==="resource")return replaceBalanced(html,"div","quick-grid",cards);
  if(skin==="editorial")return replaceBalanced(html,"section","grid",cards);
  if(skin==="glass")return replaceBalanced(html,"div","blocks",cards);
  if(skin==="pixel")return replaceBalanced(html,"div","tiles",cards);
  if(skin==="horror")return replaceBalanced(html,"div","cards",cards);
  return html;
}

function neutralizeDemoCopy(html: string, _input: FixedTemplateInput): string { return html; }

function applyCopy(html: string, input: FixedTemplateInput): string {
  let next=neutralizeDemoCopy(html,input);
  if(input.heading)next=next.replace(/<h1>[\s\S]*?<\/h1>/,`<h1>${esc(input.heading)}</h1>`);
  if(input.lead){ if(next.includes('<p class="lead">'))next=next.replace(/<p class="lead">[\s\S]*?<\/p>/,`<p class="lead">${esc(input.lead)}</p>`); }
  return next;
}

export function extractStyle(html:string):string{return [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]??"").join("\n")}
export function extractBody(html:string):string{const m=html.match(/<body[^>]*>([\s\S]*)<\/body>/i);return(m?.[1]??html).replace(/<script[\s\S]*?<\/script>/g,"")}
function deriveInnerTemplate(home:string,pack:TemplatePack):string{
  const style=extractStyle(home); const fg=pack.dark?"#F4F4F5":"#1F2937", muted=pack.dark?"#A1A1AA":"#667085";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Game Guide</title><style>${style}\n:root{--accent:${pack.defaultAccent}}body{background:${pack.background};color:${fg}}.template-inner-header{position:relative;z-index:10;border-bottom:1px solid color-mix(in srgb,${fg} 18%,transparent)}.template-inner-row{width:min(1120px,calc(100% - 32px));min-height:68px;margin:auto;display:flex;align-items:center;gap:20px}.template-inner-row .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit}.template-inner-row .site-nav{margin-left:auto;display:flex;flex-wrap:wrap;gap:6px}.template-inner-row .nav-link{padding:9px 11px;text-decoration:none;color:${muted}}.template-inner-row .nav-link.active{color:inherit;box-shadow:inset 0 -2px 0 var(--accent)}.template-inner-main{width:min(980px,calc(100% - 32px));margin:auto;padding:34px 0 54px}.site-breadcrumb{font-size:12px;color:${muted};margin-bottom:22px}.site-breadcrumb a{color:var(--accent)}.template-inner-article h1{font-size:clamp(2.2rem,5vw,3.6rem);line-height:1.02;margin:0 0 18px}.template-inner-article h2{margin-top:38px}.template-inner-article p,.template-inner-article li{line-height:1.78;color:${muted}}.template-inner-footer{border-top:1px solid color-mix(in srgb,${fg} 18%,transparent);padding:30px 0}.template-inner-footer>div{width:min(1120px,calc(100% - 32px));margin:auto;color:${muted};font-size:13px}@media(max-width:760px){.template-inner-row .site-nav{display:none}}</style></head><body data-template="${pack.specId.replace(/^\d+-/,"")}"><header class="template-inner-header"><div class="template-inner-row"><a class="brand" href="home.html" aria-label="Back to homepage"><strong>Game</strong></a><nav class="site-nav"><a class="nav-link" href="inner.html#guide">Guide</a></nav></div></header><main class="template-inner-main"><div class="site-breadcrumb"><a href="home.html">Home</a> › Guide</div><article class="template-inner-article"><h1>Game Guide</h1><p class="lead">Player guide and reference page.</p><section id="guide"><h2>Guide</h2><p>Guide content.</p></section></article></main><footer class="template-inner-footer"><div>Independent player guide</div></footer></body></html>`;
}
function templateSource(skin:string,page:"home"|"inner"){const pack=templatePack(skin),source=SPEC_HTML[pack.specId];if(!source?.home)throw new Error(`Missing approved HTML for ${pack.specId} home`);return{pack,html:page==="home"?source.home:(source.inner||deriveInnerTemplate(source.home,pack))}}

function replaceArticleBody(html:string,articleHtml:string):string{
  const match=html.match(/<article([^>]*)class="([^"]*template-inner-article[^"]*)"([^>]*)>[\s\S]*?<\/article>/) || html.match(/<article([^>]*)>[\s\S]*?<\/article>/);
  if(!match)return html; const full=match[0]; const attrs=full.match(/^<article([^>]*)>/)?.[1]??""; const h1=full.match(/<h1>[\s\S]*?<\/h1>/)?.[0]??"";
  return html.replace(full,`<article${attrs}>${h1}${articleHtml}</article>`);
}
function insertSupplement(html:string,supplement:string){if(html.includes("</main>"))return html.replace("</main>",`${supplement}</main>`);if(html.includes("<footer"))return html.replace("<footer",`${supplement}<footer`);return html.replace("</body>",`${supplement}</body>`)}


function renderTable(table: DataTable): string {
  const head = table.columns.map(column => `<th scope="col">${esc(column)}</th>`).join("");
  const rows = table.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
  return `<div class="fixed-table-wrap"><table><caption>${esc(table.caption)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
export function renderStructuredSections(sections: PageSection[]): string {
  return sections.map(section => {
    const paragraphs = (section.paragraphs ?? []).map(p => `<p>${esc(p)}</p>`).join("");
    const intro = section.intro ? `<p class="lead">${esc(section.intro)}</p>` : "";
    const subsections = (section.subsections ?? []).map(sub => `<div class="fixed-subsection"><h3>${esc(sub.heading)}</h3>${sub.paragraphs.map(p=>`<p>${esc(p)}</p>`).join("")}${sub.bullets?.length ? `<ul>${sub.bullets.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>` : ""}${sub.table ? renderTable(sub.table) : ""}</div>`).join("");
    const steps = section.steps?.length ? `<ol class="fixed-steps">${section.steps.map(step=>`<li><strong>${esc(step.heading)}</strong><p>${esc(step.description)}</p></li>`).join("")}</ol>` : "";
    const links = section.links?.length ? `<div class="fixed-related-links">${section.links.map(link=>`<a href="/${safeAttr(slugOnly(link.slug))}/"><strong>${esc(link.label)}</strong>${link.description ? `<span>${esc(link.description)}</span>` : ""}</a>`).join("")}</div>` : "";
    return `<section class="fixed-content-section" id="${safeAttr(section.id)}"><h2>${esc(section.heading)}</h2>${intro}${paragraphs}${subsections}${steps}${section.table ? renderTable(section.table) : ""}${links}</section>`;
  }).join("");
}
function repairFixedTemplateChrome(html: string, input: FixedTemplateInput): string {
  let next=html;
  const navigation=[{label:"Home",href:input.homeHref},...input.nav,...(input.legalLinks??[])];
  const cleanNavigation=navigation.filter((item,i,all)=>all.findIndex(x=>x.href===item.href)===i);
  if (input.skin==="portal" && input.page==="home") {
    const primary=input.nav[0];
    const buttons=[
      primary ? `<a class="btn primary" href="${safeAttr(primary.href)}">Start: ${esc(primary.label)}</a>` : "",
      input.officialGameUrl ? `<a class="btn secondary" href="${safeAttr(input.officialGameUrl)}" rel="noopener noreferrer">Play Ride a Dino on Roblox ↗</a>` : ""
    ].join("");
    next=next.replace(/<div class="actions">[\s\S]*?<\/div>/,`<div class="actions">${buttons}</div>`);
    next=next.replace(/<div class="eyebrow"><\/div>/,`<div class="eyebrow">INDEPENDENT ROBLOX WIKI</div>`);
    next=next.replace(/<div class="section-head"><h2><\/h2><small><\/small><\/div>/,`<div class="section-head"><h2>Explore Ride a Dino Guides</h2><small>Choose a focused player task</small></div>`);
    if(input.bannerUrl) next=next.replace(/<div class="cover-own">[\s\S]*?<\/div>/,`<div class="cover-own"><img class="template-banner-image" src="${safeAttr(input.bannerUrl)}" alt="Ride a Dino Roblox game cover"></div>`);
  }
  const links=`<a href="${safeAttr(input.homeHref)}">Home</a>${input.nav.map(l=>`<a href="${safeAttr(l.href)}">${esc(l.label)}</a>`).join("")}`;
  const legal=(input.legalLinks??[]).map(l=>`<a href="${safeAttr(l.href)}">${esc(l.label)}</a>`).join("");
  if(input.skin==="portal") {
    const footer=`<footer class="global-footer"><div class="wrap global-footer-grid"><div><div class="global-footer-brand">${logoMarkup(input)}<strong>${esc(input.gameName)} Wiki</strong></div><p>Independent fan-made guide to the Roblox experience by and Catch Them All. Not affiliated with Roblox or the creator.</p></div><div><b>Explore</b>${links}</div><div><b>Site</b>${legal}</div></div></footer>`;
    next=next.replace(/<footer class="global-footer">[\s\S]*?<\/footer>/,footer);
  }
  const innerFooter=`<footer class="template-inner-footer"><div><strong>${esc(input.gameName)} • Independent fan guide</strong><nav class="fixed-footer-links" aria-label="Footer navigation">${cleanNavigation.map(l=>`<a href="${safeAttr(l.href)}">${esc(l.label)}</a>`).join("")}</nav></div></footer>`;
  next=next.replace(/<footer class="template-inner-footer">[\s\S]*?<\/footer>/,innerFooter);
  return next;
}

export function renderFixedTemplate(input:FixedTemplateInput):string{
  const {pack,html:source}=templateSource(input.skin,input.page); const paint=resolveAccent(pack.skin,input.accentColorId);
  const currentLabel=input.page==="inner"?(input.nav.find(x=>slugOnly(x.slug)===slugOnly(input.currentSlug||""))?.label||input.heading||"Guide"):null;
  let html=source;
  html=replaceBrand(html,input);
  html=html.replaceAll('href="home.html"',`href="${safeAttr(input.homeHref)}"`);
  html=replaceNav(html,templateNavLinks(input.nav,input.page,input.currentSlug));
  html=replaceCrumbs(html,input.homeHref,currentLabel);
  html=html.replace(/href="inner\.html#([^"]+)"/g,(_m: string, id: string)=>{const linked=input.nav.find(x=>slugOnly(x.slug)===id);return`href="${safeAttr(linked?.href||`#${id}`)}"`});
  html=injectTemplateAssets(html,input);
  if(input.page==="home"&&input.entries?.length){html=applyEntries(html,pack.skin,input.entries);html=replaceFactsWithEntries(html,input.entries)}
  if(input.page==="inner"&&input.articleHtml)html=replaceArticleBody(html,input.articleHtml);
  if(input.supplementHtml)html=insertSupplement(html,input.supplementHtml);
  html=applyCopy(html,input);
  html=repairFixedTemplateChrome(html,input);
  html=html.replace(/--accent:#[0-9A-Fa-f]{6}/,`--accent:${paint.textAccent}`);
  html=html.replace("</style>",`${accentOverrideCss(pack.skin,paint)}</style>`);
  if(!/<body[^>]*data-template=/.test(html))html=html.replace(/<body([^>]*)>/,`<body$1 data-template="${pack.specId.replace(/^\d+-/,"")}">`);
  return html;
}

function balancedFirstElement(body:string,marker:string,tag:string){const start=body.indexOf(marker);if(start<0)return"";const openEnd=body.indexOf(">",start)+1, closer=`</${tag}>`;let depth=1,index=openEnd;while(index<body.length&&depth){const no=body.indexOf(`<${tag}`,index),nc=body.indexOf(closer,index);if(nc<0)return"";if(no!==-1&&no<nc){depth++;index=no+tag.length+1}else{depth--;index=nc+closer.length}}return body.slice(start,index)}
export function splitFixedChrome(body:string,_skin:string):{chrome:string;rest:string}{const source=body.trim();let chrome="";if(source.startsWith('<div class="topline">')){const end=source.indexOf("</header>");if(end>=0)chrome=source.slice(0,end+9)}else if(source.startsWith('<nav class="floating">')){chrome=balancedFirstElement(source,'<nav class="floating">',"nav")}else if(source.startsWith('<div class="desktopbar">')){chrome=balancedFirstElement(source,'<div class="desktopbar">',"div")}else{const hs=source.indexOf("<header"),he=source.indexOf("</header>");if(hs>=0&&he>=0)chrome=source.slice(hs,he+9)}return{chrome,rest:chrome?source.replace(chrome,""):source}}

function scopeSelectorList(selector:string,scope:string){return selector.split(",").map(part=>{const sel=part.trim();if(!sel||sel.startsWith("@"))return sel;if(sel===":root"||sel==="html"||sel==="body")return scope;return`${scope} ${sel}`}).join(",")}
export function scopeTemplateCss(css:string,scope:string):string{
  let source=css.replace(/@import[^;]+;/g,"").trim(),index=0,out=""; while(index<source.length){while(/[\s]/.test(source[index]||""))index++;if(index>=source.length)break;
    if(source.startsWith("@media",index)||source.startsWith("@supports",index)){const brace=source.indexOf("{",index);if(brace<0)break;const header=source.slice(index,brace+1);let depth=1,cursor=brace+1;while(cursor<source.length&&depth){if(source[cursor]==="{")depth++;else if(source[cursor]==="}")depth--;cursor++}out+=header+scopeTemplateCss(source.slice(brace+1,cursor-1),scope)+"}";index=cursor;continue}
    if(source.startsWith("@keyframes",index)||source.startsWith("@font-face",index)){const brace=source.indexOf("{",index);if(brace<0)break;let depth=1,cursor=brace+1;while(cursor<source.length&&depth){if(source[cursor]==="{")depth++;else if(source[cursor]==="}")depth--;cursor++}out+=source.slice(index,cursor);index=cursor;continue}
    const brace=source.indexOf("{",index);if(brace<0)break;const selector=source.slice(index,brace).trim(),close=source.indexOf("}",brace);if(close<0)break;out+=scopeSelectorList(selector,scope)+"{"+source.slice(brace+1,close)+"}";index=close+1;
  }return out;
}
export function scopedTemplateCss(skin:string,accentColorId?:string|null):string{const {pack,html:home}=templateSource(skin,"home"),{html:inner}=templateSource(skin,"inner"),paint=resolveAccent(pack.skin,accentColorId);const raw=extractStyle(home)+"\\n"+extractStyle(inner)+"\\n"+accentOverrideCss(pack.skin,paint);return scopeTemplateCss(raw,`body[data-fixed-template="${pack.skin}"]`) + `\nbody[data-fixed-template="${pack.skin}"] .fixed-content-section{margin:34px 0;padding:0 0 24px;border-bottom:1px solid var(--line,#334155)}body[data-fixed-template="${pack.skin}"] .fixed-content-section h2{margin:0 0 14px;font-size:25px;line-height:1.25}body[data-fixed-template="${pack.skin}"] .fixed-content-section h3{margin:19px 0 8px;font-size:19px}body[data-fixed-template="${pack.skin}"] .fixed-content-section p,body[data-fixed-template="${pack.skin}"] .fixed-content-section li{line-height:1.75}body[data-fixed-template="${pack.skin}"] .fixed-content-section p{margin:13px 0}body[data-fixed-template="${pack.skin}"] .fixed-table-wrap{overflow-x:auto;margin:20px 0}body[data-fixed-template="${pack.skin}"] .fixed-table-wrap table{border-collapse:collapse;width:100%;font-size:14px}body[data-fixed-template="${pack.skin}"] .fixed-table-wrap caption{text-align:left;font-weight:bold;padding:10px}body[data-fixed-template="${pack.skin}"] .fixed-table-wrap th,body[data-fixed-template="${pack.skin}"] .fixed-table-wrap td{border:1px solid var(--line,#334155);padding:10px;min-width:110px;text-align:left}body[data-fixed-template="${pack.skin}"] .fixed-steps{display:grid;gap:12px;padding-left:23px}body[data-fixed-template="${pack.skin}"] .fixed-related-links{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}body[data-fixed-template="${pack.skin}"] .fixed-related-links a{border:1px solid var(--line,#334155);border-radius:12px;padding:14px;max-width:360px}body[data-fixed-template="${pack.skin}"] .fixed-related-links span{display:block;font-size:13px;margin-top:8px;opacity:.8}body[data-fixed-template="${pack.skin}"] .fixed-footer-links{display:flex;flex-wrap:wrap;gap:15px;margin-top:15px}body[data-fixed-template="portal"] .header{height:auto;min-height:72px;flex-wrap:wrap;padding:12px 0}body[data-fixed-template="portal"] .nav{display:flex!important;flex-wrap:wrap;margin-left:auto}body[data-fixed-template="portal"] .nav-link{padding:8px 10px}@media(max-width:600px){body[data-fixed-template="portal"] .nav{margin-left:0;width:100%}}\n`}
// Ad slots are inserted between existing elements. Content, headings and
// their hierarchy remain byte-for-byte unchanged.
const BANNER_SLOT = '<div data-adsterra-banner-slot="" class="adsterra-slot"></div>';
const NATIVE_SLOT = '<div data-adsterra-native-slot="" class="adsterra-slot"></div>';

function insertAfterSection(html: string, className: string, markup: string): string {
  const opening = new RegExp('<section\\b[^>]*class="' + className + '"[^>]*>');
  const match = opening.exec(html);
  if (!match) throw new Error("Missing fixed-template content block: " + className);
  let index = match.index + match[0].length;
  let depth = 1;
  while (depth && index < html.length) {
    const open = html.indexOf("<section", index);
    const close = html.indexOf("</section>", index);
    if (close < 0) throw new Error("Unclosed template section: " + className);
    if (open >= 0 && open < close) {
      depth++;
      index = open + 8;
    } else {
      depth--;
      index = close + "</section>".length;
    }
  }
  return html.slice(0, index) + markup + html.slice(index);
}
function insertAdSlots(rest: string, page: "home" | "inner"): string {
  if (page === "home") {
    const withBanner = insertAfterSection(rest, "hero", BANNER_SLOT);
    return insertAfterSection(withBanner, "section", NATIVE_SLOT);
  }
  const articleStart = rest.indexOf('<article class="template-inner-article">');
  if (articleStart < 0) throw new Error("Missing inner-page article");
  const headingEnd = rest.indexOf("</h1>", articleStart);
  if (headingEnd < 0) throw new Error("Missing inner-page heading");
  const leadStart = rest.indexOf("<p>", headingEnd);
  const leadEnd = rest.indexOf("</p>", leadStart) + 4;
  if (leadStart < 0 || leadEnd < 4) throw new Error("Missing inner-page lead");
  const withBanner = rest.slice(0, leadEnd) + BANNER_SLOT + rest.slice(leadEnd);
  const firstSection = withBanner.indexOf('<section class="fixed-content-section"', leadEnd);
  if (firstSection < 0) throw new Error("Missing inner-page first content block");
  const firstSectionEnd = withBanner.indexOf("</section>", firstSection);
  const sectionHtml = withBanner.slice(firstSection, firstSectionEnd);
  const paragraphs = [...sectionHtml.matchAll(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/g)];
  if (!paragraphs.length) throw new Error("Missing first content paragraphs");
  // Two complete pre-existing paragraphs form the spacing between ads.
  const target = paragraphs[Math.min(1, paragraphs.length - 1)];
  const pos = firstSection + (target.index ?? 0) + target[0].length;
  return withBanner.slice(0, pos) + NATIVE_SLOT + withBanner.slice(pos);
}
export function renderFixedDocument(input:FixedTemplateInput):{html:string;body:string;chrome:string;rest:string}{
  const html=renderFixedTemplate(input);
  const body=extractBody(html);
  const parts=splitFixedChrome(body,templatePack(input.skin).skin);
  const clean=parts.rest.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi,"");
  return {html,body,chrome:parts.chrome,rest:insertAdSlots(clean,input.page)};
}

