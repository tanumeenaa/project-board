import Board from '../models/Board.js';
import User from '../models/User.js';
import List from '../models/List.js';
import Card from '../models/Card.js';
import Activity from '../models/Activity.js';
import { addBoardActivity } from '../utils/activity.js';
import { emitBoardEvent } from '../sockets/index.js';

export async function getBoards(req, res) {
  const boards = await Board.find({
    $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
  })
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor')
    .sort({ updatedAt: -1 });

  return res.json({ boards });
}

export async function createBoard(req, res) {
  const { name } = req.body;

  const board = await Board.create({
    name: name || 'Untitled Board',
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'admin' }]
  });

  await addBoardActivity(board._id, req.user._id, 'board created', `Created board ${board.name}`);

  const fullBoard = await Board.findById(board._id)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor');

  emitBoardEvent(board._id, 'board:updated', { type: 'board:created', board: fullBoard });

  return res.status(201).json({ board: fullBoard });
}

export async function getBoardDetails(req, res) {
  const board = await Board.findById(req.params.boardId)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor');

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const lists = await List.find({ board: board._id }).sort({ position: 1 });
  const cards = await Card.find({ board: board._id }).sort({ position: 1 });
  const activities = await Activity.find({ board: board._id }).sort({ createdAt: -1 }).limit(20).populate('user', 'name email avatarColor');

  return res.json({ board, lists, cards, activities });
}

export async function updateBoard(req, res) {
  const { name } = req.body;
  const board = await Board.findById(req.params.boardId);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  board.name = name || board.name;
  await board.save();

  await addBoardActivity(board._id, req.user._id, 'board renamed', `Renamed board to ${board.name}`);

  const fullBoard = await Board.findById(board._id)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor');

  emitBoardEvent(board._id, 'board:updated', { type: 'board:updated', board: fullBoard });

  return res.json({ board: fullBoard });
}

export async function deleteBoard(req, res) {
  const board = await Board.findById(req.params.boardId);
  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  await List.deleteMany({ board: board._id });
  await Card.deleteMany({ board: board._id });
  await Activity.deleteMany({ board: board._id });
  await Board.deleteOne({ _id: board._id });

  await addBoardActivity(board._id, req.user._id, 'board deleted', 'Board was deleted');

  return res.json({ success: true });
}

export async function inviteMember(req, res) {
  const { email, role } = req.body;
  const board = await Board.findById(req.params.boardId);
  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const existingMember = board.members.find((entry) => String(entry.user) === String(user._id));
  if (existingMember) {
    return res.status(409).json({ message: 'User already on board' });
  }

  board.members.push({ user: user._id, role: role || 'member' });
  await board.save();

  await addBoardActivity(board._id, req.user._id, 'member invited', `${user.name} was invited as ${role || 'member'}`);

  const boardWithMembers = await Board.findById(board._id)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor');

  emitBoardEvent(board._id, 'board:updated', { type: 'member:invited', board: boardWithMembers });

  return res.status(201).json({ board: boardWithMembers });
}

export async function updateMemberRole(req, res) {
  const { memberId } = req.params;
  const { role } = req.body;
  const board = await Board.findById(req.params.boardId);

  const member = board.members.find((entry) => String(entry.user) === String(memberId));
  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  member.role = role;
  await board.save();

  const boardWithMembers = await Board.findById(board._id)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor');

  emitBoardEvent(board._id, 'board:updated', { type: 'member:updated', board: boardWithMembers });

  return res.json({ board: boardWithMembers });
}

export async function removeMember(req, res) {
  const { memberId } = req.params;
  const board = await Board.findById(req.params.boardId);

  board.members = board.members.filter((entry) => String(entry.user) !== String(memberId));
  await board.save();

  const boardWithMembers = await Board.findById(board._id)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor');

  emitBoardEvent(board._id, 'board:updated', { type: 'member:removed', board: boardWithMembers });

  return res.json({ board: boardWithMembers });
}
