import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import BoardList from '../components/BoardList.jsx';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [boards, setBoards] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBoards = async () => {
    try {
      const response = await api.get('/boards');
      setBoards(response.data.boards || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, []);

  const handleCreateBoard = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    try {
      const response = await api.post('/boards', { name });
      setName('');
      navigate(`/boards/${response.data.board._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create board');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-400">Workspace</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
              {user?.name}
            </div>
            <button type="button" onClick={handleLogout} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <form onSubmit={handleCreateBoard} className="mb-8 flex flex-col gap-3 md:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Board name"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <button type="submit" className="rounded-xl bg-indigo-500 px-5 py-3 font-medium text-white">
            Create board
          </button>
        </form>

        {error ? <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        {loading ? (
          <div className="text-slate-400">Loading boards...</div>
        ) : boards.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {boards.map((board) => (
              <BoardList key={board._id} board={board} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
            No boards yet. Create your first board to get started.
          </div>
        )}
      </main>
    </div>
  );
}
