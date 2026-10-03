export function getSocketServer() {
  return globalThis.io || null;
}

export function emitBoardEvent(boardId, event, payload) {
  const io = getSocketServer();
  if (!io || !boardId) {
    return;
  }

  io.to(String(boardId)).emit(event, payload);
}
