import Card from '../models/Card.js';
import List from '../models/List.js';
import { addBoardActivity } from '../utils/activity.js';
import { createPosition, movePosition, rebalancePositions } from '../utils/position.js';
import { emitBoardEvent } from '../sockets/index.js';

export async function createCard(req, res) {
  const { title } = req.body;
  const list = await List.findById(req.params.listId);
  if (!list) {
    return res.status(404).json({ message: 'List not found' });
  }

  const cards = await Card.find({ board: list.board, list: list._id }).sort({ position: 1 });
  const position = cards.length ? createPosition(cards[cards.length - 1].position, cards[cards.length - 1].position + 1000) : 1000;

  const card = await Card.create({
    board: list.board,
    list: list._id,
    title: title || 'New card',
    description: '',
    position,
    labels: [],
    assignees: [],
    comments: []
  });

  await addBoardActivity(list.board, req.user._id, 'card created', `${req.user.name} created ${card.title}`);
  emitBoardEvent(list.board, 'board:updated', { type: 'card:created', card });
  return res.status(201).json({ card });
}

export async function updateCard(req, res) {
  const card = await Card.findById(req.params.cardId);
  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  const { title, description, labels, assignees, dueDate } = req.body;
  if (title) card.title = title;
  if (description !== undefined) card.description = description;
  if (labels) card.labels = labels;
  if (assignees !== undefined) {
    if (!Array.isArray(assignees)) {
      return res.status(400).json({ message: 'Assignees must be an array' });
    }

    const boardMemberIds = req.board.members.map((member) => String(member.user));
    if (assignees.some((assignee) => !boardMemberIds.includes(String(assignee)))) {
      return res.status(400).json({ message: 'Assignees must be board members' });
    }

    card.assignees = assignees;
  }

  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === '') {
      card.dueDate = null;
    } else {
      const parsedDueDate = new Date(dueDate);
      if (!Number.isFinite(parsedDueDate.getTime())) {
        return res.status(400).json({ message: 'Due date is invalid' });
      }
      card.dueDate = parsedDueDate;
    }
  }

  await card.save();
  await addBoardActivity(card.board, req.user._id, 'card updated', `${req.user.name} updated ${card.title}`);
  emitBoardEvent(card.board, 'board:updated', { type: 'card:updated', card });

  return res.json({ card });
}

export async function deleteCard(req, res) {
  const card = await Card.findById(req.params.cardId);
  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  await Card.deleteOne({ _id: card._id });
  await addBoardActivity(card.board, req.user._id, 'card deleted', `${req.user.name} deleted ${card.title}`);
  emitBoardEvent(card.board, 'board:updated', { type: 'card:deleted', cardId: card._id.toString() });

  return res.json({ success: true });
}

export async function addComment(req, res) {
  const { text } = req.body;
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  if (!normalizedText) {
    return res.status(400).json({ message: 'Comment cannot be empty' });
  }

  const card = await Card.findById(req.params.cardId);
  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  card.comments.push({
    user: req.user._id,
    text: normalizedText
  });
  await card.save();

  const freshCard = await Card.findById(card._id).populate('comments.user', 'name email avatarColor');
  await addBoardActivity(card.board, req.user._id, 'comment added', `${req.user.name} commented on ${card.title}`);
  emitBoardEvent(card.board, 'board:updated', { type: 'comment:added', card: freshCard });

  return res.status(201).json({ card: freshCard });
}

export async function moveCard(req, res) {
  const { listId, targetPosition } = req.body;
  const card = await Card.findById(req.params.cardId);
  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  const fromList = card.list;
  const nextListId = listId || fromList;
  const targetList = await List.findById(nextListId);
  if (!targetList) {
    return res.status(404).json({ message: 'List not found' });
  }

  const cards = await Card.find({ board: card.board, list: nextListId }).sort({ position: 1 });
  const sorted = cards.filter((entry) => String(entry._id) !== String(card._id));
  const targetPos = movePosition(sorted.map((entry) => entry.position), card.position, targetPosition);

  card.list = nextListId;
  card.position = targetPos;
  await card.save();

  const listCards = await Card.find({ board: card.board, list: nextListId }).sort({ position: 1 });
  const positions = listCards.map((entry) => entry.position);
  const rebalance = rebalancePositions(positions);
  if (rebalance.length && rebalance[0] !== positions[0]) {
    for (let index = 0; index < listCards.length; index += 1) {
      listCards[index].position = rebalance[index];
      await listCards[index].save();
    }
  }

  if (fromList.toString() !== nextListId.toString()) {
    const previousList = await Card.find({ board: card.board, list: fromList }).sort({ position: 1 });
    const previousPositions = rebalancePositions(previousList.map((entry) => entry.position));
    for (let index = 0; index < previousList.length; index += 1) {
      previousList[index].position = previousPositions[index] || 1000;
      await previousList[index].save();
    }
  }

  await addBoardActivity(card.board, req.user._id, 'card moved', `${req.user.name} moved ${card.title}`);
  const updatedCard = await Card.findById(card._id);
  emitBoardEvent(card.board, 'board:updated', { type: 'card:moved', card: updatedCard });
  return res.json({ card: updatedCard });
}

export async function reorderCards(req, res) {
  const { fromId, toId, listId } = req.body;
  const list = await List.findById(listId || req.params.listId);
  if (!list) {
    return res.status(404).json({ message: 'List not found' });
  }

  const cards = await Card.find({ board: list.board, list: list._id }).sort({ position: 1 });
  const fromCard = cards.find((card) => String(card._id) === String(fromId));
  const toCard = cards.find((card) => String(card._id) === String(toId));

  if (!fromCard || !toCard) {
    return res.status(404).json({ message: 'Card not found' });
  }

  const targetPosition = createPosition(toCard.position - 1000, toCard.position + 1000);
  fromCard.position = targetPosition;
  await fromCard.save();

  const updated = await Card.find({ board: list.board, list: list._id }).sort({ position: 1 });
  const newPositions = rebalancePositions(updated.map((entry) => entry.position));
  for (let index = 0; index < updated.length; index += 1) {
    updated[index].position = newPositions[index] || 1000;
    await updated[index].save();
  }

  await addBoardActivity(list.board, req.user._id, 'card reordered', `${req.user.name} reordered cards`);
  const updatedCards = await Card.find({ board: list.board, list: list._id }).sort({ position: 1 });
  emitBoardEvent(list.board, 'board:updated', { type: 'card:reordered', cards: updatedCards });
  return res.json({ cards: updatedCards });
}
