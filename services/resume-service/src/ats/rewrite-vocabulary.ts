// Shared by the prompt and validator: grammar may change, factual vocabulary may not.
export const REWRITE_GRAMMAR =
  "a an the and to of for in on with by from at as is are was were be been being this that these those it its their our my i we they while through across within using into over under during more less than also which who how when where each all both such including via order " +
  "work worked working build built building develop developed developing create created creating implement implemented implementing design designed designing manage managed managing maintain maintained maintaining improve improved improving deliver delivered delivering support supported supporting collaborate collaborated collaborating lead led leading automate automated automating optimize optimized optimizing reduce reduced reducing increase increased increasing integrate integrated integrating test tested testing establish established establishing analyze analyzed analyzing configure configured configuring monitor monitored monitoring";

// Narrow equivalent spellings, not arbitrary synonyms or skill inference.
export const REWRITE_ALIASES: Readonly<Record<string, string>> = {
  auth: "authentication",
  apps: "applications",
};
export const canonicalRewriteWord = (word: string): string =>
  REWRITE_ALIASES[word] ?? word;
