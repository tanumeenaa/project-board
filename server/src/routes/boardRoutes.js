import { Router } from 'express';
import Board from '../models/Board.js';
import { requireAuth } from '../middleware/auth.js';
import { requireBoardPermission, requireBoardMembership } from '../middleware/permissions.js';
import {
  createBoard,
  deleteBoard,
  getBoardDetails,
  getBoards,
  inviteMember,
  removeMember,
  updateBoard,
  updateMemberRole
} from '../controllers/boardController.js';

const router = Router();

async function loadBoard(req, res, next) {
  const board = await Board.findById(req.params.boardId)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor');

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  req.board = board;
  const membership = requireBoardMembership(board, req.user._id);
  if (!membership.allowed) {
    return res.status(403).json({ message: membership.message });
  }
  next();
}

router.use(requireAuth);
router.get('/', getBoards);
router.post('/', createBoard);
router.get('/:boardId', loadBoard, requireBoardPermission('viewer'), getBoardDetails);
router.patch('/:boardId', loadBoard, requireBoardPermission('admin'), updateBoard);
router.delete('/:boardId', loadBoard, requireBoardPermission('admin'), deleteBoard);
router.post('/:boardId/members', loadBoard, requireBoardPermission('admin'), inviteMember);
router.patch('/:boardId/members/:memberId', loadBoard, requireBoardPermission('admin'), updateMemberRole);
router.delete('/:boardId/members/:memberId', loadBoard, requireBoardPermission('admin'), removeMember);

export default router;
