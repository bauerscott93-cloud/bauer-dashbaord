/** Shown when the VITE_* env vars are missing, instead of a blank screen. */
const VARS = [
  ['VITE_SUPABASE_URL', 'Supabase → Project Settings → API'],
  ['VITE_SUPABASE_ANON_KEY', 'Supabase → Project Settings → API'],
  ['VITE_HOUSEHOLD_EMAIL', 'The shared account you created under Authentication → Users'],
]

export default function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="hh-card w-full max-w-lg p-6">
        <h1 className="text-lg font-semibold">Supabase isn’t configured yet</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The app needs three environment variables before it can sign you in.
        </p>
        <dl className="mt-4 space-y-3">
          {VARS.map(([name, where]) => (
            <div key={name}>
              <dt className="text-sm font-medium text-slate-800 dark:text-slate-200">
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{name}</code>
              </dt>
              <dd className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{where}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Locally, copy <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.example</code>{' '}
          to <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code>, fill
          them in, and restart the dev server.
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
          On Vercel, add all three under Project Settings → Environment Variables, then redeploy.
          Vite bakes them in at build time, so a deploy built before they existed won’t pick them up.
        </p>
      </div>
    </div>
  )
}
