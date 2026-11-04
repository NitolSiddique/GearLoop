export type Category = {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CategoryInput = {
  name: string
  description: string | null
}

const BASE = "/api/v1/categories"

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: { detail?: string | { msg: string }[] } = await res.json()
    if (typeof body.detail === "string") return body.detail
    if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join(", ")
  } catch {
    // response had no JSON body
  }
  return `Request failed: ${res.status}`
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(await errorMessage(res))
  if (res.status === 204) return undefined as T
  return res.json()
}

const jsonOptions = (method: string, body: CategoryInput): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export const listCategories = () => request<Category[]>(BASE)
export const getCategory = (id: number) => request<Category>(`${BASE}/${id}`)
export const createCategory = (data: CategoryInput) =>
  request<Category>(BASE, jsonOptions("POST", data))
export const updateCategory = (id: number, data: CategoryInput) =>
  request<Category>(`${BASE}/${id}`, jsonOptions("PUT", data))
export const deleteCategory = (id: number) =>
  request<void>(`${BASE}/${id}`, { method: "DELETE" })
