import List from '../models/List.js';
import Card from '../models/Card.js';
import { addBoardActivity } from '../utils/activity.js';
import { createPosition, rebalancePositions } from '../utils/position.js';
import { emitBoardEvent } from '../sockets/index.js';

export async function getLists(req, res) {
  const lists = await List.find({ board: req.params.boardId }).sort({ position: 1 });
  return res.json({ lists });
}

export async function createList(req, res) {
  const { title } = req.body;
  const boardId = req.params.boardId;

  const existing = await List.find({ board: boardId }).sort({ position: 1 });
  const position = existing.length ? createPosition(existing[existing.length - 1].position, existing[existing.length - 1].position + 1000) : 1000;

  const list = await List.create({ board: boardId, title: title || 'New list', position });
  await addBoardActivity(boardId, req.user._id, 'list created', `${req.user.name} created ${list.title}`);
  emitBoardEvent(boardId, 'board:updated', { type: 'list:created', list });
  return res.status(201).json({ list });
}

export async function updateList(req, res) {
  const { title } = req.body;
  const list = await List.findById(req.params.listId);
  if (!list) {
    return res.status(404).json({ message: 'List not found' });
  }

  list.title = title || list.title;
  await list.save();

  await addBoardActivity(list.board, req.user._id, 'list updated', `${req.user.name} updated ${list.title}`);
  emitBoardEvent(list.board, 'board:updated', { type: 'list:updated', list });
  return res.json({ list });
}

export async function deleteList(req, res) {
  const list = await List.findById(req.params.listId);
  if (!list) {
    return res.status(404).json({ message: 'List not found' });
  }

  await Card.deleteMany({ list: list._id });
  await List.deleteOne({ _id: list._id });
  await addBoardActivity(list.board, req.user._id, 'list deleted', `${req.user.name} deleted ${list.title}`);
  emitBoardEvent(list.board, 'board:updated', { type: 'list:deleted', listId: list._id.toString() });

  return res.json({ success: true });
}

export async function reorderLists(req, res) {
  const { fromId, toId } = req.body;
  const lists = await List.find({ board: req.params.boardId }).sort({ position: 1 });
  const fromList = lists.find((list) => String(list._id) === String(fromId));
  const toList = lists.find((list) => String(list._id) === String(toId));

  if (!fromList || !toList) {
    return res.status(404).json({ message: 'List not found' });
  }

  const currentPositions = lists.map((list) => list.position);
  const before = lists.filter((list) => list.position < fromList.position).at(-1);
  const after = lists.filter((list) => list.position > fromList.position).at(0);

  const newPosition = createPosition(before ? before.position : 0, after ? after.position : fromList.position + 1000);
  fromList.position = newPosition;
  await fromList.save();

  const allPositions = lists.map((list) => list.position);
  const rebalanced = rebalancePositions(allPositions);
  if (Math.abs(rebalanced[0] - allPositions[0]) > 0.001 || rebalanced.length !== allPositions.length) {
    for (let index = 0; index < lists.length; index += 1) {
      lists[index].position = rebalanced[index];
      await lists[index].save();
    }
  }

  await addBoardActivity(req.params.boardId, req.user._id, 'list reordered', `${req.user.name} reordered lists`);
  const updatedLists = await List.find({ board: req.params.boardId }).sort({ position: 1 });
  emitBoardEvent(req.params.boardId, 'board:updated', { type: 'list:reordered', lists: updatedLists });
  return res.json({ lists: updatedLists });
}
