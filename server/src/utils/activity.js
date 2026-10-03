import Activity from '../models/Activity.js';

export async function addBoardActivity(boardId, userId, action, details = '') {
  if (!boardId || !userId) {
    return null;
  }

  const activity = await Activity.create({
    board: boardId,
    user: userId,
    action,
    details
  });

  return activity.populate('user', 'name email avatarColor');
}
