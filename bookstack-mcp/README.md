# BookStack MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that connects Claude (and other MCP clients) to your BookStack documentation platform.

## Features

| Category | Tools |
|---|---|
| 🔍 Search | Full-text search across all content types with BookStack query syntax |
| 📚 Shelves | List, get, create, update |
| 📖 Books | List, get, create, update, export (HTML/PDF/Markdown/plaintext) |
| 📑 Chapters | List, get, create, update, export |
| 📄 Pages | List, get, create, update, export |
| 📎 Attachments | List, get, create link attachments, update |

## Requirements

- Node.js 18+
- A BookStack instance with API access enabled
- A BookStack API token (Token ID + Token Secret)

## Setup

### 1. Get a BookStack API Token

1. Log in to BookStack as a user with **"Access System API"** permission
2. Go to your user profile → **API Tokens**
3. Create a new token — copy both the **Token ID** and **Token Secret** (secret is shown only once)

### 2. Install Dependencies

```bash
cd bookstack-mcp
npm install
```

### 3. Configure Claude Desktop

Add the server to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bookstack": {
      "command": "node",
      "args": ["/absolute/path/to/bookstack-mcp/src/index.js"],
      "env": {
        "BOOKSTACK_BASE_URL": "https://docs.yourorg.com",
        "BOOKSTACK_TOKEN_ID": "your-token-id-here",
        "BOOKSTACK_TOKEN_SECRET": "your-token-secret-here"
      }
    }
  }
}
```

Replace the values:
- `BOOKSTACK_BASE_URL` — root URL of your BookStack instance (no trailing slash, no `/api`)
- `BOOKSTACK_TOKEN_ID` — the Token ID from step 1
- `BOOKSTACK_TOKEN_SECRET` — the Token Secret from step 1

Restart Claude Desktop after saving.

### 4. Verify

Ask Claude: *"List the books in BookStack"* — if the server is connected you'll see results.

---

## Available Tools

### Search
- **`bookstack_search`** — Search across all content. Supports BookStack query syntax:
  - Plain terms: `deployment guide`
  - Phrase: `"exact phrase"`
  - Field filter: `{name:api guide}`
  - Tag filter: `[tag:category:infrastructure]`
  - Type filter: `{type:page}`

### Shelves
- **`bookstack_list_shelves`** — List all shelves (filterable, sortable)
- **`bookstack_get_shelf`** — Get shelf details including contained books
- **`bookstack_create_shelf`** — Create a new shelf
- **`bookstack_update_shelf`** — Update shelf name, description, or book list

### Books
- **`bookstack_list_books`** — List all books
- **`bookstack_get_book`** — Get book details including full chapter/page tree
- **`bookstack_create_book`** — Create a new book
- **`bookstack_update_book`** — Update a book
- **`bookstack_export_book`** — Export a book as markdown, html, pdf, or plaintext

### Chapters
- **`bookstack_list_chapters`** — List chapters (filter by book\_id)
- **`bookstack_get_chapter`** — Get chapter details including pages
- **`bookstack_create_chapter`** — Create a chapter inside a book
- **`bookstack_update_chapter`** — Update a chapter
- **`bookstack_export_chapter`** — Export a chapter

### Pages
- **`bookstack_list_pages`** — List pages (filter by book\_id or chapter\_id)
- **`bookstack_get_page`** — Get page content (HTML + Markdown)
- **`bookstack_create_page`** — Create a page in a book or chapter (markdown preferred)
- **`bookstack_update_page`** — Update page content or metadata
- **`bookstack_export_page`** — Export a page

### Attachments
- **`bookstack_list_attachments`** — List attachments (filter by page ID)
- **`bookstack_get_attachment`** — Get attachment details
- **`bookstack_create_link_attachment`** — Attach an external URL link to a page
- **`bookstack_update_attachment`** — Update attachment name or link

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOOKSTACK_BASE_URL` | ✅ | Root URL of your BookStack instance |
| `BOOKSTACK_TOKEN_ID` | ✅ | API Token ID |
| `BOOKSTACK_TOKEN_SECRET` | ✅ | API Token Secret |

---

## Project Structure

```
bookstack-mcp/
├── src/
│   ├── index.js            # MCP server entry point (stdio transport)
│   ├── bookstack-client.js # HTTP client for BookStack REST API
│   ├── tools.js            # MCP tool definitions (schemas)
│   └── handlers.js         # Tool handler implementations
├── package.json
└── README.md
```

## Notes

- The server uses **stdio transport** — Claude Desktop spawns it as a subprocess
- API permissions are determined by the BookStack user whose token you use
- File uploads (binary attachments) are not currently supported — link attachments are
- Export endpoints return the raw content as a string in the `content` field
