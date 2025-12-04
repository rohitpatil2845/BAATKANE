import { useEffect, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import api from '../services/api';
import socketService from '../services/socket';
import toast from 'react-hot-toast';

// Components
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import EmptyState from '../components/EmptyState';

export default function Home() {
  const { chats, setChats, currentChat, setCurrentChat, addChat, addMessage, setUserOnline, setTyping } = useChatStore();
  const { user } = useAuthStore();
  const { isSidebarOpen } = useUIStore();
  const [loading, setLoading] = useState(true);

  // Load chats on mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        const response = await api.get('/chats');
        setChats(response.data.chats);
      } catch (error) {
        toast.error('Failed to load chats');
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [setChats]);

  // Setup socket listeners
  useEffect(() => {
    if (!user) return;

    // New chat created (including groups)
    socketService.on('new_chat', ({ chat }) => {
      addChat(chat);
      if (chat.isGroup) {
        toast.success(`Added to group: ${chat.groupName}`);
      } else {
        toast.success('New chat created');
      }
    });

    // New message
    socketService.on('new_message', ({ message }) => {
      addMessage(message);
      
      // Increment unread count if message is not from current user and chat is not currently open
      const { currentChat: currentChatState } = useChatStore.getState();
      if (message.userId !== user.id && (!currentChatState || currentChatState.id !== message.chatId)) {
        const { chats } = useChatStore.getState();
        const updatedChats = chats.map(chat => 
          chat.id === message.chatId 
            ? { ...chat, unreadCount: (chat.unreadCount || 0) + 1, lastMessage: message }
            : chat
        );
        useChatStore.getState().setChats(updatedChats);
      }
    });

    // User typing
    socketService.on('user_typing', ({ chatId, userId, isTyping }) => {
      if (userId !== user.id) {
        setTyping(chatId, userId, isTyping);
      }
    });

    // User online/offline
    socketService.on('user_online', ({ userId }) => {
      setUserOnline(userId, true);
    });

    socketService.on('user_offline', ({ userId }) => {
      setUserOnline(userId, false);
    });

    // Message delivered
    socketService.on('message_delivered', ({ messageId, userId }) => {
      useChatStore.getState().updateMessage(messageId, {
        deliveredTo: [...(useChatStore.getState().messages[useChatStore.getState().currentChat?.id || '']?.find(m => m.id === messageId)?.deliveredTo || []), userId]
      });
    });

    // Message read
    socketService.on('message_read', ({ messageId, userId, readAt }) => {
      const state = useChatStore.getState();
      const currentChatId = state.currentChat?.id;
      if (!currentChatId) return;
      
      const message = state.messages[currentChatId]?.find(m => m.id === messageId);
      if (!message) return;
      
      const existingReadBy = message.readBy || [];
      const alreadyRead = existingReadBy.some(r => r.userId === userId);
      
      if (!alreadyRead) {
        state.updateMessage(messageId, {
          readBy: [...existingReadBy, { userId, userName: '', username: '', readAt }]
        });
      }
    });

    // Removed from group
    socketService.on('removed_from_group', ({ chatId, groupName }) => {
      toast.error(`You were removed from ${groupName}`);
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
      setCurrentChat(prevChat => prevChat?.id === chatId ? null : prevChat);
    });

    // Member left group
    socketService.on('member_left_group', async () => {
      // Refresh chats to update member count
      try {
        const response = await api.get('/chats');
        setChats(response.data.chats);
      } catch (error) {
        console.error('Failed to refresh chats:', error);
      }
    });

    return () => {
      socketService.off('new_chat');
      socketService.off('new_message');
      socketService.off('user_typing');
      socketService.off('user_online');
      socketService.off('user_offline');
      socketService.off('message_delivered');
      socketService.off('message_read');
      socketService.off('removed_from_group');
      socketService.off('member_left_group');
    };
  }, [user, addChat, addMessage, setTyping, setUserOnline, setChats, setCurrentChat]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <main className="flex-1 flex">
        {currentChat ? <ChatWindow /> : <EmptyState />}
      </main>
    </div>
  );
}
