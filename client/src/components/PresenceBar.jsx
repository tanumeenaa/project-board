export default function PresenceBar({ users }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {users?.slice(0, 6).map((user) => (
          <div
            key={user._id}
            title={user.name}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-semibold text-white"
            style={{ backgroundColor: user.avatarColor || '#6366f1' }}
          >
            {user.name?.slice(0, 2).toUpperCase()}
          </div>
        ))}
      </div>
      {users?.length ? (
        <span className="text-xs text-slate-400">{users.length} viewing</span>
      ) : (
        <span className="text-xs text-slate-500">No active viewers</span>
      )}
    </div>
  );
}
