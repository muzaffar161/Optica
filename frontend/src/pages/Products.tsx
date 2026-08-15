import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import SearchBox from '../components/SearchBox'
import Highlight from '../components/Highlight'
import Select from '../components/Select'
import FilePick from '../components/FilePick'
import { type Category, type Page, type Product } from '../types'
import { useAuth } from '../AuthContext'
import { canAll, canEdit } from '../access'

const PAGE_SIZE = 50

export default function Products() {
  const toast = useToast()
  const { user } = useAuth()
  const writable = canEdit(user, 'products')
  const removable = canAll(user, 'products')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState(0)
  const [allCount, setAllCount] = useState(0)
  const [uncatCount, setUncatCount] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [opened, setOpened] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [name, setName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [pending, setPending] = useState(false)
  const [categoryModal, setCategoryModal] = useState<'create' | Category | null>(null)
  const [categoryName, setCategoryName] = useState('')

  const current =
    opened && opened !== 'none' ? categories.find((c) => c.id === opened) : null
  const title =
    opened === null
      ? 'Товары'
      : opened === ''
        ? 'Все товары'
        : opened === 'none'
          ? 'Без категории'
          : current?.name || 'Товары'

  async function loadCategories() {
    const data = await api<Category[]>('/categories')
    setCategories(data)
  }

  async function loadCounts() {
    const [all, none] = await Promise.all([
      api<Page<Product>>('/products?page=1&pageSize=1'),
      api<Page<Product>>('/products?page=1&pageSize=1&categoryId=none'),
    ])
    setAllCount(all.total)
    setUncatCount(none.total)
  }

  async function load(query = q, nextPage = page, cat = opened) {
    if (cat === null) return
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (cat) params.set('categoryId', cat)
    params.set('page', String(nextPage))
    params.set('pageSize', String(PAGE_SIZE))
    const data = await api<Page<Product>>(`/products?${params}`)
    setProducts(data.items)
    setTotal(data.total)
    setPage(data.page)
  }

  useEffect(() => {
    loadCategories().catch((err: Error) => toast(err.message, 'err'))
    loadCounts().catch(() => {})
  }, [])

  useEffect(() => {
    if (opened === null) return
    const timer = window.setTimeout(() => {
      load(q, 1, opened).catch((err: Error) => toast(err.message, 'err'))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [q, opened])

  function resetForm() {
    setName('')
    setFormCategoryId(opened && opened !== 'none' ? opened : '')
    setPhoto(null)
    setPreview(null)
    setRemovePhoto(false)
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setOpen(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setName(product.name)
    setFormCategoryId(product.categoryId ?? '')
    setPhoto(null)
    setPreview(product.photoPath)
    setRemovePhoto(false)
    setOpen(true)
  }

  function onPickFile(file: File | null) {
    setPhoto(file)
    setRemovePhoto(false)
    if (file) setPreview(URL.createObjectURL(file))
    else setPreview(editing?.photoPath ?? null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const body = new FormData()
      body.set('name', name.trim())
      body.set('categoryId', formCategoryId || 'none')
      if (photo) body.set('photo', photo)
      if (editing && removePhoto && !photo) body.set('removePhoto', '1')
      if (editing) {
        await api<Product>(`/products/${editing.id}`, { method: 'PATCH', body })
        toast('Товар обновлён')
      } else {
        await api<Product>('/products', { method: 'POST', body })
        toast('Товар добавлен')
      }
      setOpen(false)
      resetForm()
      await Promise.all([load(q, editing ? page : 1), loadCategories(), loadCounts()])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Удалить «${product.name}»? В старых заказах название останется.`)) {
      return
    }
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' })
      toast('Товар удалён')
      await Promise.all([load(q, page), loadCounts(), loadCategories()])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function saveCategory(e: FormEvent) {
    e.preventDefault()
    const titleText = categoryName.trim()
    if (!titleText) return
    try {
      if (categoryModal === 'create') {
        const created = await api<Category>('/categories', {
          method: 'POST',
          body: JSON.stringify({ name: titleText }),
        })
        setCategories((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        )
        setCategoryModal(null)
        setCategoryName('')
        setOpened(created.id)
        setFormCategoryId(created.id)
        toast('Категория добавлена')
      } else if (categoryModal && categoryModal !== 'create') {
        const updated = await api<Category>(`/categories/${categoryModal.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: titleText }),
        })
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, name: updated.name } : c)),
        )
        setCategoryModal(null)
        setCategoryName('')
        toast('Категория обновлена')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Удалить «${category.name}»? Товары останутся без категории.`)) {
      return
    }
    try {
      await api(`/categories/${category.id}`, { method: 'DELETE' })
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
      setOpened(null)
      toast('Категория удалена')
      await loadCounts()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  function CategoryCard({
    title: cardTitle,
    count,
    onClick,
    dashed,
  }: {
    title: string
    count?: number
    onClick: () => void
    dashed?: boolean
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex aspect-4/3 flex-col items-start justify-between rounded-2xl border p-4 text-left ${
          dashed
            ? 'border-dashed border-line bg-paper text-muted'
            : 'border-line bg-card hover:border-brass'
        }`}
      >
        <span className="font-display text-xl leading-tight">{cardTitle}</span>
        {typeof count === 'number' && (
          <span className="text-sm text-muted">{count} тов.</span>
        )}
      </button>
    )
  }

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {opened !== null && (
            <button
              type="button"
              onClick={() => {
                setOpened(null)
                setQ('')
              }}
              className="mb-2 text-sm text-muted hover:text-ink"
            >
              ← Категории
            </button>
          )}
          <h1 className="font-display text-3xl">{title}</h1>
        </div>
        {writable && (
          <button
            type="button"
            onClick={opened === null ? () => {
              setCategoryName('')
              setCategoryModal('create')
            } : openCreate}
            className="hidden rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-soft md:inline-flex"
          >
            {opened === null ? 'Новая категория' : 'Новый товар'}
          </button>
        )}
      </div>

      {opened === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <CategoryCard
              key={c.id}
              title={c.name}
              count={c._count?.products ?? 0}
              onClick={() => setOpened(c.id)}
            />
          ))}
          <CategoryCard
            title="Без категории"
            count={uncatCount}
            onClick={() => setOpened('none')}
          />
          <CategoryCard title="Все товары" count={allCount} onClick={() => setOpened('')} />
          {writable && (
            <CategoryCard
              title="+ Категория"
              dashed
              onClick={() => {
                setCategoryName('')
                setCategoryModal('create')
              }}
            />
          )}
        </div>
      ) : (
        <>
          {current && (writable || removable) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {writable && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryName(current.name)
                    setCategoryModal(current)
                  }}
                  className="rounded-xl border border-line bg-card px-3 py-2 text-sm hover:bg-paper"
                >
                  Переименовать
                </button>
              )}
              {removable && (
                <button
                  type="button"
                  onClick={() => removeCategory(current)}
                  className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Удалить
                </button>
              )}
            </div>
          )}
          <SearchBox
            value={q}
            onChange={setQ}
            onSubmit={() => load(q, 1).catch((err: Error) => toast(err.message, 'err'))}
            placeholder="Название товара"
            className="mb-4"
          />
          {products.length === 0 ? (
            <div className="rounded-2xl border border-line bg-card px-4 py-16 text-center text-muted">
              {q.trim() ? 'Ничего не найдено.' : 'В этой категории пока пусто.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-line bg-card"
                >
                  <div className="aspect-square bg-paper">
                    {product.photoPath ? (
                      <img
                        src={product.photoPath}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
                        без фото
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium leading-snug">
                      <Highlight text={product.name} query={q} />
                    </div>
                    {(writable || removable) && (
                      <div className="mt-2 flex gap-3">
                        {writable && (
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="text-xs text-ink hover:underline"
                          >
                            Изменить
                          </button>
                        )}
                        {removable && (
                          <button
                            type="button"
                            onClick={() => remove(product)}
                            className="text-xs text-red-700 hover:underline"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPage={(next) => load(q, next).catch((err: Error) => toast(err.message, 'err'))}
          />
        </>
      )}

      {writable && (
        <button
          type="button"
          onClick={
            opened === null
              ? () => {
                  setCategoryName('')
                  setCategoryModal('create')
                }
              : openCreate
          }
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 rounded-2xl bg-ink py-3.5 text-sm font-medium text-white shadow-lg md:hidden"
        >
          {opened === null ? 'Новая категория' : 'Новый товар'}
        </button>
      )}

      {open && (
        <Modal title={editing ? 'Товар' : 'Новый товар'} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Название</span>
              <input
                required
                minLength={1}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Линзы −2.5, оправа Ray-Ban"
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <Select
              label="Категория"
              value={formCategoryId}
              onChange={setFormCategoryId}
              placeholder="Без категории"
              options={[
                { value: '', label: 'Без категории' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <div>
              <span className="mb-1 block text-sm text-muted">Фото (необязательно)</span>
              {preview && !removePhoto && (
                <img
                  src={preview}
                  alt=""
                  className="mb-2 h-36 w-full rounded-xl object-cover"
                />
              )}
              <FilePick file={photo} onChange={onPickFile} />
              {editing?.photoPath && !photo && !removePhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setRemovePhoto(true)
                    setPreview(null)
                  }}
                  className="mt-2 text-xs text-red-700 hover:underline"
                >
                  Убрать фото
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </form>
        </Modal>
      )}

      {categoryModal && (
        <Modal
          title={categoryModal === 'create' ? 'Новая категория' : 'Категория'}
          onClose={() => {
            setCategoryModal(null)
            setCategoryName('')
          }}
        >
          <form onSubmit={saveCategory} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Название</span>
              <input
                required
                autoFocus
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Оправы, линзы…"
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white"
            >
              Сохранить
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
