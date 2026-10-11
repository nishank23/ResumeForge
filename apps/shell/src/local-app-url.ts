/** Auth cookies and Google callbacks use the canonical local shell origin. */
export function canonicalLocalAppUrl(href: string): string | null {
  const url = new URL(href);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3000"
  ) {
    return null;
  }

  url.hostname = "localhost";
  return url.href;
}
