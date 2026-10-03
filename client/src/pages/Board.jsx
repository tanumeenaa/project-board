import { DndContext, PointerSensor, pointerWithin, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import ActivityPanel from '../components/ActivityPanel.jsx';
import Card from '../components/Card.jsx';
import CardModal from '../components/CardModal.jsx';
import MembersModal from '../components/MembersModal.jsx';
import PresenceBar from '../components/PresenceBar.jsx';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useBoardSocket } from '../hooks/useBoardSocket.js';

function boardCollisionDetection(args) {
  const collisions = pointerWithin(args);
  const cardCollisions = collisions.filter((collision) => {
    const container = args.droppableContainers.find((entry) => String(entry.id) === String(collision.id));
    return container?.data.current?.type === 'card';
  });

  return cardCollisions.length ? cardCollisions : collisions;
}

function DroppableList({ listId, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `list-${listId}`,
    data: { type: 'list', listId }
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-[320px] shrink-0 rounded-2xl border bg-slate-900 p-3 ${isOver ? 'border-indigo-400' : 'border-slate-800'}`}
    >
      {children}
    </div>
  );
}

function positionAtIndex(sortedCards, index) {
  const previous = sortedCards[index - 1]?.position;
  const next = sortedCards[index]?.position;

  if (previous === undefined && next === undefined) {
    return 1000;
  }
  if (previous === undefined) {
    return next > 0 ? next / 2 : next - 1000;
  }
  if (next === undefined) {
    return previous + 1000;
  }
  return previous + (next - previous) / 2;
}

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [activities, setActivities] = useState([]);
  const [presence, setPresence] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newListTitle, setNewListTitle] = useState('');
  const [newCardTitle, setNewCardTitle] = useState({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const refreshBoard = async () => {
    try {
      const response = await api.get(`/boards/${boardId}`);
      setBoard(response.data.board);
      setLists(response.data.lists || []);
      setCards(response.data.cards || []);
      setActivities(response.data.activities || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBoard();
  }, [boardId]);

  const boardRole = useMemo(() => {
    if (!board || !user) {
      return 'viewer';
    }

    const member = board.members?.find((entry) => String(entry.user._id || entry.user) === String(user._id));
    return member?.role || 'viewer';
  }, [board, user]);

  const canWrite = ['admin', 'member'].includes(boardRole);

  const handleBoardEvent = () => {
    refreshBoard();
  };

  const handlePresence = (users) => {
    setPresence(users || []);
  };

  useBoardSocket({ boardId, user, onPresence: handlePresence, onBoardEvent: handleBoardEvent });

  const handleCreateList = async () => {
    if (!newListTitle.trim()) {
      return;
    }

    try {
      await api.post(`/boards/${boardId}`, { title: newListTitle });
      setNewListTitle('');
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create list');
    }
  };

  const handleCreateCard = async (listId) => {
    const title = (newCardTitle[listId] || '').trim();
    if (!title) {
      return;
    }

    try {
      await api.post(`/boards/${boardId}/lists/${listId}/cards`, { title });
      setNewCardTitle((current) => ({ ...current, [listId]: '' }));
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create card');
    }
  };

  const handleCardSave = async (updates) => {
    if (!selectedCard) {
      return;
    }

    try {
      const response = await api.patch(`/boards/${boardId}/cards/${selectedCard._id}`, updates);
      setSelectedCard(response.data.card);
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update card');
    }
  };

  const handleComment = async (text) => {
    if (!selectedCard || !text.trim()) {
      return;
    }

    try {
      const response = await api.post(`/boards/${boardId}/cards/${selectedCard._id}/comments`, { text });
      setSelectedCard(response.data.card);
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to add comment');
    }
  };

  const handleInvite = async ({ email, role }) => {
    try {
      await api.post(`/boards/${boardId}/members`, { email, role });
      setMembersOpen(false);
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to invite member');
    }
  };

  const handleRoleChange = async (memberId, role) => {
    try {
      await api.patch(`/boards/${boardId}/members/${memberId}`, { role });
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to change role');
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await api.delete(`/boards/${boardId}/members/${memberId}`);
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleListReorder = async (listId, direction) => {
    const ordered = [...lists].sort((first, second) => first.position - second.position);
    const index = ordered.findIndex((entry) => String(entry._id) === String(listId));
    const target = ordered[index + direction];

    if (!target) {
      return;
    }

    try {
      await api.post(`/boards/${boardId}/lists/reorder`, { fromId: listId, toId: target._id });
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to reorder list');
    }
  };

  const handleDeleteCard = async (cardId) => {
    try {
      await api.delete(`/boards/${boardId}/cards/${cardId}`);
      setSelectedCard(null);
      refreshBoard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to delete card');
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeCard = cards.find((card) => String(card._id) === String(active.id));
    if (!activeCard) {
      return;
    }

    const overCard = cards.find((card) => String(card._id) === String(over.id));
    const targetListId = over.data.current?.type === 'list'
      ? over.data.current.listId
      : overCard?.list;
    if (!targetListId) {
      return;
    }

    const targetCards = cards
      .filter((card) => String(card.list) === String(targetListId) && String(card._id) !== String(activeCard._id))
      .sort((first, second) => first.position - second.position);
    let targetIndex = targetCards.length;

    if (overCard && String(overCard.list) === String(targetListId)) {
      const overIndex = targetCards.findIndex((card) => String(card._id) === String(overCard._id));
      const activeRect = active.rect.current.translated;
      const droppedAfter = activeRect
        && activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2;
      targetIndex = overIndex + (droppedAfter ? 1 : 0);
    }

    const targetPosition = positionAtIndex(targetCards, targetIndex);
    const previousSnapshot = [...cards];
    setCards((current) => current.map((card) => (
      String(card._id) === String(activeCard._id)
        ? { ...card, list: targetListId, position: targetPosition }
        : card
    )));

    try {
      await api.post(`/boards/${boardId}/cards/${activeCard._id}/move`, {
        listId: targetListId,
        targetPosition
      });
      refreshBoard();
    } catch (requestError) {
      setCards(previousSnapshot);
      setError(requestError.response?.data?.message || 'Move failed');
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading board...</div>;
  }

  if (!board) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Board not found</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <button type="button" onClick={() => navigate('/dashboard')} className="text-sm text-slate-400 hover:text-white">
              ← Dashboard
            </button>
            <h1 className="mt-2 text-3xl font-semibold text-white">{board.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <PresenceBar users={presence} />
            <button type="button" onClick={() => setMembersOpen(true)} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200">
              Members
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error ? <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <input
              value={newListTitle}
              onChange={(event) => setNewListTitle(event.target.value)}
              placeholder="New list title"
              className="w-64 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none placeholder:text-slate-500"
            />
            <button type="button" onClick={handleCreateList} disabled={!canWrite} className="rounded-xl bg-indigo-500 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
              Add list
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex-1 overflow-x-auto">
            <DndContext collisionDetection={boardCollisionDetection} sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex min-h-[70vh] gap-4">
                {lists.map((list) => {
                  const listCards = cards
                    .filter((card) => String(card.list) === String(list._id))
                    .sort((first, second) => first.position - second.position);

                  return (
                    <DroppableList key={list._id} listId={list._id}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold text-white">{list.title}</h2>
                        {canWrite ? (
                          <div className="flex gap-1">
                            <button type="button" onClick={() => handleListReorder(list._id, -1)} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">←</button>
                            <button type="button" onClick={() => handleListReorder(list._id, 1)} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">→</button>
                          </div>
                        ) : null}
                      </div>

                      <SortableContext items={listCards.map((card) => card._id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {listCards.map((card) => (
                            <Card key={card._id} card={card} onClick={setSelectedCard} />
                          ))}
                        </div>
                      </SortableContext>

                      {canWrite ? (
                        <div className="mt-4 space-y-2">
                          <input
                            value={newCardTitle[list._id] || ''}
                            onChange={(event) => setNewCardTitle((current) => ({ ...current, [list._id]: event.target.value }))}
                            placeholder="Card title"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                          />
                          <button type="button" onClick={() => handleCreateCard(list._id)} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
                            Add card
                          </button>
                        </div>
                      ) : null}
                    </DroppableList>
                  );
                })}
              </div>
            </DndContext>
          </div>

          <ActivityPanel activities={activities} />
        </div>
      </main>

      {selectedCard ? (
        <CardModal
          card={selectedCard}
          currentUser={user}
          onClose={() => setSelectedCard(null)}
          onSave={handleCardSave}
          onComment={handleComment}
          onDelete={() => handleDeleteCard(selectedCard._id)}
        />
      ) : null}

      {membersOpen ? (
        <MembersModal
          board={board}
          onClose={() => setMembersOpen(false)}
          onInvite={handleInvite}
          onRoleChange={handleRoleChange}
          onRemove={handleRemoveMember}
        />
      ) : null}
    </div>
  );
}
