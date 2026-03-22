import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.hoisted(() => {
  process.env.MCP_RAINDROPIO_TOKEN = "test-token"
})

import {
  searchRaindrops,
  getRaindrop,
  createRaindrop,
  updateRaindrop,
  deleteRaindrop,
  createRaindrops,
  bulkRaindrops,
  getCollections,
  getChildCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  cleanupCollections,
  getTags,
  manageTags,
  getHighlights,
  manageHighlight,
  getUser,
  parseUrl,
  checkUrlsExist,
  libraryAudit,
  emptyTrash,
} from "../index.js"

const mockFetch = vi.fn()

beforeAll(() => {
  vi.stubGlobal("fetch", mockFetch)
})

beforeEach(() => {
  mockFetch.mockReset()
})

const res = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response)

const failRes = () =>
  Promise.resolve({
    ok: false,
    status: 500,
    json: () => Promise.resolve({}),
  } as Response)

const text = (result: { content: Array<{ text: string }> }) =>
  result.content[0].text

// ─── Raindrops ────────────────────────────────────────────────────────────────

describe("searchRaindrops", () => {
  it("returns count and items on success", async () => {
    mockFetch.mockReturnValue(
      res({ count: 2, items: [{ _id: 1 }, { _id: 2 }] }),
    )
    const result = await searchRaindrops({
      collection_id: 0,
      page: 0,
      per_page: 25,
    })
    expect(text(result)).toContain('"count": 2')
    expect(text(result)).toContain('"items"')
  })

  it("builds search query from filters", async () => {
    mockFetch.mockReturnValue(res({ count: 0, items: [] }))
    await searchRaindrops({
      collection_id: 0,
      page: 0,
      per_page: 10,
      important: true,
      broken: true,
      media: "article",
    })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("important%3Atrue")
    expect(url).toContain("broken%3Atrue")
    expect(url).toContain("type%3Aarticle")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await searchRaindrops({
      collection_id: 0,
      page: 0,
      per_page: 25,
    })
    expect(text(result)).toContain("Error:")
  })
})

describe("getRaindrop", () => {
  it("returns item on success", async () => {
    mockFetch.mockReturnValue(res({ item: { _id: 42, title: "Test" } }))
    const result = await getRaindrop({ id: 42 })
    expect(text(result)).toContain('"_id": 42')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getRaindrop({ id: 42 })
    expect(text(result)).toContain("Error:")
  })
})

describe("createRaindrop", () => {
  it("returns created item on success", async () => {
    mockFetch.mockReturnValue(
      res({ item: { _id: 1, link: "https://example.com" } }),
    )
    const result = await createRaindrop({
      link: "https://example.com",
      title: "Ex",
    })
    expect(text(result)).toContain('"link"')
    expect(mockFetch.mock.calls[0][1].method).toBe("POST")
  })

  it("sends optional fields when provided", async () => {
    mockFetch.mockReturnValue(res({ item: {} }))
    await createRaindrop({
      link: "https://example.com",
      tags: ["a", "b"],
      important: true,
      collection_id: 5,
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.tags).toEqual(["a", "b"])
    expect(body.important).toBe(true)
    expect(body.collection).toEqual({ $id: 5 })
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await createRaindrop({ link: "https://example.com" })
    expect(text(result)).toContain("Error:")
  })
})

describe("updateRaindrop", () => {
  it("returns updated item on success", async () => {
    mockFetch.mockReturnValue(res({ item: { _id: 1, title: "Updated" } }))
    const result = await updateRaindrop({ id: 1, title: "Updated" })
    expect(text(result)).toContain('"title": "Updated"')
    expect(mockFetch.mock.calls[0][1].method).toBe("PUT")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await updateRaindrop({ id: 1 })
    expect(text(result)).toContain("Error:")
  })
})

describe("deleteRaindrop", () => {
  it("returns deleted: true on success", async () => {
    mockFetch.mockReturnValue(res({ result: true }))
    const result = await deleteRaindrop({ id: 1 })
    expect(text(result)).toContain('"deleted": true')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await deleteRaindrop({ id: 1 })
    expect(text(result)).toContain("Error:")
  })
})

describe("createRaindrops", () => {
  it("returns created items on success", async () => {
    mockFetch.mockReturnValue(
      res({ result: true, items: [{ _id: 1 }, { _id: 2 }] }),
    )
    const result = await createRaindrops({
      items: [
        { link: "https://a.com" },
        { link: "https://b.com", tags: ["x"] },
      ],
    })
    expect(text(result)).toContain('"_id": 1')
    expect(mockFetch.mock.calls[0][1].method).toBe("POST")
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.items).toHaveLength(2)
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await createRaindrops({ items: [{ link: "https://a.com" }] })
    expect(text(result)).toContain("Error:")
  })
})

describe("bulkRaindrops", () => {
  it("deletes by ids", async () => {
    mockFetch.mockReturnValue(res({ result: true, modified: 2 }))
    const result = await bulkRaindrops({
      operation: "delete",
      collection_id: 0,
      ids: [1, 2],
    })
    expect(text(result)).toContain('"modified": 2')
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE")
  })

  it("returns error when delete has no ids", async () => {
    const result = await bulkRaindrops({
      operation: "delete",
      collection_id: 0,
    })
    expect(text(result)).toContain("Error: ids required for delete")
  })

  it("moves by ids to target collection", async () => {
    mockFetch.mockReturnValue(res({ result: true, modified: 1 }))
    const result = await bulkRaindrops({
      operation: "move",
      collection_id: 0,
      ids: [5],
      to_collection_id: 10,
    })
    expect(text(result)).toContain('"modified": 1')
  })

  it("returns error when move has no to_collection_id", async () => {
    const result = await bulkRaindrops({
      operation: "move",
      collection_id: 0,
      ids: [1],
    })
    expect(text(result)).toContain("Error: to_collection_id required for move")
  })

  it("updates with tags", async () => {
    mockFetch.mockReturnValue(res({ result: true, modified: 3 }))
    const result = await bulkRaindrops({
      operation: "update",
      collection_id: 0,
      tags: ["news"],
    })
    expect(text(result)).toContain('"modified": 3')
  })

  it("returns error on bulk fetch failure", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await bulkRaindrops({
      operation: "update",
      collection_id: 0,
    })
    expect(text(result)).toContain("Error:")
  })
})

// ─── Collections ──────────────────────────────────────────────────────────────

describe("getCollections", () => {
  it("returns items on success", async () => {
    mockFetch.mockReturnValue(res({ items: [{ _id: 1, title: "Work" }] }))
    const result = await getCollections()
    expect(text(result)).toContain('"title": "Work"')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getCollections()
    expect(text(result)).toContain("Error:")
  })
})

describe("getChildCollections", () => {
  it("returns items on success", async () => {
    mockFetch.mockReturnValue(res({ items: [{ _id: 2, title: "Sub" }] }))
    const result = await getChildCollections()
    expect(text(result)).toContain('"title": "Sub"')
    expect(mockFetch.mock.calls[0][0]).toContain("/collections/childrens")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getChildCollections()
    expect(text(result)).toContain("Error:")
  })
})

describe("getCollection", () => {
  it("returns item on success", async () => {
    mockFetch.mockReturnValue(res({ item: { _id: 3, title: "Test" } }))
    const result = await getCollection({ id: 3 })
    expect(text(result)).toContain('"_id": 3')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getCollection({ id: 3 })
    expect(text(result)).toContain("Error:")
  })
})

describe("createCollection", () => {
  it("returns created collection on success", async () => {
    mockFetch.mockReturnValue(res({ item: { _id: 10, title: "New" } }))
    const result = await createCollection({ title: "New" })
    expect(text(result)).toContain('"title": "New"')
    expect(mockFetch.mock.calls[0][1].method).toBe("POST")
  })

  it("sends parent_id when provided", async () => {
    mockFetch.mockReturnValue(res({ item: {} }))
    await createCollection({ title: "Child", parent_id: 5 })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.parent).toEqual({ $id: 5 })
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await createCollection({ title: "New" })
    expect(text(result)).toContain("Error:")
  })
})

describe("updateCollection", () => {
  it("returns updated collection on success", async () => {
    mockFetch.mockReturnValue(res({ item: { _id: 1, title: "Renamed" } }))
    const result = await updateCollection({ id: 1, title: "Renamed" })
    expect(text(result)).toContain('"title": "Renamed"')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await updateCollection({ id: 1 })
    expect(text(result)).toContain("Error:")
  })
})

describe("deleteCollection", () => {
  it("returns deleted: true on success", async () => {
    mockFetch.mockReturnValue(res({ result: true }))
    const result = await deleteCollection({ id: 1 })
    expect(text(result)).toContain('"deleted": true')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await deleteCollection({ id: 1 })
    expect(text(result)).toContain("Error:")
  })
})

describe("cleanupCollections", () => {
  it("returns guard message when confirm is false", async () => {
    const result = await cleanupCollections({ confirm: false })
    expect(text(result)).toContain("confirm: true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("removes empty collections when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: true, count: 3 }))
    const result = await cleanupCollections({ confirm: true })
    expect(text(result)).toContain('"count": 3')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await cleanupCollections({ confirm: true })
    expect(text(result)).toContain("Error:")
  })
})

// ─── Tags ─────────────────────────────────────────────────────────────────────

describe("getTags", () => {
  it("fetches all tags when no collection_id", async () => {
    mockFetch.mockReturnValue(res({ items: [{ tag: "news" }] }))
    const result = await getTags({})
    expect(mockFetch.mock.calls[0][0]).toContain("/tags")
    expect(text(result)).toContain('"tag": "news"')
  })

  it("scopes to collection when collection_id provided", async () => {
    mockFetch.mockReturnValue(res({ items: [] }))
    await getTags({ collection_id: 7 })
    expect(mockFetch.mock.calls[0][0]).toContain("/tags/7")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getTags({})
    expect(text(result)).toContain("Error:")
  })
})

describe("manageTags", () => {
  it("deletes tags", async () => {
    mockFetch.mockReturnValue(res({ result: true }))
    const result = await manageTags({ operation: "delete", tags: ["old"] })
    expect(text(result)).toContain('"result": true')
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE")
  })

  it("renames a tag", async () => {
    mockFetch.mockReturnValue(res({ result: true }))
    const result = await manageTags({
      operation: "rename",
      tags: ["old"],
      new_name: "new",
    })
    expect(text(result)).toContain('"result": true')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.from).toBe("old")
    expect(body.to).toBe("new")
  })

  it("merges tags", async () => {
    mockFetch.mockReturnValue(res({ result: true }))
    await manageTags({ operation: "merge", tags: ["a", "b"], new_name: "c" })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.tags).toEqual(["a", "b"])
    expect(body.to).toBe("c")
  })

  it("returns error when rename missing new_name", async () => {
    const result = await manageTags({ operation: "rename", tags: ["x"] })
    expect(text(result)).toContain("Error: new_name required for rename/merge")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await manageTags({ operation: "delete", tags: ["x"] })
    expect(text(result)).toContain("Error:")
  })
})

// ─── Highlights ───────────────────────────────────────────────────────────────

describe("getHighlights", () => {
  it("fetches all highlights when no args", async () => {
    mockFetch.mockReturnValue(res({ items: [{ _id: "h1" }] }))
    const result = await getHighlights({})
    expect(mockFetch.mock.calls[0][0]).toContain("/highlights")
    expect(mockFetch.mock.calls[0][0]).not.toContain("/raindrop")
    expect(text(result)).toContain('"_id": "h1"')
  })

  it("fetches by collection_id", async () => {
    mockFetch.mockReturnValue(res({ items: [] }))
    await getHighlights({ collection_id: 5 })
    expect(mockFetch.mock.calls[0][0]).toContain("/highlights/5")
  })

  it("fetches by raindrop_id", async () => {
    mockFetch.mockReturnValue(res({ items: [] }))
    await getHighlights({ raindrop_id: 99 })
    expect(mockFetch.mock.calls[0][0]).toContain("/raindrop/99/highlights")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getHighlights({})
    expect(text(result)).toContain("Error:")
  })
})

describe("manageHighlight", () => {
  it("creates a highlight", async () => {
    mockFetch.mockReturnValue(res({ item: { _id: "h1", text: "hello" } }))
    const result = await manageHighlight({
      operation: "create",
      raindrop_id: 42,
      text: "hello",
    })
    expect(text(result)).toContain('"text": "hello"')
    expect(mockFetch.mock.calls[0][1].method).toBe("POST")
  })

  it("returns error when create missing raindrop_id", async () => {
    const result = await manageHighlight({ operation: "create", text: "hi" })
    expect(text(result)).toContain("Error: raindrop_id and text required")
  })

  it("deletes a highlight", async () => {
    mockFetch.mockReturnValue(res({ result: true }))
    const result = await manageHighlight({
      operation: "delete",
      highlight_id: 10,
    })
    expect(text(result)).toContain('"deleted": true')
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE")
  })

  it("updates a highlight", async () => {
    mockFetch.mockReturnValue(res({ item: { _id: "h1", text: "updated" } }))
    const result = await manageHighlight({
      operation: "update",
      highlight_id: 10,
      text: "updated",
    })
    expect(text(result)).toContain('"text": "updated"')
  })

  it("returns error when update/delete missing highlight_id", async () => {
    const result = await manageHighlight({ operation: "delete" })
    expect(text(result)).toContain("Error: highlight_id required")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await manageHighlight({
      operation: "delete",
      highlight_id: 1,
    })
    expect(text(result)).toContain("Error:")
  })
})

// ─── User ─────────────────────────────────────────────────────────────────────

describe("getUser", () => {
  it("returns user on success", async () => {
    mockFetch.mockReturnValue(res({ user: { _id: "u1", email: "a@b.com" } }))
    const result = await getUser()
    expect(text(result)).toContain('"email": "a@b.com"')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getUser()
    expect(text(result)).toContain("Error:")
  })
})

// ─── Import / URL utils ───────────────────────────────────────────────────────

describe("parseUrl", () => {
  it("returns parsed item on success", async () => {
    mockFetch.mockReturnValue(res({ item: { title: "Example", type: "link" } }))
    const result = await parseUrl({ url: "https://example.com" })
    expect(text(result)).toContain('"title": "Example"')
    expect(mockFetch.mock.calls[0][0]).toContain(
      encodeURIComponent("https://example.com"),
    )
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await parseUrl({ url: "https://example.com" })
    expect(text(result)).toContain("Error:")
  })
})

describe("checkUrlsExist", () => {
  it("returns result and ids on success", async () => {
    mockFetch.mockReturnValue(res({ result: true, ids: [1, 2] }))
    const result = await checkUrlsExist({
      urls: ["https://a.com", "https://b.com"],
    })
    expect(text(result)).toContain('"result": true')
    expect(text(result)).toContain('"ids"')
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await checkUrlsExist({ urls: ["https://a.com"] })
    expect(text(result)).toContain("Error:")
  })
})

// ─── Library utils ────────────────────────────────────────────────────────────

describe("libraryAudit", () => {
  it("returns counts without items", async () => {
    mockFetch
      .mockReturnValueOnce(res({ count: 3, items: [{ _id: 1 }] }))
      .mockReturnValueOnce(res({ count: 1, items: [{ _id: 2 }] }))
      .mockReturnValueOnce(res({ count: 10, items: [{ _id: 3 }] }))
    const result = await libraryAudit({ include_items: false })
    expect(text(result)).toContain('"broken": 3')
    expect(text(result)).toContain('"duplicates": 1')
    expect(text(result)).toContain('"untagged": 10')
    expect(text(result)).not.toContain('"broken_items"')
  })

  it("includes items when include_items is true", async () => {
    mockFetch
      .mockReturnValueOnce(res({ count: 1, items: [{ _id: 1 }] }))
      .mockReturnValueOnce(res({ count: 0, items: [] }))
      .mockReturnValueOnce(res({ count: 0, items: [] }))
    const result = await libraryAudit({ include_items: true })
    expect(text(result)).toContain('"broken_items"')
    expect(text(result)).toContain('"duplicate_items"')
    expect(text(result)).toContain('"untagged_items"')
  })

  it("shows error string for failed sub-fetches", async () => {
    mockFetch
      .mockReturnValueOnce(failRes())
      .mockReturnValueOnce(res({ count: 0, items: [] }))
      .mockReturnValueOnce(res({ count: 0, items: [] }))
    const result = await libraryAudit({ include_items: false })
    expect(text(result)).toContain('"broken": "error"')
  })
})

describe("emptyTrash", () => {
  it("returns guard message when confirm is false", async () => {
    const result = await emptyTrash({ confirm: false })
    expect(text(result)).toContain("confirm: true")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("empties trash when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: true }))
    const result = await emptyTrash({ confirm: true })
    expect(text(result)).toContain('"result": true')
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await emptyTrash({ confirm: true })
    expect(text(result)).toContain("Error:")
  })
})
