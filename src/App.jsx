import { Route, Routes, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase.js'
import { ThemeProvider } from './context/ThemeProvider.jsx'
import { AuthProvider, useAuth } from './context/AuthProvider.jsx'
import { HouseholdProvider, useHousehold } from './context/HouseholdProvider.jsx'
import { AppShell } from './components/AppShell.jsx'
import { Spinner, ErrorState } from './components/ui/States.jsx'
import SetupNeeded from './pages/SetupNeeded.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Items from './pages/Items.jsx'
import MedicalBills from './pages/MedicalBills.jsx'
import Calendar from './pages/Calendar.jsx'
import Settings from './pages/Settings.jsx'

function AuthedApp() {
  const { loading, error, householdId, reload } = useHousehold()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Setting up your household…" />
      </div>
    )
  }

  if (error || !householdId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <ErrorState
          error={error || new Error('Could not resolve a household for this account.')}
          onRetry={reload}
        />
      </div>
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/items" element={<Items />} />
        <Route path="/medical" element={<MedicalBills />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking your session…" />
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <HouseholdProvider>
      <AuthedApp />
    </HouseholdProvider>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <ThemeProvider>
        <SetupNeeded />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  )
}
