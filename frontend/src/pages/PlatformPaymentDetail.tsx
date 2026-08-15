import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../Toast'
import Modal from '../components/Modal'
import { formatDate, formatSum } from '../types'
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPE_LABEL,
  paymentStatusClass,
  type Payment,
} from '../payment'

export default function PlatformPaymentDetail() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [pending, setPending] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  async function load() {
    if (!id) return
    setPayment(await api<Payment>(`/platform/payments/${id}`))
  }

  useEffect(() => {
    load().catch((err: Error) => toast(err.message, 'err'))
  }, [id])

  async function confirm() {
    if (!id) return
    setPending(true)
    try {
      setPayment(await api<Payment>(`/platform/payments/${id}/confirm`, { method: 'POST' }))
      toast('Оплата подтверждена')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function reject() {
    if (!id) return
    setPending(true)
    try {
      setPayment(
        await api<Payment>(`/platform/payments/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'REJECTED', reason }),
        }),
      )
      setRejectOpen(false)
      setReason('')
      toast('Платёж отклонён')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  async function changeStatus(status: 'PENDING' | 'WAITING_CONFIRMATION' | 'REJECTED') {
    if (!id || !payment || status === payment.status) return
    if (status === 'REJECTED') {
      setRejectOpen(true)
      return
    }
    setPending(true)
    try {
      setPayment(
        await api<Payment>(`/platform/payments/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
      )
      toast('Статус обновлён')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'err')
    } finally {
      setPending(false)
    }
  }

  if (!payment) return <p className="text-muted">Загрузка…</p>
  const canEdit = payment.status !== 'PAID'

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <button type="button" onClick={() => navigate('/platform/payments')} className="text-sm text-muted hover:text-ink">
        ← К платежам
      </button>
      <h1 className="font-display text-3xl">{payment.paymentNumber}</h1>

      <section className="space-y-2 rounded-2xl border border-line bg-card p-5 text-sm">
        <Row label="Организация" value={payment.organization?.name} />
        <Row label="Тип" value={PAYMENT_TYPE_LABEL[payment.type]} />
        <Row label="Назначение" value={payment.purpose} />
        <Row label="Сумма" value={formatSum(payment.amount)} />
        <Row
          label="Способ"
          value={payment.paymentMethod ? PAYMENT_METHOD_LABEL[payment.paymentMethod] : 'ещё не выбран'}
        />
        <Row label="Плательщик" value={payment.payerName || '—'} />
        <Row label="Карта" value={payment.cardLast4 ? `****${payment.cardLast4}` : '—'} />
        <div className="flex justify-between gap-3">
          <span className="text-muted">Статус</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${paymentStatusClass(payment.status)}`}>
            {PAYMENT_STATUS_LABEL[payment.status]}
          </span>
        </div>
        <Row label="Создан" value={formatDate(payment.createdAt)} />
        {payment.paidAt && <Row label="Оплачен" value={formatDate(payment.paidAt)} />}
        {payment.confirmedBy && <Row label="Подтвердил" value={payment.confirmedBy} />}
        {payment.rejectionReason && <Row label="Причина" value={payment.rejectionReason} />}
      </section>

      {canEdit && (
        <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <div className="text-sm text-muted">Сменить статус</div>
          <select
            value={payment.status === 'EXPIRED' ? 'PENDING' : payment.status}
            disabled={pending}
            onChange={(e) =>
              changeStatus(e.target.value as 'PENDING' | 'WAITING_CONFIRMATION' | 'REJECTED')
            }
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
          >
            <option value="PENDING">Ожидает оплаты</option>
            <option value="WAITING_CONFIRMATION">На проверке</option>
            <option value="REJECTED">Отклонён</option>
          </select>
          {payment.status === 'WAITING_CONFIRMATION' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm()}
              className="w-full rounded-xl bg-ink py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Сохраняем…' : 'Подтвердить оплату'}
            </button>
          )}
        </section>
      )}

      {rejectOpen && (
        <Modal title="Отклонить платёж" onClose={() => setRejectOpen(false)}>
          <div className="space-y-3">
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина отклонения"
              className="h-28 w-full rounded-xl border border-line px-3 py-2.5"
            />
            <button
              type="button"
              disabled={pending || reason.trim().length < 3}
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

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value || '—'}</span>
    </div>
  )
}
