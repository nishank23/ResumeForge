import { LinkedIn } from "arctic";

const clientId = process.env.LINKEDIN_CLIENT_ID || "MOCK_CLIENT_ID";
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || "MOCK_CLIENT_SECRET";
const redirectURI =
  process.env.LINKEDIN_REDIRECT_URI ||
  "http://localhost:3000/api/v1/auth/linkedin/callback";

export const linkedin = new LinkedIn(clientId, clientSecret, redirectURI);
