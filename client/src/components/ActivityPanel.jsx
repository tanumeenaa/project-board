export default function ActivityPanel({ activities = [] }) {
  return (
    <aside className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 md:w-80">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Activity</h3>
      <div className="space-y-3">
        {activities.length ? (
          activities.map((activity) => (
            <div key={activity._id || activity.createdAt} className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white">{activity.user?.name || 'System'}</span>
                <span className="text-[10px] text-slate-500">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-indigo-400">{activity.action}</p>
              <p className="mt-1 text-sm text-slate-300">{activity.details}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No recent activity yet.</p>
        )}
      </div>
    </aside>
  );
}
