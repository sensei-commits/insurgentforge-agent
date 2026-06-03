// TOOL: Gmail client — authenticate with OAuth, fetch filtered emails, mark as read.
// Uses google-auth-library + googleapis. First run opens browser for manual auth.
require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const CREDS_FILE = path.join(__dirname, "..", "gmail-credentials.json");
const TOKEN_FILE = path.join(__dirname, "..", ".gmail-token.json");

let oauth2Client;

/**
 * Load credentials and create OAuth2 client. First run prompts for browser auth.
 */
async function getAuthClient() {
  if (oauth2Client && oauth2Client.credentials?.access_token) return oauth2Client;

  if (!fs.existsSync(CREDS_FILE)) {
    throw new Error(
      `[gmail] Missing gmail-credentials.json. Download from Google Cloud Console and save as: ${CREDS_FILE}`
    );
  }

  const credentials = JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Load saved token if it exists
  if (fs.existsSync(TOKEN_FILE)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
    oauth2Client.setCredentials(token);
    return oauth2Client;
  }

  // First time: prompt for auth
  console.log("[gmail] First run — Gmail auth required.");
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.modify"],
  });

  console.log(`[gmail] Open this URL in your browser:\n${authUrl}`);
  console.log("[gmail] After authorizing, copy the code from the redirect URL.");
  console.log("[gmail] Then set GMAIL_AUTH_CODE=<code> in .env and restart.");

  throw new Error(
    "Gmail not authorized yet. Follow the instructions above, then restart the scheduler."
  );
}

/**
 * Handle OAuth callback (manual: user provides auth code via .env GMAIL_AUTH_CODE)
 */
async function completeAuth(authCode) {
  const { tokens } = await oauth2Client.getToken(authCode);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  console.log("[gmail] ✅ Authorized and token saved.");
  return oauth2Client;
}

/**
 * Fetch unread emails matching a query.
 * @param {string} q - Gmail search query (e.g., "is:unread from:noreply")
 * @param {number} maxResults - max emails to return
 * @returns { id, threadId, from, subject, snippet, payload.parts... }
 */
async function fetchEmails(q = "is:unread", maxResults = 10) {
  try {
    const client = await getAuthClient();
    const gmail = google.gmail({ version: "v1", auth: client });

    const { data } = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults,
    });

    if (!data.messages || data.messages.length === 0) return [];

    // Fetch full message details for each
    const messages = await Promise.all(
      data.messages.map(({ id }) =>
        gmail.users.messages.get({ userId: "me", id, format: "full" }).then((r) => r.data)
      )
    );

    return messages;
  } catch (err) {
    if (err.message.includes("Gmail not authorized")) {
      console.log("[gmail] Not authorized yet — skipping email check.");
      return [];
    }
    throw err;
  }
}

/**
 * Mark email as read.
 */
async function markAsRead(messageId) {
  const client = await getAuthClient();
  const gmail = google.gmail({ version: "v1", auth: client });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

module.exports = { getAuthClient, completeAuth, fetchEmails, markAsRead };
