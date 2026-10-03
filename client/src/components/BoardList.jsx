import { Link } from 'react-router-dom';

export default function BoardList({ board }) {
  return (
    <Link
      to={`/boards/${board._id}`}
      className="flex h-32 flex-col justify-between rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left shadow-lg transition hover:border-indigo-500/60 hover:bg-slate-800"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-indigo-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-300">
            Board
          </span>
        </div>
        <h3 className="text-lg font-semibold text-white">{board.name}</h3>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{board.members?.length || 1} members</span>
        <span>{board.owner?.name || 'Owner'}</span>
      </div>
    </Link>
  );
}
