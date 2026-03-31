# tp-extractor

An MCP tool server that extracts campaign and applicant data from TalentPropeller using
Playwright + Chromium. It runs as a standalone Docker service and connects to MCPO via SSE.

## Tools

| Tool | Description |
|------|-------------|
| `test_connection` | Verifies Playwright can reach talentpropeller.com and reports which auth method was used |
| `list_campaigns` | Lists all active campaigns with job number, title, branch, dates, and applicant count |
| `extract_campaign_applicants` | Extracts applicant details for a campaign; strips PII from the returned data |

## Setup

### 1. Add the tp-extractor entry to config.json on the server

The MCPO config file (`/app/config/config.json` inside the mcpo container) needs this entry
added alongside the existing `time` and `mcp-server-chart` entries:

```json
"tp-extractor": {
  "type": "sse",
  "url": "http://tp-extractor:8001/sse"
}
```

Do **not** commit this file — it lives only on the server and may contain secrets.

### 2. Configure authentication

Add credentials to your `.env` file (same directory as `docker-compose.yaml`).

#### Preferred: email/password login

The server logs in via the TalentPropeller login form on every tool call. No cookie
management required.

```
TP_EMAIL=you@example.com
TP_PASSWORD=yourpassword
```

#### Fallback: session cookie

If email/password are not set, or if the login attempt fails, the server falls back to
using a PHPSESSID cookie.

```
TP_SESSION_COOKIE=your_phpsessid_value_here
```

Or provide a full multi-cookie string if needed:

```
TP_SESSION_COOKIE=PHPSESSID=abc123; other_cookie=value
```

**Getting a PHPSESSID:**
1. Log in to [talentpropeller.com](https://talentpropeller.com) in your browser.
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `talentpropeller.com`.
3. Copy the value of `PHPSESSID`.
4. Paste it into your `.env` file.

> **Note:** Session cookies expire periodically. If tools start returning auth errors,
> run `test_connection` to confirm, then refresh the cookie by repeating the steps above.
> Using email/password login avoids this maintenance entirely.

You can set both — the server always tries email/password first and only falls back to
the cookie if login fails.

### 3. Build and start

```bash
docker compose up -d --build tp-extractor
```

Then restart mcpo so it picks up the updated config:

```bash
docker compose restart mcpo
```

## Usage examples

Once connected via MCPO, you can use natural language with any OpenAI-compatible client:

- "Test the TalentPropeller connection"
- "List all campaigns"
- "Extract applicants from the Senior Developer campaign"
- "Get applicants for job number 1234"
- "Show me applicants from https://talentpropeller.com/customerapplications/reviewcampaign/id/5/booking_id/7"

## Notes

- Applicant data returned by `extract_campaign_applicants` has PII automatically stripped
  (names, email, phone, address, etc. are removed from the detailed JSON). The summary table
  still shows candidate names for cross-reference.
- Each applicant is assigned an anonymised ID (`C001`, `C002`, …) in the output.
- All tool responses include an `auth:` note indicating whether login or cookie was used,
  which helps diagnose auth issues.
- Playwright runs headless Chromium inside the container — the image is larger than typical
  Python services (~1 GB) due to Chromium and its dependencies.
