import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { requireBoardPermission } from '../middleware/permissions.js';
import { createList, deleteList, getLists, reorderLists, updateList } from '../controllers/listController.js';
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
router.get('/', requireBoardPermission('viewer'), getLists);
router.post('/', requireBoardPermission('member'), createList);
router.patch('/:listId', requireBoardPermission('member'), updateList);
router.delete('/:listId', requireBoardPermission('member'), deleteList);
router.post('/reorder', requireBoardPermission('member'), reorderLists);

export default router;
