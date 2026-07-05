// src/hooks/useWebSocket.ts

'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

let globalSocket: Socket | null = null;

export const useWebSocket = (): WebSocketContextType => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (globalSocket) {
      socketRef.current = globalSocket;
      setIsConnected(globalSocket.connected);
      return;
    }

    // Connect to WebSocket server
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      const rawUser = localStorage.getItem('authUser');
      const user = rawUser ? JSON.parse(rawUser) : null;
      if (user?.companyId) {
        socket.emit('join:company', user.companyId);
      }
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('error', () => {
      setIsConnected(false);
    });

    socketRef.current = socket;
    globalSocket = socket;

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
};

