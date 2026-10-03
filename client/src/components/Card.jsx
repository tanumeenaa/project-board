import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function Card({ card, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card._id,
    data: { type: 'card', card }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onClick(card)}
      className={`w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-left shadow-sm transition hover:border-indigo-500/60 ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="mb-2 flex flex-wrap gap-2">
        {card.labels?.map((label) => (
          <span
            key={label.name}
            className="rounded-full px-2 py-1 text-[10px] font-medium text-slate-900"
            style={{ backgroundColor: label.color || '#94a3b8' }}
          >
            {label.name}
          </span>
        ))}
      </div>
      <p className="text-sm font-medium text-white">{card.title}</p>
      {card.dueDate ? (
        <p className="mt-2 text-[11px] text-slate-400">Due {new Date(card.dueDate).toLocaleDateString()}</p>
      ) : null}
    </button>
  );
}
