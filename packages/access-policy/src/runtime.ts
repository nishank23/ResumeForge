/** One origin for the supervised personal app; local development retains its existing URLs. */
export function runtimeAppOrigin(environment = process.env): string {
  const cloud = environment.RESUME_FORGE_RUNTIME === "cloud";
  if (!cloud) {
    if (environment.NODE_ENV === "production")
      throw new Error("Production requires the managed cloud runtime.");
    return "http://localhost:3000";
  }
  if (environment.NODE_ENV !== "production")
    throw new Error("Cloud runtime requires production mode.");
  let url: URL;
  try {
    url = new URL(environment.FORGE_PUBLIC_ORIGIN ?? "");
  } catch {
    throw new Error("Cloud runtime requires a canonical HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== environment.FORGE_PUBLIC_ORIGIN ||
    !url.hostname.includes(".") ||
    !/^[a-z0-9.-]+$/i.test(url.hostname) ||
    /^[0-9.]+$/.test(url.hostname) ||
    url.hostname.endsWith(".localhost") ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Cloud runtime requires a canonical HTTPS origin.");
  return url.origin;
}
