import { Google } from "arctic";
import { z } from "zod";

const identitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().email().max(320),
  email_verified: z.literal(true),
  name: z.string().max(200).optional(),
});
export type GoogleIdentity = z.infer<typeof identitySchema>;
export interface GoogleProvider {
  authorizationURL(state: string, verifier: string): string;
  identity(code: string, verifier: string): Promise<GoogleIdentity>;
}
export function createGoogleProvider(
  clientId: string,
  secret: string,
  callback: string,
): GoogleProvider {
  if (!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    throw new Error(
      "GOOGLE_CLIENT_ID must be the OAuth client ID ending in .apps.googleusercontent.com, not a client secret.",
    );
  }
  const provider = new Google(clientId, secret, callback);
  return {
    authorizationURL: (state, verifier) =>
      provider
        .createAuthorizationURL(state, verifier, ["openid", "profile", "email"])
        .toString(),
    async identity(code, verifier) {
      const tokens = await provider.validateAuthorizationCode(code, verifier);
      const response = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.accessToken()}` },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) throw new Error("Provider identity unavailable");
      return identitySchema.parse(await response.json());
    },
  };
}
