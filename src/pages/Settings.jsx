import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthProvider.jsx'
import { useHousehold } from '../context/HouseholdProvider.jsx'
import { useInvites } from '../hooks/useInvites.js'
import { Card, CardHeader } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Spinner, ErrorState } from '../components/ui/States.jsx'
import { formatDate } from '../lib/dates.js'

function HouseholdSettings() {
  const { household, reload } = useHousehold()
  const [name, setName] = useState('')
  const [remindDays, setRemindDays] = useState(7)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!household) return
    setName(household.name ?? '')
    setRemindDays(household.default_remind_days_before ?? 7)
  }, [household])

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('households')
      .update({
        name: name.trim() || 'Our Household',
        default_remind_days_before: Number(remindDays) || 0,
      })
      .eq('id', household.id)
    setSaving(false)
    if (updateError) {
      setError(updateError)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    reload()
  }

  return (
    <Card>
      <CardHeader title="Household" subtitle="Shared by everyone who signs in here." />
      <form onSubmit={save} className="space-y-3 p-4">
        <div>
          <label htmlFor="hh-name" className="hh-label">Household name</label>
          <input
            id="hh-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="hh-input mt-1"
          />
        </div>
        <div>
          <label htmlFor="hh-remind" className="hh-label">
            Default reminder window (days before due)
          </label>
          <input
            id="hh-remind"
            type="number"
            min="0"
            max="365"
            value={remindDays}
            onChange={(e) => setRemindDays(e.target.value)}
            className="hh-input mt-1 max-w-32"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Used as the default for new items. Each item can override it.
          </p>
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error.message}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          {saved && <span className="text-xs text-teal-600 dark:text-teal-400">Saved</span>}
        </div>
      </form>
    </Card>
  )
}

function Members() {
  const { members } = useHousehold()
  const { user } = useAuth()

  return (
    <Card>
      <CardHeader title="Household members" />
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {member.display_name || member.email}
                {member.user_id === user?.id && (
                  <span className="ml-2 text-xs font-normal text-slate-400">you</span>
                )}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {member.role}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function InviteSpouse() {
  const { householdId } = useHousehold()
  const { invites, loading, error, invite, revoke } = useInvites(householdId)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await invite(email, name)
      setEmail('')
      setName('')
    } catch (err) {
      setFormError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Invite someone to this household"
        subtitle="They sign in with the same magic-link flow and land in this household."
      />
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="invite-email" className="hh-label">Email</label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="spouse@example.com"
              className="hh-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="invite-name" className="hh-label">Name (optional)</label>
            <input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hh-input mt-1"
            />
          </div>
        </div>
        {formError && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{formError.message}</p>
        )}
        <Button type="submit" disabled={busy}>{busy ? 'Inviting…' : 'Invite'}</Button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No email is sent from here — tell them to sign in at this URL with that address and
          they’ll join automatically.
        </p>
      </form>

      {loading ? (
        <Spinner label="Loading invites…" />
      ) : invites.length > 0 ? (
        <div className="border-t border-slate-200 dark:border-slate-800">
          <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            Pending
          </p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {invites.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{row.email}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Invited {formatDate(row.created_at?.slice(0, 10))}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke(row.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error && <div className="p-4"><ErrorState error={error} /></div>}
    </Card>
  )
}

export default function Settings() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <HouseholdSettings />
      <Members />
      <InviteSpouse />
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Arriving in build phase 4
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          <li>Export all data to CSV</li>
          <li>Calendar feed URL (<code>/api/calendar.ics</code>) with its secret token</li>
        </ul>
      </Card>
    </div>
  )
}
