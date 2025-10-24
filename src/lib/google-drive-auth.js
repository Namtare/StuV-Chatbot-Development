import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Helper function to get authenticated Drive client
export function getDriveClient() {
  // Load client secrets
  const clientSecretPath = path.join(process.cwd(), "client_secret.json");
  const credentials = JSON.parse(fs.readFileSync(clientSecretPath, "utf8"));
  const { client_secret, client_id } = credentials.installed;

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3000/api/auth/callback"
  );

  // Load tokens
  const tokenPath = path.join(process.cwd(), "token.json");

  if (!fs.existsSync(tokenPath)) {
    throw new Error("No token found. Please authorize first by visiting /api/auth/authorize");
  }

  const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  oauth2Client.setCredentials(tokens);

  // Create Drive client
  return google.drive({ version: "v3", auth: oauth2Client });
}
