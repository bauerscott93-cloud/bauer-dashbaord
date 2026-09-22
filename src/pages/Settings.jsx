import { useEffect, useState } from 'react'
import { supabase, HOUSEHOLD_EMAIL } from '../lib/supabase.js'
import { useAuth } from '../context/AuthProvider.jsx'
import { useHousehold } from '../context/HouseholdProvider.jsx'
import { useMembers } from '../hooks/useMembers.js'
import { Card, CardHeader } from '../components/ui/Card.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Spinner, ErrorState } from '../components/ui/States.jsx'

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
      <CardHeader title="Household" />
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

function MemberRow({ member, onRename, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(member.display_name ?? '')
  const [confirming, setConfirming] = useState(false)

  async function commit(event) {
    event.preventDefault()
    if (draft.trim() && draft.trim() !== member.display_name) {
      await onRename(member.id, draft)
    }
    setEditing(false)
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      {editing ? (
        <form onSubmit={commit} className="flex flex-1 items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="hh-input"
          />
          <Button type="submit" size="sm">Save</Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(member.display_name ?? '')
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {member.display_name || '(unnamed)'}
          </p>
          {confirming ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Remove?</span>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await onRemove(member.id)
                  setConfirming(false)
                }}
              >
                Remove
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Rename</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>Remove</Button>
            </div>
          )}
        </>
      )}
    </li>
  )
}

function People() {
  const { householdId, reload: reloadHousehold } = useHousehold()
  const { members, loading, error, add, rename, remove } = useMembers(householdId)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)

  async function withRefresh(fn) {
    try {
      await fn()
      reloadHousehold()
    } catch (err) {
      setFormError(err)
    }
  }

  async function onAdd(event) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setFormError(null)
    await withRefresh(() => add(name))
    setName('')
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader
        title="People"
        subtitle="Who an item can be assigned to. These aren’t separate logins."
      />
      {loading ? (
        <Spinner label="Loading people…" />
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onRename={(id, value) => withRefresh(() => rename(id, value))}
              onRemove={(id) => withRefresh(() => remove(id))}
            />
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="flex items-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex-1">
          <label htmlFor="member-name" className="hh-label">Add a person</label>
          <input
            id="member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="hh-input mt-1"
          />
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>Add</Button>
      </form>
      {(formError || error) && (
        <div className="px-4 pb-4"><ErrorState error={formError || error} /></div>
      )}
    </Card>
  )
}

function SharedPassword() {
  const { changePassword } = useAuth()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(event) {
    event.preventDefault()
    if (next !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    if (next.length < 10) {
      setError('Use at least 10 characters.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: updateError } = await changePassword(next)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setNext('')
    setConfirm('')
    setDone(true)
    setTimeout(() => setDone(false), 4000)
  }

  return (
    <Card>
      <CardHeader
        title="Shared password"
        subtitle={`Everyone signs in to ${HOUSEHOLD_EMAIL} with this password.`}
      />
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pw-new" className="hh-label">New password</label>
            <input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="hh-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="hh-label">Confirm</label>
            <input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="hh-input mt-1"
            />
          </div>
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        {done && (
          <p className="text-xs text-teal-600 dark:text-teal-400">
            Changed. Anyone already signed in on another device will be asked for it again.
          </p>
        )}
        <Button type="submit" disabled={busy || !next}>
          {busy ? 'Changing…' : 'Change password'}
        </Button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          There’s no email on this account, so there’s no “forgot password” link. If it’s lost,
          reset it in Supabase → Authentication → Users.
        </p>
      </form>
    </Card>
  )
}

export default function Settings() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <HouseholdSettings />
      <People />
      <SharedPassword />
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
