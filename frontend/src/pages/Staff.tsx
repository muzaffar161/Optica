import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import { ACCESS_LABEL, MODULE_LABEL, MODULES } from '../access'
import { useAuth } from '../AuthContext'
import type { AccessLevel, AccessModule, StaffMember } from '../types'
import { featuresOf } from '../types'

const LEVELS: AccessLevel[] = ['view', 'edit', 'all']

const PRESETS: { key: string; label: string; perms: Record<AccessModule, AccessLevel> }[] = [
  {
    key: 'cashier',
    label: 'Кассир',
    perms: { orders: 'edit', products: 'none', clients: 'view', journal: 'none', settings: 'none' },
  },
  {
    key: 'master',
    label: 'Мастер',
    perms: { orders: 'edit', products: 'view', clients: 'view', journal: 'view', settings: 'none' },
  },
  {
    key: 'viewer',
    label: 'Просмотр',
    perms: { orders: 'view', products: 'view', clients: 'view', journal: 'view', settings: 'none' },
  },
  {
    key: 'manager',
    label: 'Управляющий',
    perms: { orders: 'all', products: 'all', clients: 'all', journal: 'all', settings: 'edit' },
  },
]

type Branch = {
  id: string
  name: string
  active: boolean
  catalogOrders: boolean
  rxOrders: boolean
  current: boolean
  orderCount: number
  clientCount: number
  users: StaffMember[]
}

type StaffPayload = {
  branches: Branch[]
  staffLimit: number
  networkEmployeeCount: number
  unlimited: boolean
  salonCount: number
  maxSalons: number
  canManageNetwork: boolean
}

function permKey(module: AccessModule): keyof StaffMember {
  return (
    {
      orders: 'permOrders',
      products: 'permProducts',
      clients: 'permClients',
      journal: 'permJournal',
      settings: 'permSettings',
    } as const
  )[module]
}

function rightsFrom(member: StaffMember): Record<AccessModule, AccessLevel> {
  return {
    orders: member.permOrders,
    products: member.permProducts,
    clients: member.permClients,
    journal: member.permJournal,
    settings: member.permSettings,
  }
}

function Rights({
  value,
  onChange,
  modules = MODULES,
}: {
  value: Record<AccessModule, AccessLevel>
  onChange: (next: Record<AccessModule, AccessLevel>) => void
  modules?: AccessModule[]
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted">Права</div>
      {modules.map((module) => {
        const on = value[module] !== 'none'
        return (
          <div key={module} className="rounded-2xl border border-line bg-paper/60 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{MODULE_LABEL[module]}</div>
              <button
                type="button"
                onClick={() => onChange({ ...value, [module]: on ? 'none' : 'view' })}
                className={`rounded-full px-3 py-1 text-xs ${
                  on ? 'bg-ink text-white' : 'border border-line bg-card text-muted'
                }`}
              >
                {on ? 'открыто' : 'закрыто'}
              </button>
            </div>
            {on && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onChange({ ...value, [module]: level })}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      value[module] === level
                        ? 'bg-ink text-white'
                        : 'border border-line bg-card text-muted hover:text-ink'
                    }`}
                  >
                    {ACCESS_LABEL[level]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ModeToggles({
  catalog,
  rx,
  onCatalog,
  onRx,
}: {
  catalog: boolean
  rx: boolean
  onCatalog: (value: boolean) => void
  onRx: (value: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted">Какие заказы принимает филиал</div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={catalog} onChange={(e) => onCatalog(e.target.checked)} />
        Каталог товаров
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={rx} onChange={(e) => onRx(e.target.checked)} />
        Заказ по рецепту
      </label>
    </div>
  )
}

export default function Staff() {
  const toast = useToast()
  const { user } = useAuth()
  const advanced = featuresOf(user).advancedRoles
  const [data, setData] = useState<StaffPayload | null>(null)
  const [openBranch, setOpenBranch] = useState<Branch | 'new' | null>(null)
  const [branchName, setBranchName] = useState('')
  const [branchCatalog, setBranchCatalog] = useState(true)
  const [branchRx, setBranchRx] = useState(false)
  const [branchActive, setBranchActive] = useState(true)
  const [staffFor, setStaffFor] = useState<Branch | null>(null)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [perms, setPerms] = useState(PRESETS[0].perms)
  const [resetFor, setResetFor] = useState<StaffMember | null>(null)
  const [moveFor, setMoveFor] = useState<StaffMember | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    setData(await api<StaffPayload>('/staff'))
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [])

  const branches = data?.branches ?? []
  const canManage = !!data?.canManageNetwork
  const unlimited = !!data?.unlimited
  const used = data?.networkEmployeeCount ?? 0
  const staffLimit = data?.staffLimit ?? 0
  const canAddStaff = unlimited || used < staffLimit
  const canAddBranch = canManage && !!data && data.salonCount < data.maxSalons

  function startBranch(branch?: Branch) {
    if (branch) {
      setOpenBranch(branch)
      setBranchName(branch.name)
      setBranchCatalog(branch.catalogOrders)
      setBranchRx(branch.rxOrders)
      setBranchActive(branch.active)
    } else {
      setOpenBranch('new')
      setBranchName('')
      setBranchCatalog(true)
      setBranchRx(false)
      setBranchActive(true)
    }
  }

  function startStaff(branch: Branch, member?: StaffMember) {
    setStaffFor(branch)
    setEditing(member || null)
    setUsername(member?.username || '')
    setPassword('')
    setPerms(member ? rightsFrom(member) : PRESETS[0].perms)
  }

  async function saveBranch(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      if (openBranch === 'new') {
        await api('/staff/branches', {
          method: 'POST',
          body: JSON.stringify({
            name: branchName,
            catalogOrders: branchCatalog,
            rxOrders: branchRx,
          }),
        })
        toast('Филиал создан')
      } else if (openBranch) {
        await api(`/staff/branches/${openBranch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: branchName,
            catalogOrders: branchCatalog,
            rxOrders: branchRx,
            active: branchActive,
          }),
        })
        toast('Филиал обновлён')
      }
      setOpenBranch(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function removeBranch(branch: Branch) {
    if (!window.confirm(`Удалить филиал «${branch.name}»?`)) return
    try {
      await api(`/staff/branches/${branch.id}`, { method: 'DELETE' })
      toast('Филиал удалён')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function saveStaff(e: FormEvent) {
    e.preventDefault()
    if (!staffFor) return
    setPending(true)
    try {
      const body = {
        username,
        opticsId: staffFor.id,
        permOrders: perms.orders,
        permProducts: perms.products,
        permClients: perms.clients,
        permJournal: perms.journal,
        permSettings: perms.settings,
      }
      if (editing) {
        await api(`/staff/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast('Сохранено')
      } else {
        await api('/staff', { method: 'POST', body: JSON.stringify({ ...body, password }) })
        toast('Сотрудник добавлен')
      }
      setStaffFor(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function toggleActive(member: StaffMember) {
    try {
      await api(`/staff/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !member.active }),
      })
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault()
    if (!resetFor) return
    setPending(true)
    try {
      await api(`/staff/${resetFor.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setResetFor(null)
      setPassword('')
      toast('Пароль обновлён')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function removeStaff(member: StaffMember) {
    if (!window.confirm(`Удалить ${member.username}? Зайти больше не сможет.`)) return
    try {
      await api(`/staff/${member.id}`, { method: 'DELETE' })
      toast('Удалено')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    }
  }

  async function moveStaff(e: FormEvent) {
    e.preventDefault()
    if (!moveFor || !moveTo) return
    setPending(true)
    try {
      await api(`/staff/${moveFor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ opticsId: moveTo }),
      })
      toast('Сотрудник переведён')
      setMoveFor(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  if (!data) return <p className="text-muted">Загрузка…</p>

  return (
    <div className="pb-24 md:pb-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Филиалы</h1>
          <p className="mt-1 text-sm text-muted">
            Сначала точки, внутри — сотрудники.
            {unlimited
              ? ' Сотрудники без лимита.'
              : ` В сети ${used} из ${staffLimit || '—'}.`}
            {canManage ? ` Филиалы: ${data.salonCount} / ${data.maxSalons}.` : ''}
          </p>
        </div>
        {canAddBranch && (
          <button
            type="button"
            onClick={() => startBranch()}
            className="hidden rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white md:inline-flex"
          >
            Добавить филиал
          </button>
        )}
      </div>

      <div className="space-y-4">
        {branches.map((branch) => {
          const staff = branch.users.filter((u) => !u.orgOwner)
          const modules = MODULES.filter((module) => module !== 'products' || branch.catalogOrders)
          return (
            <section key={branch.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl">{branch.name}</h2>
                    {branch.current && (
                      <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-white">вы здесь</span>
                    )}
                    {!branch.active && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">выкл</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {branch.catalogOrders ? 'каталог' : ''}
                    {branch.catalogOrders && branch.rxOrders ? ' · ' : ''}
                    {branch.rxOrders ? 'рецепт' : ''}
                    {' · '}
                    {staff.filter((u) => !u.isOwner).length} сотр.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startBranch(branch)}
                    className="rounded-xl border border-line px-3 py-2 text-sm"
                  >
                    Изменить
                  </button>
                  {canManage && !branch.current && (
                    <button
                      type="button"
                      onClick={() => removeBranch(branch)}
                      className="rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  )}
                  {canAddStaff && (
                    <button
                      type="button"
                      onClick={() => startStaff(branch)}
                      className="rounded-xl bg-ink px-3 py-2 text-sm text-white"
                    >
                      Сотрудник
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {staff.length === 0 ? (
                  <p className="text-sm text-muted">В этом филиале пока нет сотрудников.</p>
                ) : (
                  staff.map((member) => {
                    const rights = modules.filter((module) => member[permKey(module)] !== 'none')
                    const locked = member.isOwner
                    return (
                      <article
                        key={member.id}
                        className={`rounded-2xl border border-line bg-paper/50 p-3 ${member.active ? '' : 'opacity-70'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{member.username}</div>
                            <div className="text-xs text-muted">
                              {locked ? 'владелец филиала' : member.active ? 'может входить' : 'вход закрыт'}
                            </div>
                          </div>
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => toggleActive(member)}
                              className={`rounded-full px-3 py-1 text-xs ${
                                member.active ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {member.active ? 'открыт' : 'закрыт'}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {locked ? (
                            <span className="text-xs text-muted">Полный доступ к филиалу</span>
                          ) : rights.length === 0 ? (
                            <span className="text-xs text-muted">Вкладок нет</span>
                          ) : (
                            rights.map((module) => (
                              <span key={module} className="rounded-full bg-card px-2.5 py-1 text-[11px]">
                                {MODULE_LABEL[module]} · {ACCESS_LABEL[member[permKey(module)] as AccessLevel]}
                              </span>
                            ))
                          )}
                        </div>
                        {!locked && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => startStaff(branch, member)} className="rounded-xl border border-line px-3 py-1.5 text-sm">
                              Изменить
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPassword('')
                                setResetFor(member)
                              }}
                              className="rounded-xl border border-line px-3 py-1.5 text-sm"
                            >
                              Пароль
                            </button>
                            {canManage && branches.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMoveFor(member)
                                  setMoveTo(branches.find((b) => b.id !== branch.id)?.id || '')
                                }}
                                className="rounded-xl border border-line px-3 py-1.5 text-sm"
                              >
                                В другой филиал
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeStaff(member)}
                              className="rounded-xl px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          )
        })}
      </div>

      {canAddBranch && (
        <button
          type="button"
          onClick={() => startBranch()}
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 rounded-2xl bg-ink py-3.5 text-sm font-medium text-white shadow-lg md:hidden"
        >
          Добавить филиал
        </button>
      )}

      {openBranch && (
        <Modal title={openBranch === 'new' ? 'Новый филиал' : 'Филиал'} onClose={() => setOpenBranch(null)}>
          <form onSubmit={saveBranch} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Название</span>
              <input
                required
                minLength={2}
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <ModeToggles catalog={branchCatalog} rx={branchRx} onCatalog={setBranchCatalog} onRx={setBranchRx} />
            {openBranch !== 'new' && (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={branchActive} onChange={(e) => setBranchActive(e.target.checked)} />
                Филиал активен
              </label>
            )}
            <button type="submit" disabled={pending || (!branchCatalog && !branchRx)} className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </form>
        </Modal>
      )}

      {staffFor && (
        <Modal title={editing ? 'Права и логин' : `Сотрудник · ${staffFor.name}`} onClose={() => setStaffFor(null)} wide>
          <form onSubmit={saveStaff} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Логин</span>
              <input
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            {!editing && (
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Пароль</span>
                <input
                  required
                  minLength={6}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
                />
              </label>
            )}
            <div>
              <div className="mb-2 text-sm text-muted">{advanced ? 'Готовые роли' : 'Роль'}</div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.filter((p) => advanced || p.key !== 'manager').map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setPerms(preset.perms)}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      JSON.stringify(perms) === JSON.stringify(preset.perms)
                        ? 'bg-ink text-white'
                        : 'border border-line bg-card text-muted'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            {advanced ? (
              <Rights
                value={perms}
                onChange={setPerms}
                modules={MODULES.filter((module) => module !== 'products' || staffFor.catalogOrders)}
              />
            ) : (
              <p className="text-xs text-muted">Гибкие права — в тарифе Business.</p>
            )}
            <button type="submit" disabled={pending} className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </form>
        </Modal>
      )}

      {resetFor && (
        <Modal title={`Новый пароль · ${resetFor.username}`} onClose={() => setResetFor(null)}>
          <form onSubmit={resetPassword} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Пароль</span>
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              />
            </label>
            <button type="submit" disabled={pending} className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {pending ? 'Сохраняем…' : 'Сбросить'}
            </button>
          </form>
        </Modal>
      )}

      {moveFor && (
        <Modal title={`Перевести ${moveFor.username}`} onClose={() => setMoveFor(null)}>
          <form onSubmit={moveStaff} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Филиал</span>
              <select
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none"
              >
                {branches
                  .filter((b) => b.id !== moveFor.opticsId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            <button type="submit" disabled={pending || !moveTo} className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {pending ? 'Переводим…' : 'Перевести'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
