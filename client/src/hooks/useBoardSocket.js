import { useEffect, useLayoutEffect, useRef } from 'react';
import { io } from 'socket.io-client';

import { socketUrl } from '../config.js';

export function useBoardSocket({ boardId, user, onPresence, onBoardEvent }) {
  const socketRef = useRef(null);
  const callbacksRef = useRef({ onPresence, onBoardEvent });

  useLayoutEffect(() => {
    callbacksRef.current = { onPresence, onBoardEvent };
  });

  useEffect(() => {
    if (!boardId || !user) {
      return undefined;
    }

    const socket = io(socketUrl, {
      auth: {
        token: localStorage.getItem('project-board-token')
      }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('board:join', { boardId });
    });

    socket.on('board:updated', (...args) => callbacksRef.current.onBoardEvent(...args));
    socket.on('presence:update', (...args) => callbacksRef.current.onPresence(...args));
    socket.on('board:error', (response) => {
      console.error(response.message);
    });

    return () => {
      socket.emit('board:leave', { boardId });
      socket.disconnect();
    };
  }, [boardId, user]);

  return socketRef;
}
