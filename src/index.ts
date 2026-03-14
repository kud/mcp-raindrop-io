#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const RAINDROP_TOKEN = process.env.RAINDROP_TOKEN
if (!RAINDROP_TOKEN) {
  console.error("RAINDROP_TOKEN env var is required")
  process.exit(1)
}

const API_BASE = "https://api.raindrop.io/rest/v1"

async function raindropFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${RAINDROP_TOKEN}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
    if (!response.ok) {
      console.error(`Raindrop API error: ${response.status} ${path}`)
      return null
    }
    return (await response.json()) as T
  } catch (err) {
    console.error(`Raindrop fetch failed: ${path}`, err)
    return null
  }
}

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

const server = new McpServer({ name: "raindrop-io", version: "1.0.0" })

// ─── Raindrops ────────────────────────────────────────────────────────────────

server.registerTool(
  "search_raindrops",
  {
    description: "Search or list bookmarks with advanced filters",
    inputSchema: {
      collection_id: z
        .number()
        .default(0)
        .describe("Collection ID (0 = all, -1 = unsorted, -99 = trash)"),
      search: z.string().optional().describe("Full-text search query"),
      sort: z
        .enum([
          "score",
          "-created",
          "created",
          "-title",
          "title",
          "-domain",
          "domain",
        ])
        .optional(),
      page: z.number().default(0),
      per_page: z.number().default(25).describe("Max 50"),
      important: z.boolean().optional().describe("Only favorites"),
      broken: z.boolean().optional().describe("Only broken links"),
      duplicates: z.boolean().optional().describe("Only duplicates"),
      notag: z.boolean().optional().describe("Only untagged"),
      domain: z.string().optional().describe("Filter by domain"),
      media: z
        .enum(["link", "article", "image", "video", "document", "audio"])
        .optional(),
      created_start: z
        .string()
        .optional()
        .describe("ISO 8601 date, e.g. 2024-01-01"),
      created_end: z.string().optional().describe("ISO 8601 date"),
    },
  },
  async ({
    collection_id,
    search,
    sort,
    page,
    per_page,
    important,
    broken,
    duplicates,
    notag,
    domain,
    media,
    created_start,
    created_end,
  }) => {
    const searchParts: string[] = []
    if (search) searchParts.push(search)
    if (important) searchParts.push("important:true")
    if (broken) searchParts.push("broken:true")
    if (duplicates) searchParts.push("duplicate:true")
    if (notag) searchParts.push("notag:true")
    if (media) searchParts.push(`type:${media}`)
    if (created_start) searchParts.push(`created:>=${created_start}`)
    if (created_end) searchParts.push(`created:<=${created_end}`)

    const params = new URLSearchParams({
      page: String(page),
      perpage: String(per_page),
      ...(searchParts.length ? { search: searchParts.join(" ") } : {}),
      ...(sort ? { sort } : {}),
      ...(domain ? { domain } : {}),
    })

    const data = await raindropFetch<{ items: unknown[]; count: number }>(
      `/raindrops/${collection_id}?${params}`,
    )
    if (!data) return err("failed to fetch raindrops")
    return ok({ count: data.count, items: data.items })
  },
)

server.registerTool(
  "get_raindrop",
  {
    description: "Get a single bookmark by ID",
    inputSchema: { id: z.number() },
  },
  async ({ id }) => {
    const data = await raindropFetch<{ item: unknown }>(`/raindrop/${id}`)
    if (!data) return err(`raindrop ${id} not found`)
    return ok(data.item)
  },
)

server.registerTool(
  "create_raindrop",
  {
    description: "Create a new bookmark",
    inputSchema: {
      link: z.string().url(),
      title: z.string().optional(),
      excerpt: z.string().optional(),
      note: z.string().optional(),
      tags: z.array(z.string()).optional(),
      important: z.boolean().optional(),
      collection_id: z
        .number()
        .optional()
        .describe("Collection ID to save into"),
    },
  },
  async ({ link, title, excerpt, note, tags, important, collection_id }) => {
    const body: Record<string, unknown> = { link, pleaseParse: {} }
    if (title) body.title = title
    if (excerpt) body.excerpt = excerpt
    if (note) body.note = note
    if (tags) body.tags = tags
    if (important != null) body.important = important
    if (collection_id != null) body.collection = { $id: collection_id }

    const data = await raindropFetch<{ item: unknown }>("/raindrop", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!data) return err("failed to create raindrop")
    return ok(data.item)
  },
)

server.registerTool(
  "update_raindrop",
  {
    description: "Update an existing bookmark",
    inputSchema: {
      id: z.number(),
      title: z.string().optional(),
      excerpt: z.string().optional(),
      note: z.string().optional(),
      tags: z.array(z.string()).optional(),
      important: z.boolean().optional(),
      collection_id: z.number().optional().describe("Move to collection ID"),
    },
  },
  async ({ id, title, excerpt, note, tags, important, collection_id }) => {
    const body: Record<string, unknown> = {}
    if (title != null) body.title = title
    if (excerpt != null) body.excerpt = excerpt
    if (note != null) body.note = note
    if (tags != null) body.tags = tags
    if (important != null) body.important = important
    if (collection_id != null) body.collection = { $id: collection_id }

    const data = await raindropFetch<{ item: unknown }>(`/raindrop/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
    if (!data) return err(`failed to update raindrop ${id}`)
    return ok(data.item)
  },
)

server.registerTool(
  "delete_raindrop",
  {
    description: "Delete a bookmark (moves to trash)",
    inputSchema: { id: z.number() },
  },
  async ({ id }) => {
    const data = await raindropFetch<{ result: boolean }>(`/raindrop/${id}`, {
      method: "DELETE",
    })
    if (!data) return err(`failed to delete raindrop ${id}`)
    return ok({ deleted: data.result })
  },
)

server.registerTool(
  "bulk_raindrops",
  {
    description: "Bulk update, move, or delete bookmarks in a collection",
    inputSchema: {
      operation: z.enum(["update", "move", "delete"]),
      collection_id: z.number().describe("Source collection ID"),
      ids: z
        .array(z.number())
        .optional()
        .describe("Specific bookmark IDs (required for move/delete)"),
      to_collection_id: z
        .number()
        .optional()
        .describe("Target collection ID for move"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to set (update only)"),
      important: z
        .boolean()
        .optional()
        .describe("Mark/unmark as favorite (update only)"),
    },
  },
  async ({
    operation,
    collection_id,
    ids,
    to_collection_id,
    tags,
    important,
  }) => {
    if (operation === "delete") {
      if (!ids?.length) return err("ids required for delete")
      const data = await raindropFetch<{ result: boolean; modified: number }>(
        `/raindrops/${collection_id}`,
        {
          method: "DELETE",
          body: JSON.stringify({ ids }),
        },
      )
      if (!data) return err("bulk delete failed")
      return ok(data)
    }

    if (operation === "move") {
      if (!ids?.length) return err("ids required for move")
      if (to_collection_id == null)
        return err("to_collection_id required for move")
      const data = await raindropFetch<{ result: boolean; modified: number }>(
        `/raindrops/${collection_id}`,
        {
          method: "PUT",
          body: JSON.stringify({ ids, collection: { $id: to_collection_id } }),
        },
      )
      if (!data) return err("bulk move failed")
      return ok(data)
    }

    const body: Record<string, unknown> = {}
    if (ids?.length) body.ids = ids
    if (tags != null) body.tags = tags
    if (important != null) body.important = important

    const data = await raindropFetch<{ result: boolean; modified: number }>(
      `/raindrops/${collection_id}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    )
    if (!data) return err("bulk update failed")
    return ok(data)
  },
)

// ─── Collections ──────────────────────────────────────────────────────────────

server.registerTool(
  "get_collections",
  {
    description: "List all root collections",
    inputSchema: {},
  },
  async () => {
    const data = await raindropFetch<{ items: unknown[] }>("/collections")
    if (!data) return err("failed to fetch collections")
    return ok(data.items)
  },
)

server.registerTool(
  "get_child_collections",
  {
    description: "List all child (nested) collections",
    inputSchema: {},
  },
  async () => {
    const data = await raindropFetch<{ items: unknown[] }>(
      "/collections/childrens",
    )
    if (!data) return err("failed to fetch child collections")
    return ok(data.items)
  },
)

server.registerTool(
  "get_collection",
  {
    description: "Get a single collection by ID",
    inputSchema: { id: z.number() },
  },
  async ({ id }) => {
    const data = await raindropFetch<{ item: unknown }>(`/collection/${id}`)
    if (!data) return err(`collection ${id} not found`)
    return ok(data.item)
  },
)

server.registerTool(
  "create_collection",
  {
    description: "Create a new collection",
    inputSchema: {
      title: z.string(),
      public: z.boolean().optional(),
      parent_id: z
        .number()
        .optional()
        .describe("Parent collection ID for nesting"),
      view: z.enum(["list", "simple", "grid", "masonry"]).optional(),
    },
  },
  async ({ title, public: isPublic, parent_id, view }) => {
    const body: Record<string, unknown> = { title }
    if (isPublic != null) body.public = isPublic
    if (parent_id != null) body.parent = { $id: parent_id }
    if (view) body.view = view

    const data = await raindropFetch<{ item: unknown }>("/collection", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!data) return err("failed to create collection")
    return ok(data.item)
  },
)

server.registerTool(
  "update_collection",
  {
    description: "Update a collection",
    inputSchema: {
      id: z.number(),
      title: z.string().optional(),
      public: z.boolean().optional(),
      parent_id: z.number().optional(),
      view: z.enum(["list", "simple", "grid", "masonry"]).optional(),
    },
  },
  async ({ id, title, public: isPublic, parent_id, view }) => {
    const body: Record<string, unknown> = {}
    if (title != null) body.title = title
    if (isPublic != null) body.public = isPublic
    if (parent_id != null) body.parent = { $id: parent_id }
    if (view) body.view = view

    const data = await raindropFetch<{ item: unknown }>(`/collection/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
    if (!data) return err(`failed to update collection ${id}`)
    return ok(data.item)
  },
)

server.registerTool(
  "delete_collection",
  {
    description: "Delete a collection (and all its bookmarks)",
    inputSchema: { id: z.number() },
  },
  async ({ id }) => {
    const data = await raindropFetch<{ result: boolean }>(`/collection/${id}`, {
      method: "DELETE",
    })
    if (!data) return err(`failed to delete collection ${id}`)
    return ok({ deleted: data.result })
  },
)

server.registerTool(
  "cleanup_collections",
  {
    description: "Remove all empty collections. Pass confirm: true to execute.",
    inputSchema: {
      confirm: z.boolean().default(false),
    },
  },
  async ({ confirm }) => {
    if (!confirm)
      return ok({
        message: "Pass confirm: true to remove all empty collections.",
      })
    const data = await raindropFetch<{ result: boolean; count: number }>(
      "/collections/clean",
      { method: "PUT" },
    )
    if (!data) return err("failed to cleanup collections")
    return ok(data)
  },
)

// ─── Tags ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "get_tags",
  {
    description: "List all tags, optionally scoped to a collection",
    inputSchema: {
      collection_id: z.number().optional(),
    },
  },
  async ({ collection_id }) => {
    const path = collection_id != null ? `/tags/${collection_id}` : "/tags"
    const data = await raindropFetch<{ items: unknown[] }>(path)
    if (!data) return err("failed to fetch tags")
    return ok(data.items)
  },
)

server.registerTool(
  "manage_tags",
  {
    description: "Rename, merge, or delete tags",
    inputSchema: {
      operation: z.enum(["rename", "merge", "delete"]),
      tags: z.array(z.string()).describe("Tag names to rename/merge/delete"),
      new_name: z
        .string()
        .optional()
        .describe("New name (required for rename/merge)"),
      collection_id: z
        .number()
        .optional()
        .describe("Scope to a collection (omit for all)"),
    },
  },
  async ({ operation, tags, new_name, collection_id }) => {
    const path = collection_id != null ? `/tags/${collection_id}` : "/tags"

    if (operation === "delete") {
      const data = await raindropFetch<{ result: boolean }>(path, {
        method: "DELETE",
        body: JSON.stringify({ tags }),
      })
      if (!data) return err("failed to delete tags")
      return ok(data)
    }

    if (!new_name) return err("new_name required for rename/merge")

    const body =
      operation === "rename"
        ? { from: tags[0], to: new_name }
        : { tags, to: new_name }

    const data = await raindropFetch<{ result: boolean }>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    })
    if (!data) return err(`failed to ${operation} tags`)
    return ok(data)
  },
)

// ─── Highlights ───────────────────────────────────────────────────────────────

server.registerTool(
  "get_highlights",
  {
    description: "Get all highlights for a bookmark",
    inputSchema: { raindrop_id: z.number() },
  },
  async ({ raindrop_id }) => {
    const data = await raindropFetch<{ items: unknown[] }>(
      `/raindrop/${raindrop_id}/highlights`,
    )
    if (!data)
      return err(`failed to fetch highlights for raindrop ${raindrop_id}`)
    return ok(data.items)
  },
)

server.registerTool(
  "manage_highlight",
  {
    description: "Create, update, or delete a highlight",
    inputSchema: {
      operation: z.enum(["create", "update", "delete"]),
      raindrop_id: z.number().optional().describe("Required for create"),
      highlight_id: z
        .number()
        .optional()
        .describe("Required for update/delete"),
      text: z
        .string()
        .optional()
        .describe("Highlighted text (required for create)"),
      note: z.string().optional(),
      color: z
        .enum([
          "blue",
          "brown",
          "cyan",
          "gray",
          "green",
          "indigo",
          "orange",
          "pink",
          "purple",
          "red",
          "teal",
          "yellow",
        ])
        .optional(),
    },
  },
  async ({ operation, raindrop_id, highlight_id, text, note, color }) => {
    if (operation === "create") {
      if (!raindrop_id || !text)
        return err("raindrop_id and text required for create")
      const body: Record<string, unknown> = {
        text,
        color: color ?? "yellow",
        raindrop: { $id: raindrop_id },
      }
      if (note) body.note = note
      const data = await raindropFetch<{ item: unknown }>("/highlights", {
        method: "POST",
        body: JSON.stringify(body),
      })
      if (!data) return err("failed to create highlight")
      return ok(data.item)
    }

    if (!highlight_id) return err("highlight_id required for update/delete")

    if (operation === "delete") {
      const data = await raindropFetch<{ result: boolean }>(
        `/highlights/${highlight_id}`,
        { method: "DELETE" },
      )
      if (!data) return err(`failed to delete highlight ${highlight_id}`)
      return ok({ deleted: data.result })
    }

    const body: Record<string, unknown> = {}
    if (text != null) body.text = text
    if (note != null) body.note = note
    if (color != null) body.color = color

    const data = await raindropFetch<{ item: unknown }>(
      `/highlights/${highlight_id}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    )
    if (!data) return err(`failed to update highlight ${highlight_id}`)
    return ok(data.item)
  },
)

// ─── User ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "get_user",
  {
    description: "Get authenticated user info and stats",
    inputSchema: {},
  },
  async () => {
    const data = await raindropFetch<{ user: unknown }>("/user")
    if (!data) return err("failed to fetch user")
    return ok(data.user)
  },
)

// ─── Import / URL utils ───────────────────────────────────────────────────────

server.registerTool(
  "parse_url",
  {
    description:
      "Extract metadata (title, description, type) from any URL before saving",
    inputSchema: { url: z.string().url() },
  },
  async ({ url }) => {
    const data = await raindropFetch<{ item: unknown }>(
      `/import/url/parse?url=${encodeURIComponent(url)}`,
    )
    if (!data) return err("failed to parse URL")
    return ok(data.item)
  },
)

server.registerTool(
  "check_urls_exist",
  {
    description: "Check if URLs are already saved as bookmarks",
    inputSchema: { urls: z.array(z.string().url()) },
  },
  async ({ urls }) => {
    const data = await raindropFetch<{ result: boolean; ids: number[] }>(
      "/import/url/exists",
      {
        method: "POST",
        body: JSON.stringify({ urls }),
      },
    )
    if (!data) return err("failed to check URLs")
    return ok(data)
  },
)

// ─── Library utils ────────────────────────────────────────────────────────────

server.registerTool(
  "library_audit",
  {
    description:
      "Scan library for broken links, duplicates, and untagged bookmarks",
    inputSchema: {
      include_items: z
        .boolean()
        .default(false)
        .describe("Include the actual bookmark items in the result"),
    },
  },
  async ({ include_items }) => {
    const [broken, duplicates, untagged] = await Promise.all([
      raindropFetch<{ count: number; items: unknown[] }>(
        "/raindrops/0?search=broken:true&perpage=50",
      ),
      raindropFetch<{ count: number; items: unknown[] }>(
        "/raindrops/0?search=duplicate:true&perpage=50",
      ),
      raindropFetch<{ count: number; items: unknown[] }>(
        "/raindrops/0?search=notag:true&perpage=50",
      ),
    ])

    const result: Record<string, unknown> = {
      broken: broken?.count ?? "error",
      duplicates: duplicates?.count ?? "error",
      untagged: untagged?.count ?? "error",
    }

    if (include_items) {
      result.broken_items = broken?.items
      result.duplicate_items = duplicates?.items
      result.untagged_items = untagged?.items
    }

    return ok(result)
  },
)

server.registerTool(
  "empty_trash",
  {
    description:
      "Permanently delete all bookmarks in trash. Pass confirm: true to execute.",
    inputSchema: { confirm: z.boolean().default(false) },
  },
  async ({ confirm }) => {
    if (!confirm)
      return ok({
        message: "Pass confirm: true to permanently empty the trash.",
      })
    const data = await raindropFetch<{ result: boolean }>("/raindrops/-99", {
      method: "DELETE",
    })
    if (!data) return err("failed to empty trash")
    return ok(data)
  },
)

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-raindrop-io running")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
