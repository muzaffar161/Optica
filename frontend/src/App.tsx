import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './components/Layout'
import PlatformLayout from './components/PlatformLayout'
import Login from './pages/Login'
import Orders from './pages/Orders'
import NewOrderPage from './components/NewOrderPage'
import Products from './pages/Products'
import Clients from './pages/Clients'
import SettingsPage from './pages/Settings'
import Notifications from './pages/Notifications'
import PlatformHome from './pages/PlatformHome'
import PlatformTemplates from './pages/PlatformTemplates'
import PlatformSms from './pages/PlatformSms'
import PlatformOrganizations from './pages/PlatformOrganizations'
import PlatformPlans from './pages/PlatformPlans'
import PlatformPackages from './pages/PlatformPackages'
import PlatformPayments from './pages/PlatformPayments'
import PlatformPaymentDetail from './pages/PlatformPaymentDetail'
import PlatformPaymentSettings from './pages/PlatformPaymentSettings'
import PlatformUsage from './pages/PlatformUsage'
import Staff from './pages/Staff'
import BillingPage from './pages/Billing'
import PaymentCheckoutPage from './pages/PaymentCheckout'
import SmsPage from './pages/SmsPage'
import ReportsPage from './pages/Reports'
import AuditPage from './pages/Audit'
import IntegrationsPage from './pages/Integrations'
import { canEdit, canView, firstAllowedPath, pathModule } from './access'
import { featuresOf, hasCatalog } from './types'
import { bootUsage, track, trackSession } from './usage'
import { isSubscriptionActive } from './subscription'

function ExpiredWall() {
  const { logout } = useAuth()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-paper px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <div className="max-w-md rounded-3xl border border-line bg-card px-6 py-8">
        <h1 className="font-display text-3xl">Подписка закончилась</h1>
        <p className="mt-3 text-sm text-muted">
          Доступ в салон закрыт. Попросите владельца оплатить тариф.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 text-sm text-brass hover:underline"
        >
          Выйти
        </button>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted">Загрузка…</div>
  )
}

function ShopGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'platform') return <Navigate to="/platform" replace />
  return children
}

function ModuleGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return null
  if (!isSubscriptionActive(user)) {
    const onBilling = location.pathname.startsWith('/billing')
    if (user.orgOwner) {
      if (!onBilling) return <Navigate to="/billing" replace />
      return children
    }
    return <ExpiredWall />
  }
  const module = pathModule(location.pathname)
  if (module === 'staff' && user.isOwner === false) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  if ((location.pathname.startsWith('/billing') || location.pathname.startsWith('/sms')) && !user.orgOwner) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  if (location.pathname.startsWith('/reports') && user.isOwner === false && !user.orgOwner) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  if (location.pathname.startsWith('/audit') && (featuresOf(user).auditLevel === 'none' || (user.isOwner === false && !user.orgOwner))) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  if (location.pathname.startsWith('/integrations') && (!user.orgOwner || !featuresOf(user).apiAccess)) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  if (location.pathname === '/new-order' && !canEdit(user, 'orders')) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  if (location.pathname.startsWith('/products') && !hasCatalog(user)) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  if (module && module !== 'staff' && !canView(user, module)) {
    return <Navigate to={firstAllowedPath(user)} replace />
  }
  return children
}

function PlatformGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/platform/login" replace />
  if (user.role !== 'platform') return <Navigate to="/" replace />
  return children
}

function Guest({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user?.role === 'platform') return <Navigate to="/platform" replace />
  if (user) return <Navigate to={firstAllowedPath(user)} replace />
  return children
}

function UsageBeacon() {
  const { user } = useAuth()
  const location = useLocation()

  useEffect(() => {
    bootUsage()
  }, [])

  useEffect(() => {
    if (!user || user.role !== 'optics') return
    trackSession()
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'optics') return
    if (location.pathname.includes('login')) return
    track('screen', { path: location.pathname })
  }, [location.pathname, user])

  return null
}

export default function App() {
  return (
    <>
      <UsageBeacon />
      <Routes>
      <Route
        path="/login"
        element={
          <Guest>
            <Login audience="shop" />
          </Guest>
        }
      />
      <Route
        path="/platform/login"
        element={
          <Guest>
            <Login audience="platform" />
          </Guest>
        }
      />
      <Route
        element={
          <ShopGuard>
            <ModuleGuard>
              <Layout />
            </ModuleGuard>
          </ShopGuard>
        }
      >
        <Route path="/" element={<Orders />} />
        <Route path="/new-order" element={<NewOrderPage />} />
        <Route path="/products" element={<Products />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/billing/payments/:id" element={<PaymentCheckoutPage />} />
        <Route path="/sms" element={<SmsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>
      <Route
        element={
          <PlatformGuard>
            <PlatformLayout />
          </PlatformGuard>
        }
      >
        <Route path="/platform" element={<PlatformHome />} />
        <Route path="/platform/templates" element={<PlatformTemplates />} />
        <Route path="/platform/sms" element={<PlatformSms />} />
        <Route path="/platform/organizations" element={<PlatformOrganizations />} />
        <Route path="/platform/plans" element={<PlatformPlans />} />
        <Route path="/platform/sms-packages" element={<PlatformPackages />} />
        <Route path="/platform/payments" element={<PlatformPayments />} />
        <Route path="/platform/payments/:id" element={<PlatformPaymentDetail />} />
        <Route path="/platform/payment-settings" element={<PlatformPaymentSettings />} />
        <Route path="/platform/usage" element={<PlatformUsage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
