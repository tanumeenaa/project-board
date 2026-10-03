export const BOARD_ROLES = ['admin', 'member', 'viewer'];

export function getBoardRole(member) {
  return member?.role || 'viewer';
}

export function canManageBoard(member) {
  return getBoardRole(member) === 'admin';
}

export function canWriteBoard(member) {
  return ['admin', 'member'].includes(getBoardRole(member));
}

export function getBoardMemberRole(board, userId) {
  if (!board || !board.members || !userId) {
    return null;
  }

  const member = board.members.find((entry) => {
    const memberUserId = entry.user && typeof entry.user === 'object' ? entry.user._id : entry.user;
    return String(memberUserId) === String(userId);
  });

  return member ? member.role : null;
}

export function requireBoardMembership(board, userId) {
  const role = getBoardMemberRole(board, userId);
  if (!role) {
    return { allowed: false, role: null, message: 'You are not a member of this board' };
  }

  return { allowed: true, role };
}

export function requireBoardPermission(requiredRole = 'viewer') {
  return (req, res, next) => {
    const board = req.board;
    const userId = req.user?._id || req.user?.id;
    const outcome = requireBoardMembership(board, userId);

    if (!outcome.allowed) {
      return res.status(403).json({ message: outcome.message });
    }

    const role = outcome.role;
    const roles = ['viewer', 'member', 'admin'];
    const currentIndex = roles.indexOf(role);
    const requiredIndex = roles.indexOf(requiredRole);

    if (currentIndex < requiredIndex) {
      return res.status(403).json({ message: 'You do not have access to this action' });
    }

    next();
  };
}
