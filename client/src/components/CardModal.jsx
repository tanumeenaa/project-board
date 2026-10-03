export default function CardModal({ card, onClose, onSave, onComment, onDelete, currentUser }) {
  if (!card) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-400">Card detail</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{card.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {onDelete ? (
              <button type="button" onClick={onDelete} className="rounded-lg border border-rose-700 px-2 py-1 text-sm text-rose-300">
                Delete
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-2 py-1 text-sm text-slate-300">
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Title</label>
            <input
              type="text"
              value={card.title || ''}
              onChange={(event) => onSave({ title: event.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Description</label>
            <textarea
              value={card.description || ''}
              onChange={(event) => onSave({ description: event.target.value })}
              className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Due date</label>
            <input
              type="date"
              value={card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : ''}
              onChange={(event) => onSave({ dueDate: event.target.value || null })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Labels</label>
            <div className="flex flex-wrap gap-2">
              {(card.labels || []).map((label, index) => (
                <span key={`${label.name}-${index}`} className="rounded-full px-2 py-1 text-xs font-medium text-slate-900" style={{ backgroundColor: label.color }}>
                  {label.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Comments</label>
            <div className="space-y-3">
              {card.comments?.length ? (
                card.comments.map((comment) => (
                  <div key={comment._id || `${comment.user}-${comment.createdAt}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{comment.user?.name || currentUser?.name}</span>
                      <span className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-slate-300">{comment.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No comments yet.</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Add a comment"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && event.target.value.trim()) {
                    onComment(event.target.value.trim());
                    event.target.value = '';
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
