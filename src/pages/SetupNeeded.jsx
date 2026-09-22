/** Shown when VITE_SUPABASE_* are missing, instead of a blank screen. */
export default function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="hh-card w-full max-w-lg p-6">
        <h1 className="text-lg font-semibold">Supabase isn’t configured yet</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The app needs two environment variables to talk to your Supabase project.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li>
            Copy <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.example</code>{' '}
            to <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code>.
          </li>
          <li>
            Fill in <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">VITE_SUPABASE_URL</code>{' '}
            and <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">VITE_SUPABASE_ANON_KEY</code>{' '}
            from Supabase → Project Settings → API.
          </li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
          On Vercel, add the same two variables under Project Settings → Environment Variables,
          then redeploy.
        </p>
      </div>
    </div>
  )
}
