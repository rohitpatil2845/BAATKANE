import { create } from 'zustand';

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  content: string;
  type: string;
  fileUrl?: string;
  fileName?: string;
  isPinned: boolean;
  isDeleted: boolean;
  replyTo?: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  deliveredTo?: string[]; // Array of user IDs who received the message
  readBy?: Array<{
    userId: string;
    userName: string;
    username: string;
    readAt: Date;
  }>;
  messageReads?: Array<{
    userId: string;
    readAt: Date;
  }>;
}

export interface Chat {
  id: string;
  isGroup: boolean;
  groupName?: string;
  groupIcon?: string;
  description?: string;
  adminId?: string;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    isMuted: boolean;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      lastSeen?: Date;
    };
  }>;
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatState {
  chats: Chat[];
  currentChat: Chat | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  onlineUsers: Set<string>;

  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  setCurrentChat: (chat: Chat | null) => void;
  
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;
  clearUnreadCount: (chatId: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  currentChat: null,
  messages: {},
  typingUsers: {},
  onlineUsers: new Set(),

  setChats: (chats) => set({ chats }),
  
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
  
  setCurrentChat: (chat) => set({ currentChat: chat }),
  
  setMessages: (chatId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [chatId]: messages },
    })),
  
  addMessage: (message) =>
    set((state) => {
      const chatMessages = state.messages[message.chatId] || [];
      return {
        messages: {
          ...state.messages,
          [message.chatId]: [...chatMessages, message],
        },
      };
    }),
  
  updateMessage: (messageId, updates) =>
    set((state) => {
      const newMessages = { ...state.messages };
      Object.keys(newMessages).forEach((chatId) => {
        newMessages[chatId] = newMessages[chatId].map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
      });
      return { messages: newMessages };
    }),
  
  setTyping: (chatId, userId, isTyping) =>
    set((state) => {
      const currentTyping = state.typingUsers[chatId] || [];
      const newTyping = isTyping
        ? [...currentTyping.filter((id) => id !== userId), userId]
        : currentTyping.filter((id) => id !== userId);
      
      return {
        typingUsers: { ...state.typingUsers, [chatId]: newTyping },
      };
    }),
  
  setUserOnline: (userId, isOnline) =>
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      if (isOnline) {
        newOnlineUsers.add(userId);
      } else {
        newOnlineUsers.delete(userId);
      }
      return { onlineUsers: newOnlineUsers };
    }),

  clearUnreadCount: (chatId) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      ),
    })),

  reset: () => set({
    chats: [],
    currentChat: null,
    messages: {},
    typingUsers: {},
    onlineUsers: new Set(),
  }),
}));
