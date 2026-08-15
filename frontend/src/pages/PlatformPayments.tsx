import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { formatDate, formatSum } from '../types'
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPE_LABEL,
  paymentStatusClass,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentType,
} from '../payment'

type Org = { id: string; name: string }

export default function PlatformPayments() {
  const toast = useToast()
  const [items, setItems] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [status, setStatusFilter] = useState('')
  const [type, setType] = useState('')
  const [method, setMethod] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectRow, setRejectRow] = useState<Payment | null>(null)
  const [reason, setReason] = useState('')

  async function load(next = 1) {
    const query = new URLSearchParams()
    query.set('page', String(next))
    query.set('pageSize', '50')
    if (status) query.set('status', status)
    if (type) query.set('type', type)
    if (method) query.set('method', method)
    if (organizationId) query.set('organizationId', organizationId)
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    const data = await api<{ items: Payment[]; total: number; page: number }>(
      `/platform/payments?${query}`,
    )
    setItems(data.items)
    setTotal(data.total)
    setPage(data.page)
  }

  useEffect(() => {
    api<Org[]>('/platform/organizations')
      .then((rows) => setOrgs(rows.map((row) => ({ id: row.id, name: row.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load(1).catch((err: Error) => toast(err.message, 'err'))
  }, [status, type, method, organizationId, from, to])

  async function changeStatus(row: Payment, next: PaymentStatus) {
    if (next === row.status) return
    if (next === 'REJECTED') {
      setRejectRow(row)
      setReason('')
      return
    }
    setBusyId(row.id)
    try {
      await api(`/platform/payments/${row.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      await load(page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setBusyId(null)
    }
  }

  async function confirm(row: Payment) {
    setBusyId(row.id)
    try {
      await api(`/platform/payments/${row.id}/confirm`, { method: 'POST' })
      toast('Оплата подтверждена')
      await load(page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setBusyId(null)
    }
  }

  async function reject() {
    if (!rejectRow) return
    setBusyId(rejectRow.id)
    try {
      await api(`/platform/payments/${rejectRow.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REJECTED', reason }),
      })
      setRejectRow(null)
      setReason('')
      toast('Платёж отклонён')
      await load(page)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Платежи</h1>
          <p className="mt-1 text-sm text-muted">Ручная проверка Click и переводов на карту.</p>
        </div>
        <Link to="/platform/payment-settings" className="rounded-xl border border-line px-4 py-2 text-sm">
          Реквизиты оплаты
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-line px-3 py-2 text-sm">
          <option value="">Все статусы</option>
          {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((key) => (
            <option key={key} value={key}>
              {PAYMENT_STATUS_LABEL[key]}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-line px-3 py-2 text-sm">
          <option value="">Все типы</option>
          {(Object.keys(PAYMENT_TYPE_LABEL) as PaymentType[]).map((key) => (
            <option key={key} value={key}>
              {PAYMENT_TYPE_LABEL[key]}
            </option>
          ))}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-xl border border-line px-3 py-2 text-sm">
          <option value="">Все способы</option>
          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((key) => (
            <option key={key} value={key}>
              {PAYMENT_METHOD_LABEL[key]}
            </option>
          ))}
        </select>
        <select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          className="rounded-xl border border-line px-3 py-2 text-sm"
        >
          <option value="">Все организации</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-line px-3 py-2 text-sm" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Номер</th>
                <th className="px-4 py-3 font-medium">Организация</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Сумма</th>
                <th className="px-4 py-3 font-medium">Способ</th>
                <th className="px-4 py-3 font-medium">Плательщик</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Создан</th>
                <th className="px-4 py-3 font-medium">Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted">
                    Платежей пока нет
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/platform/payments/${row.id}`} className="font-medium hover:underline">
                      {row.paymentNumber}
                    </Link>
                    <div className="text-xs text-muted">{row.purpose}</div>
                  </td>
                  <td className="px-4 py-3">{row.organization?.name}</td>
                  <td className="px-4 py-3">{PAYMENT_TYPE_LABEL[row.type]}</td>
                  <td className="px-4 py-3">{formatSum(row.amount)}</td>
                  <td className="px-4 py-3">
                    {row.paymentMethod ? PAYMENT_METHOD_LABEL[row.paymentMethod] : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.payerName || '—'}
                    {row.cardLast4 ? <div className="text-xs text-muted">****{row.cardLast4}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${paymentStatusClass(row.status)}`}>
                      {PAYMENT_STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    {row.status === 'PAID' ? (
                      <span className="text-xs text-muted">готово</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={
                            row.status === 'EXPIRED' ? 'PENDING' : row.status
                          }
                          disabled={busyId === row.id}
                          onChange={(e) => changeStatus(row, e.target.value as PaymentStatus)}
                          className="rounded-lg border border-line bg-white px-2 py-1 text-xs"
                        >
                          <option value="PENDING">Ожидает оплаты</option>
                          <option value="WAITING_CONFIRMATION">На проверке</option>
                          <option value="REJECTED">Отклонён</option>
                        </select>
                        {row.status === 'WAITING_CONFIRMATION' && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => confirm(row)}
                            className="rounded-lg bg-ink px-2 py-1 text-xs text-white disabled:opacity-60"
                          >
                            Подтвердить
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={50}
          total={total}
          onPage={(next) => load(next).catch((err: Error) => toast(err.message, 'err'))}
        />
      </div>

      {rejectRow && (
        <Modal title={`Отклонить ${rejectRow.paymentNumber}`} onClose={() => setRejectRow(null)}>
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина отклонения"
              className="h-28 w-full rounded-xl border border-line px-3 py-2.5"
            />
            <button
              type="button"
              disabled={busyId === rejectRow.id || reason.trim().length < 3}
              onClick={() => reject()}
              className="w-full rounded-xl bg-red-700 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Отклонить
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
