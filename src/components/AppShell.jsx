import { NavLink } from 'react-router-dom'
import { cn } from '../lib/cn.js'
import { useTheme } from '../context/ThemeProvider.jsx'
import { useAuth } from '../context/AuthProvider.jsx'
import { useHousehold } from '../context/HouseholdProvider.jsx'
import {
  HomeIcon, ListIcon, HeartIcon, CalendarIcon, SettingsIcon,
  SunIcon, MoonIcon, LogOutIcon,
} from './Icons.jsx'

const NAV = [
  { to: '/',         label: 'Dashboard',     short: 'Home',     Icon: HomeIcon, end: true },
  { to: '/items',    label: 'All Items',     short: 'Items',    Icon: ListIcon },
  { to: '/medical',  label: 'Medical Bills', short: 'Medical',  Icon: HeartIcon },
  { to: '/calendar', label: 'Calendar',      short: 'Calendar', Icon: CalendarIcon },
  { to: '/settings', label: 'Settings',      short: 'Settings', Icon: SettingsIcon },
]

function navClass({ isActive }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export function AppShell({ children }) {
  const { user, signOut } = useAuth()
  const { household } = useHousehold()

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {household?.name || 'Household Hub'}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {user?.email}
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-slate-200 px-2 py-3 dark:border-slate-800">
          <ThemeToggle />
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <LogOutIcon width={14} height={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <p className="truncate text-sm font-semibold">{household?.name || 'Household Hub'}</p>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400"
          >
            <LogOutIcon />
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-7">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900">
        {NAV.map(({ to, short, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive
                  ? 'text-teal-700 dark:text-teal-300'
                  : 'text-slate-500 dark:text-slate-400',
              )
            }
          >
            <Icon width={20} height={20} />
            {short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
