/**
 * Tool Handlers
 * Each function receives the BookStackClient instance and tool input args,
 * and returns a plain object/string to be sent back as the MCP tool result.
 */

// Helper: strip undefined keys from an object before sending to API
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// Helper: format list response for readability
function formatList(data, label) {
  return {
    total: data.total,
    [label]: data.data,
  };
}

export async function handleTool(name, args, client) {
  switch (name) {

    // ── SEARCH ──────────────────────────────────────────────────────────────
    case 'bookstack_search': {
      const qs = client.buildQuery({ query: args.query, count: args.count ?? 20, page: args.page ?? 1 });
      const data = await client.get(`/search${qs}`);
      return {
        total: data.total,
        results: data.data.map(r => ({
          id: r.id,
          type: r.type,
          name: r.name,
          slug: r.slug,
          url: r.url,
          preview: r.preview_html?.content ?? '',
          book_id: r.book_id,
          chapter_id: r.chapter_id,
          book_name: r.book?.name,
          chapter_name: r.chapter?.name,
          tags: r.tags,
          updated_at: r.updated_at,
        })),
      };
    }

    // ── SHELVES ─────────────────────────────────────────────────────────────
    case 'bookstack_list_shelves': {
      const params = { count: args.count ?? 20, offset: args.offset ?? 0, sort: args.sort ?? 'name' };
      if (args.filter_name) params['filter[name]'] = args.filter_name;
      const qs = client.buildQuery(params);
      const data = await client.get(`/shelves${qs}`);
      return formatList(data, 'shelves');
    }

    case 'bookstack_get_shelf': {
      return client.get(`/shelves/${args.id}`);
    }

    case 'bookstack_create_shelf': {
      const body = clean({ name: args.name, description: args.description, description_html: args.description_html, books: args.books, tags: args.tags });
      return client.post('/shelves', body);
    }

    case 'bookstack_update_shelf': {
      const { id, ...rest } = args;
      const body = clean(rest);
      return client.put(`/shelves/${id}`, body);
    }

    // ── BOOKS ────────────────────────────────────────────────────────────────
    case 'bookstack_list_books': {
      const params = { count: args.count ?? 20, offset: args.offset ?? 0, sort: args.sort ?? 'name' };
      if (args.filter_name) params['filter[name]'] = args.filter_name;
      const qs = client.buildQuery(params);
      const data = await client.get(`/books${qs}`);
      return formatList(data, 'books');
    }

    case 'bookstack_get_book': {
      return client.get(`/books/${args.id}`);
    }

    case 'bookstack_create_book': {
      const body = clean({ name: args.name, description: args.description, description_html: args.description_html, tags: args.tags });
      return client.post('/books', body);
    }

    case 'bookstack_update_book': {
      const { id, ...rest } = args;
      return client.put(`/books/${id}`, clean(rest));
    }

    case 'bookstack_export_book': {
      const result = await client.get(`/books/${args.id}/export/${args.format}`);
      // Export endpoints return raw content; wrap it helpfully
      if (result.content !== undefined) return { format: args.format, content: result.content };
      return result;
    }

    // ── CHAPTERS ─────────────────────────────────────────────────────────────
    case 'bookstack_list_chapters': {
      const params = { count: args.count ?? 20, offset: args.offset ?? 0, sort: args.sort ?? 'name' };
      if (args.filter_book_id) params['filter[book_id]'] = args.filter_book_id;
      const qs = client.buildQuery(params);
      const data = await client.get(`/chapters${qs}`);
      return formatList(data, 'chapters');
    }

    case 'bookstack_get_chapter': {
      return client.get(`/chapters/${args.id}`);
    }

    case 'bookstack_create_chapter': {
      const body = clean({ book_id: args.book_id, name: args.name, description: args.description, description_html: args.description_html, priority: args.priority, tags: args.tags });
      return client.post('/chapters', body);
    }

    case 'bookstack_update_chapter': {
      const { id, ...rest } = args;
      return client.put(`/chapters/${id}`, clean(rest));
    }

    case 'bookstack_export_chapter': {
      const result = await client.get(`/chapters/${args.id}/export/${args.format}`);
      if (result.content !== undefined) return { format: args.format, content: result.content };
      return result;
    }

    // ── PAGES ────────────────────────────────────────────────────────────────
    case 'bookstack_list_pages': {
      const params = { count: args.count ?? 20, offset: args.offset ?? 0, sort: args.sort ?? '-updated_at' };
      if (args.filter_book_id) params['filter[book_id]'] = args.filter_book_id;
      if (args.filter_chapter_id) params['filter[chapter_id]'] = args.filter_chapter_id;
      if (args.filter_name) params['filter[name]'] = args.filter_name;
      const qs = client.buildQuery(params);
      const data = await client.get(`/pages${qs}`);
      return formatList(data, 'pages');
    }

    case 'bookstack_get_page': {
      return client.get(`/pages/${args.id}`);
    }

    case 'bookstack_create_page': {
      const body = clean({
        book_id: args.book_id,
        chapter_id: args.chapter_id,
        name: args.name,
        markdown: args.markdown,
        html: args.html,
        priority: args.priority,
        tags: args.tags,
      });
      if (!body.book_id && !body.chapter_id) {
        throw new Error('Either book_id or chapter_id must be provided when creating a page.');
      }
      return client.post('/pages', body);
    }

    case 'bookstack_update_page': {
      const { id, ...rest } = args;
      return client.put(`/pages/${id}`, clean(rest));
    }

    case 'bookstack_export_page': {
      const result = await client.get(`/pages/${args.id}/export/${args.format}`);
      if (result.content !== undefined) return { format: args.format, content: result.content };
      return result;
    }

    // ── ATTACHMENTS ──────────────────────────────────────────────────────────
    case 'bookstack_list_attachments': {
      const params = { count: args.count ?? 20, offset: args.offset ?? 0 };
      if (args.filter_uploaded_to) params['filter[uploaded_to]'] = args.filter_uploaded_to;
      const qs = client.buildQuery(params);
      const data = await client.get(`/attachments${qs}`);
      return formatList(data, 'attachments');
    }

    case 'bookstack_get_attachment': {
      return client.get(`/attachments/${args.id}`);
    }

    case 'bookstack_create_link_attachment': {
      const body = { name: args.name, uploaded_to: args.uploaded_to, link: args.link };
      return client.post('/attachments', body);
    }

    case 'bookstack_update_attachment': {
      const { id, ...rest } = args;
      return client.put(`/attachments/${id}`, clean(rest));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
