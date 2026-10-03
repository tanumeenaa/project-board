import { useState } from 'react';

export default function MembersModal({ board, onClose, onInvite, onRoleChange, onRemove }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');

  if (!board) {
    return null;
  }

  const handleInvite = () => {
    if (!email.trim()) return;
    onInvite({ email, role });
    setEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Board members</h3>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-2 py-1 text-sm text-slate-300">
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Invite by email"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
            <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-white">
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="button" onClick={handleInvite} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white">
              Invite
            </button>
          </div>

          <div className="space-y-2">
            {board.members?.map((member) => (
              <div key={member.user._id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div>
                  <p className="font-medium text-white">{member.user.name}</p>
                  <p className="text-xs text-slate-400">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(event) => onRoleChange(member.user._id, event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="button" onClick={() => onRemove(member.user._id)} className="rounded-lg border border-rose-700 px-2 py-1 text-sm text-rose-300">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
