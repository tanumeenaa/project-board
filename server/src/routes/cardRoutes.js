import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { requireBoardPermission } from '../middleware/permissions.js';
import {
  addComment,
  createCard,
  deleteCard,
  moveCard,
  reorderCards,
  updateCard
} from '../controllers/cardController.js';
import Board from '../models/Board.js';

const router = Router({ mergeParams: true });

async function loadBoard(req, res, next) {
  const board = await Board.findById(req.params.boardId);
  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }
  req.board = board;
  next();
}

router.use(requireAuth, loadBoard);
router.post('/lists/:listId/cards', requireBoardPermission('member'), createCard);
router.patch('/cards/:cardId', requireBoardPermission('member'), updateCard);
router.delete('/cards/:cardId', requireBoardPermission('member'), deleteCard);
router.post('/cards/:cardId/comments', requireBoardPermission('member'), addComment);
router.post('/cards/:cardId/move', requireBoardPermission('member'), moveCard);
router.post('/lists/:listId/reorder-cards', requireBoardPermission('member'), reorderCards);

export default router;
