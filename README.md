> [!IMPORTANT]
> **Archived — use Raindrop's official MCP server instead.**
>
> Raindrop now ships one of its own, and it works well: the coverage is there, and it
> does this job better than a third-party shim can. It speaks OAuth 2.1, so there is no
> token to create, store, or keep alive on every machine, and nothing is fetched or
> spawned locally.
>
> ```json
> {
>   "mcpServers": {
>     "raindrop": {
>       "type": "http",
>       "url": "https://api.raindrop.io/rest/v2/ai/mcp"
>     }
>   }
> }
> ```
>
> The [`raindrop-io` plugin](https://github.com/kud/claude-plugins/tree/main/plugins/raindrop-io)
> has already been repointed at it, and its `bookmark-search`, `bookmark-save` and
> `bookmark-organise` skills now run against the official tools. Installing that plugin
> is the easiest way to pick this up.
>
> Coverage is close to level: 22 tools there against 23 here, and only `parse_url` and
> `empty_trash` have no counterpart. Some of it is an upgrade — duplicate and broken-link
> detection needed a bespoke `library_audit` tool here, and are ordinary query filters there.
>
> Published versions stay on npm and keep working. Nothing is being unpublished.

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/mcp-raindrop-io?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**MCP server for Raindrop.io — bookmarks, collections, tags, highlights and more.**

<a href="https://kud.io/projects/mcp-raindrop-io">Website</a> · <a href="https://kud.io/projects/mcp-raindrop-io/docs">Documentation</a>

</div>

## Features

- **Bookmark management** — create, read, update, and delete individual bookmarks with titles, notes, tags, and excerpts.
- **Bulk operations** — move, tag, or delete multiple bookmarks in a single call.
- **Collection organisation** — list, create, update, and delete root and nested collections.
- **Tag control** — list, rename, merge, and delete tags across your entire library or scoped to a collection.
- **Highlights** — fetch, create, update, and delete inline highlights with colour and notes.
- **Library audit** — surface broken links, duplicates, and untagged bookmarks in one tool call.

## Install

```sh
npx --yes @kud/mcp-raindrop-io@latest
```

## Usage

Add the server to your MCP client config and pass a Raindrop.io API token via `MCP_RAINDROPIO_TOKEN`:

```json
{
  "mcpServers": {
    "raindrop-io": {
      "command": "npx",
      "args": ["--yes", "@kud/mcp-raindrop-io@latest"],
      "env": {
        "MCP_RAINDROPIO_TOKEN": "your-token-here"
      }
    }
  }
}
```

| Tool                    | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `search_raindrops`      | Search or list bookmarks with advanced filters                    |
| `get_raindrop`          | Get a single bookmark by ID                                       |
| `create_raindrop`       | Create a new bookmark                                             |
| `update_raindrop`       | Update an existing bookmark                                       |
| `delete_raindrop`       | Delete a bookmark (moves to trash)                                |
| `create_raindrops`      | Create multiple bookmarks in bulk                                 |
| `bulk_raindrops`        | Bulk update, move, or delete bookmarks in a collection            |
| `get_collections`       | List all root collections                                         |
| `get_child_collections` | List all child (nested) collections                               |
| `get_collection`        | Get a single collection by ID                                     |
| `create_collection`     | Create a new collection                                           |
| `update_collection`     | Update a collection                                               |
| `delete_collection`     | Delete a collection and all its bookmarks                         |
| `cleanup_collections`   | Remove all empty collections                                      |
| `get_tags`              | List all tags, optionally scoped to a collection                  |
| `manage_tags`           | Rename, merge, or delete tags                                     |
| `get_highlights`        | Get highlights — all, by collection, or by bookmark               |
| `manage_highlight`      | Create, update, or delete a highlight                             |
| `get_user`              | Get authenticated user info and stats                             |
| `parse_url`             | Extract metadata from any URL before saving                       |
| `check_urls_exist`      | Check if URLs are already saved as bookmarks                      |
| `library_audit`         | Scan library for broken links, duplicates, and untagged bookmarks |
| `empty_trash`           | Permanently delete all bookmarks in trash                         |

## Development

```sh
git clone https://github.com/kud/mcp-raindrop-io.git
cd mcp-raindrop-io
npm install
npm run dev
```

📚 **Full documentation → [mcp-raindrop-io/docs](https://kud.io/projects/mcp-raindrop-io/docs)**
