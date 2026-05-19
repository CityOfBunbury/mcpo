/**
 * MCP Tool definitions for BookStack.
 * Covers: Search, Read (shelves/books/chapters/pages), Create+Update, Attachments.
 */

export const TOOLS = [
  // ─── SEARCH ────────────────────────────────────────────────────────────────
  {
    name: 'bookstack_search',
    description: 'Search across all BookStack content (shelves, books, chapters, pages). Supports BookStack search syntax including phrases in quotes, field filters like {name:value}, tag filters like [tag:value], and type filters like {type:page}.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query using BookStack search syntax. Examples: "deployment guide", {name:api}, [tag:category:infrastructure], {type:page}',
        },
        count: { type: 'number', description: 'Number of results to return (default 20, max 100)', default: 20 },
        page: { type: 'number', description: 'Page number for pagination (default 1)', default: 1 },
      },
      required: ['query'],
    },
  },

  // ─── SHELVES ────────────────────────────────────────────────────────────────
  {
    name: 'bookstack_list_shelves',
    description: 'List all bookshelves in BookStack. Shelves are the top-level organisational containers that group books together.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of shelves to return (default 20, max 500)', default: 20 },
        offset: { type: 'number', description: 'Offset for pagination', default: 0 },
        sort: { type: 'string', description: 'Sort field. Prefix with - for descending. Options: name, created_at, updated_at', default: 'name' },
        filter_name: { type: 'string', description: 'Filter shelves by name (partial match)' },
      },
    },
  },
  {
    name: 'bookstack_get_shelf',
    description: 'Get full details of a single bookshelf including its list of books.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The shelf ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_create_shelf',
    description: 'Create a new bookshelf in BookStack.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the shelf' },
        description: { type: 'string', description: 'Plain text description of the shelf' },
        description_html: { type: 'string', description: 'HTML description of the shelf (use instead of description for rich text)' },
        books: { type: 'array', items: { type: 'number' }, description: 'Array of book IDs to add to this shelf' },
        tags: {
          type: 'array',
          description: 'Tags to apply to the shelf',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['name'],
          },
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'bookstack_update_shelf',
    description: 'Update an existing bookshelf. Only provided fields will be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The shelf ID to update' },
        name: { type: 'string' },
        description: { type: 'string' },
        description_html: { type: 'string' },
        books: { type: 'array', items: { type: 'number' }, description: 'Full list of book IDs for this shelf (replaces existing)' },
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name'] },
        },
      },
      required: ['id'],
    },
  },

  // ─── BOOKS ──────────────────────────────────────────────────────────────────
  {
    name: 'bookstack_list_books',
    description: 'List all books in BookStack. Books contain chapters and pages.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', default: 20 },
        offset: { type: 'number', default: 0 },
        sort: { type: 'string', default: 'name', description: 'Sort field. Prefix with - for descending. Options: name, created_at, updated_at' },
        filter_name: { type: 'string', description: 'Filter books by name' },
      },
    },
  },
  {
    name: 'bookstack_get_book',
    description: 'Get full details of a single book including its contents (chapters and pages structure).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The book ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_create_book',
    description: 'Create a new book in BookStack.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the book' },
        description: { type: 'string', description: 'Plain text description' },
        description_html: { type: 'string', description: 'HTML description' },
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name'] },
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'bookstack_update_book',
    description: 'Update an existing book.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The book ID' },
        name: { type: 'string' },
        description: { type: 'string' },
        description_html: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name'] },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_export_book',
    description: 'Export a book in a specific format (html, pdf, plaintext, markdown).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        format: { type: 'string', enum: ['html', 'pdf', 'plaintext', 'markdown'], default: 'markdown' },
      },
      required: ['id', 'format'],
    },
  },

  // ─── CHAPTERS ───────────────────────────────────────────────────────────────
  {
    name: 'bookstack_list_chapters',
    description: 'List chapters in BookStack. Chapters group pages within a book.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', default: 20 },
        offset: { type: 'number', default: 0 },
        sort: { type: 'string', default: 'name' },
        filter_book_id: { type: 'number', description: 'Filter chapters by book ID' },
      },
    },
  },
  {
    name: 'bookstack_get_chapter',
    description: 'Get full details of a single chapter including its pages.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The chapter ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_create_chapter',
    description: 'Create a new chapter inside a book.',
    inputSchema: {
      type: 'object',
      properties: {
        book_id: { type: 'number', description: 'The ID of the parent book' },
        name: { type: 'string', description: 'Name of the chapter' },
        description: { type: 'string' },
        description_html: { type: 'string' },
        priority: { type: 'number', description: 'Order priority within the book (lower = earlier)' },
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name'] },
        },
      },
      required: ['book_id', 'name'],
    },
  },
  {
    name: 'bookstack_update_chapter',
    description: 'Update an existing chapter.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        book_id: { type: 'number' },
        name: { type: 'string' },
        description: { type: 'string' },
        description_html: { type: 'string' },
        priority: { type: 'number' },
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name'] },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_export_chapter',
    description: 'Export a chapter in a specific format.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        format: { type: 'string', enum: ['html', 'pdf', 'plaintext', 'markdown'], default: 'markdown' },
      },
      required: ['id', 'format'],
    },
  },

  // ─── PAGES ──────────────────────────────────────────────────────────────────
  {
    name: 'bookstack_list_pages',
    description: 'List pages in BookStack.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', default: 20 },
        offset: { type: 'number', default: 0 },
        sort: { type: 'string', default: '-updated_at', description: 'Sort field. Prefix with - for descending. Options: name, created_at, updated_at, priority' },
        filter_book_id: { type: 'number', description: 'Filter pages by book ID' },
        filter_chapter_id: { type: 'number', description: 'Filter pages by chapter ID' },
        filter_name: { type: 'string', description: 'Filter pages by name' },
      },
    },
  },
  {
    name: 'bookstack_get_page',
    description: 'Get full details and content of a single page, including its HTML and markdown content.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The page ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_create_page',
    description: 'Create a new page in a book or chapter. Provide either book_id or chapter_id (not both). Provide content as either markdown or html.',
    inputSchema: {
      type: 'object',
      properties: {
        book_id: { type: 'number', description: 'Parent book ID (use this OR chapter_id)' },
        chapter_id: { type: 'number', description: 'Parent chapter ID (use this OR book_id)' },
        name: { type: 'string', description: 'Page title' },
        markdown: { type: 'string', description: 'Page content in Markdown format (preferred)' },
        html: { type: 'string', description: 'Page content in HTML format' },
        priority: { type: 'number', description: 'Order priority within parent' },
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name'] },
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'bookstack_update_page',
    description: 'Update an existing page. Only provided fields will be changed. To update content, provide markdown or html.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The page ID to update' },
        book_id: { type: 'number' },
        chapter_id: { type: 'number' },
        name: { type: 'string' },
        markdown: { type: 'string' },
        html: { type: 'string' },
        priority: { type: 'number' },
        tags: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name'] },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_export_page',
    description: 'Export a single page in a specific format.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        format: { type: 'string', enum: ['html', 'pdf', 'plaintext', 'markdown'], default: 'markdown' },
      },
      required: ['id', 'format'],
    },
  },

  // ─── ATTACHMENTS ────────────────────────────────────────────────────────────
  {
    name: 'bookstack_list_attachments',
    description: 'List file attachments in BookStack.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', default: 20 },
        offset: { type: 'number', default: 0 },
        filter_uploaded_to: { type: 'number', description: 'Filter attachments by page ID' },
      },
    },
  },
  {
    name: 'bookstack_get_attachment',
    description: 'Get details of a single attachment including its content (URL for link attachments, or base64 data for file attachments).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The attachment ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'bookstack_create_link_attachment',
    description: 'Create a new link-type attachment on a page (external URL, not a file upload).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name of the attachment' },
        uploaded_to: { type: 'number', description: 'ID of the page to attach this to' },
        link: { type: 'string', description: 'The external URL for this attachment' },
      },
      required: ['name', 'uploaded_to', 'link'],
    },
  },
  {
    name: 'bookstack_update_attachment',
    description: 'Update an existing attachment name or link (for link-type attachments).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'The attachment ID' },
        name: { type: 'string' },
        link: { type: 'string', description: 'New URL (for link attachments only)' },
        uploaded_to: { type: 'number', description: 'Move attachment to a different page ID' },
      },
      required: ['id'],
    },
  },
];
