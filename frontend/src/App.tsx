import { type FormEvent, useEffect, useState } from "react"
import {
  type Category,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "./api"

const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong"

export default function App() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<Category | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => setError(messageOf(err)))
      .finally(() => setLoading(false))
  }, [])

  async function refresh() {
    setCategories(await listCategories())
  }

  function resetForm() {
    setEditingId(null)
    setName("")
    setDescription("")
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    const payload = { name, description: description.trim() || null }
    try {
      if (editingId === null) {
        await createCategory(payload)
      } else {
        const updated = await updateCategory(editingId, payload)
        if (selected?.id === updated.id) setSelected(updated)
      }
      resetForm()
      await refresh()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  async function handleView(id: number) {
    setError("")
    try {
      setSelected(await getCategory(id))
    } catch (err) {
      setError(messageOf(err))
    }
  }

  function handleEdit(category: Category) {
    setError("")
    setEditingId(category.id)
    setName(category.name)
    setDescription(category.description ?? "")
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete "${category.name}"?`)) return
    setError("")
    try {
      await deleteCategory(category.id)
      if (selected?.id === category.id) setSelected(null)
      if (editingId === category.id) resetForm()
      await refresh()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
      <h1>GearLoop categories</h1>

      <section>
        <h2>{editingId === null ? "Add category" : "Edit category"}</h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (1–100 characters)"
            maxLength={100}
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional, up to 1000 characters)"
            maxLength={1000}
            rows={3}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit">
              {editingId === null ? "Add category" : "Save changes"}
            </button>
            {editingId !== null && (
              <button type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section>
        <h2>All categories</h2>
        {loading ? (
          <p>Loading…</p>
        ) : categories.length === 0 ? (
          <p>No categories yet. Add the first one above.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {categories.map((c) => (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #8884",
                }}
              >
                <span>{c.name}</span>
                <span style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => handleView(c.id)}>View</button>
                  <button onClick={() => handleEdit(c)}>Edit</button>
                  <button onClick={() => handleDelete(c)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section>
          <h2>Category details</h2>
          <p>
            <strong>{selected.name}</strong>
          </p>
          <p>{selected.description ?? "No description."}</p>
          <p>
            Created {new Date(selected.created_at).toLocaleString()} · Updated{" "}
            {new Date(selected.updated_at).toLocaleString()}
          </p>
          <button onClick={() => setSelected(null)}>Close</button>
        </section>
      )}
    </main>
  )
}
