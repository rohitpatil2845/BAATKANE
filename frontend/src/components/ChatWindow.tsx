import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import socketService from '../services/socket';
import api from '../services/api';
import { Send, Paperclip, Smile, MoreVertical, Phone, Video, Users, X, UserMinus, LogOut, Check, Forward, Clock, Circle } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function ChatWindow() {
  const { currentChat, messages, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMessageToForward, setSelectedMessageToForward] = useState<string | null>(null);
  const [selectedChatsToForward, setSelectedChatsToForward] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😭', '😡', '👍', '👎', '🙏', '💪', '🎉', '❤️', '🔥', '✨', '💯', '👋', '🤝'];

  const chatMessages = currentChat ? messages[currentChat.id] || [] : [];
  const chatTypingUsers = currentChat ? typingUsers[currentChat.id] || [] : [];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Join chat room and mark messages as delivered/read
  useEffect(() => {
    if (currentChat) {
      socketService.joinChat(currentChat.id);
      
      // Mark all unread messages as delivered
      chatMessages.forEach(message => {
        if (message.userId !== user?.id) {
          const deliveredTo = message.deliveredTo || [];
          if (!deliveredTo.includes(user?.id || '')) {
            socketService.emit('message_delivered', { messageId: message.id, chatId: currentChat.id });
          }
        }
      });
    }
  }, [currentChat]);

  // Mark messages as read when viewing them
  useEffect(() => {
    if (!currentChat || !user) return;

    const markMessagesAsRead = () => {
      chatMessages.forEach(message => {
        if (message.userId !== user.id) {
          const alreadyRead = message.readBy?.some(r => r.userId === user.id) || false;
          if (!alreadyRead) {
            socketService.emit('mark_read', { messageId: message.id, chatId: currentChat.id });
          }
        }
      });
    };

    // Mark as read after a short delay (simulating user actually seeing the messages)
    const timer = setTimeout(markMessagesAsRead, 500);
    return () => clearTimeout(timer);
  }, [chatMessages.length, currentChat?.id, user?.id]);

  const handleTyping = (value: string) => {
    setMessageInput(value);

    if (!currentChat || !value.trim()) return;

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socketService.typing(currentChat.id, true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.typing(currentChat.id, false);
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !currentChat) return;

    socketService.sendMessage({
      chatId: currentChat.id,
      content: messageInput.trim(),
      type: 'text',
    });

    setMessageInput('');
    setIsTyping(false);
    setShowEmojiPicker(false);
    socketService.typing(currentChat.id, false);
  };

  const handleEmojiClick = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, just show filename in message
    setMessageInput(prev => `${prev} 📎 ${file.name}`);
  };

  const loadJoinRequests = async () => {
    if (!currentChat || currentChat.adminId !== user?.id) return;

    setLoadingRequests(true);
    try {
      const response = await api.get(`/chats/${currentChat.id}/join-requests`);
      setJoinRequests(response.data.requests);
    } catch (error) {
      console.error('Failed to load join requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (showMembersModal && currentChat?.isGroup && currentChat.adminId === user?.id) {
      loadJoinRequests();
    }
  }, [showMembersModal, currentChat, user]);

  // Listen for join request events
  useEffect(() => {
    const handleJoinRequestReceived = () => {
      if (showMembersModal && currentChat?.isGroup && currentChat.adminId === user?.id) {
        loadJoinRequests();
      }
    };

    const handleJoinRequestStatusChange = () => {
      if (showMembersModal && currentChat?.isGroup && currentChat.adminId === user?.id) {
        loadJoinRequests();
      }
    };

    socketService.on('join_request_received', handleJoinRequestReceived);
    socketService.on('join_request_approved', handleJoinRequestStatusChange);
    socketService.on('join_request_rejected', handleJoinRequestStatusChange);

    return () => {
      socketService.off('join_request_received', handleJoinRequestReceived);
      socketService.off('join_request_approved', handleJoinRequestStatusChange);
      socketService.off('join_request_rejected', handleJoinRequestStatusChange);
    };
  }, [showMembersModal, currentChat, user]);

  const handleJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!currentChat) return;

    try {
      await api.patch(`/chats/${currentChat.id}/join-requests/${requestId}`, { action });
      toast.success(action === 'approve' ? 'Request approved' : 'Request rejected');
      
      // Reload requests and chats
      await loadJoinRequests();
      const response = await api.get('/chats');
      useChatStore.getState().setChats(response.data.chats);
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${action} request`);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentChat || !confirm('Are you sure you want to remove this member?')) return;

    try {
      await api.delete(`/chats/${currentChat.id}/members/${memberId}`);
      toast.success('Member removed from group');
      // Refresh chat data
      const response = await api.get('/chats');
      useChatStore.getState().setChats(response.data.chats);
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentChat || !confirm('Are you sure you want to leave this group?')) return;

    try {
      await api.post(`/chats/${currentChat.id}/leave`);
      toast.success('You left the group');
      useChatStore.getState().setCurrentChat(null);
      // Refresh chat data
      const response = await api.get('/chats');
      useChatStore.getState().setChats(response.data.chats);
    } catch (error) {
      toast.error('Failed to leave group');
    }
  };

  const getPresenceColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const handleForwardMessage = (messageId: string) => {
    setSelectedMessageToForward(messageId);
    setShowForwardModal(true);
  };

  const handleSubmitForward = async () => {
    if (!selectedMessageToForward || selectedChatsToForward.length === 0) {
      toast.error('Please select at least one chat');
      return;
    }

    try {
      await api.post(`/messages/${selectedMessageToForward}/forward`, {
        targetChatIds: selectedChatsToForward
      });
      toast.success(`Message forwarded to ${selectedChatsToForward.length} chat(s)`);
      setShowForwardModal(false);
      setSelectedMessageToForward(null);
      setSelectedChatsToForward([]);
    } catch (error) {
      toast.error('Failed to forward message');
    }
  };

  const handleScheduleMessage = () => {
    setScheduleMessage(messageInput);
    setShowScheduleModal(true);
  };

  const handleSubmitSchedule = async () => {
    if (!scheduleMessage || !scheduleDate || !scheduleTime || !currentChat) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const scheduledTime = new Date(`${scheduleDate}T${scheduleTime}`);
      
      // Validate future time
      if (scheduledTime <= new Date()) {
        toast.error('Please select a future date and time');
        return;
      }

      await api.post('/scheduled-messages', {
        chatId: currentChat.id,
        content: scheduleMessage,
        scheduledTime: scheduledTime.toISOString(),
        type: 'text'
      });
      toast.success('Message scheduled successfully');
      setShowScheduleModal(false);
      setScheduleMessage('');
      setScheduleDate('');
      setScheduleTime('');
      setMessageInput('');
    } catch (error: any) {
      console.error('Schedule error:', error);
      toast.error(error.response?.data?.error || 'Failed to schedule message');
    }
  };

  if (!currentChat) return null;

  // Get chat info
  const otherUser = currentChat.isGroup
    ? null
    : currentChat.members.find((m) => m.userId !== user?.id)?.user;

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                {currentChat.isGroup
                  ? currentChat.groupName?.charAt(0).toUpperCase()
                  : otherUser?.name.charAt(0).toUpperCase()}
              </div>
              {/* Presence indicator for 1-on-1 chats */}
              {!currentChat.isGroup && otherUser && (
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getPresenceColor(otherUser.presence_status || 'offline')} rounded-full border-2 border-white dark:border-gray-800`} title={otherUser.presence_status || 'offline'}></div>
              )}
            </div>
            <div>
              <h2 className="font-semibold">
                {currentChat.isGroup ? currentChat.groupName : otherUser?.name}
              </h2>
              {currentChat.isGroup ? (
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="text-xs text-gray-500 hover:text-primary-600 transition-colors flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  {currentChat.members.length} members
                </button>
              ) : (
                <p className="text-xs text-gray-500">Online</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={() => alert('Voice call feature coming soon!')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Voice call"
            >
              <Phone className="w-5 h-5" />
            </button>
            <button 
              onClick={() => alert('Video call feature coming soon!')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Video call"
            >
              <Video className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                const actions = ['View Profile', 'Search Messages', 'Mute Chat', 'Block User', 'Report'];
                const choice = prompt(`Options:\n${actions.map((a, i) => `${i+1}. ${a}`).join('\n')}\n\nEnter number (1-5):`);
                if (choice) alert(`You selected: ${actions[parseInt(choice)-1] || 'Invalid'}`);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <>
            {chatMessages.map((message, index) => {
              const isMine = message.userId === user?.id;
              const showAvatar =
                index === chatMessages.length - 1 ||
                chatMessages[index + 1]?.userId !== message.userId;

              return (
                <div
                  key={message.id}
                  className={clsx('flex items-end space-x-2', {
                    'justify-end': isMine,
                    'justify-start': !isMine,
                  })}
                >
                  {!isMine && showAvatar && (
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {message.user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {!isMine && !showAvatar && <div className="w-8"></div>}

                  <div
                    className={clsx('chat-bubble group relative', {
                      'chat-bubble-sent': isMine,
                      'chat-bubble-received': !isMine,
                    })}
                  >
                    {/* Forward button on hover */}
                    <button
                      onClick={() => handleForwardMessage(message.id)}
                      className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-all"
                      title="Forward message"
                    >
                      <Forward className="w-3 h-3" />
                    </button>
                    
                    {!isMine && currentChat.isGroup && (
                      <p className="text-xs font-semibold mb-1 opacity-75">
                        {message.user.name}
                      </p>
                    )}
                    <p className="break-words">{message.content}</p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span
                        className={clsx('text-xs', {
                          'text-primary-100': isMine,
                          'text-gray-500': !isMine,
                        })}
                      >
                        {format(new Date(message.createdAt), 'HH:mm')}
                      </span>
                      {isMine && (
                        <span className="text-xs" title={
                          message.readBy && message.readBy.length > 0 
                            ? `Read by ${message.readBy.length} ${message.readBy.length === 1 ? 'person' : 'people'}`
                            : message.deliveredTo && message.deliveredTo.length > 0
                            ? 'Delivered'
                            : 'Sent'
                        }>
                          {message.readBy && message.readBy.length > 0 ? (
                            <span className="text-red-500 font-bold">✓✓</span>
                          ) : message.deliveredTo && message.deliveredTo.length > 0 ? (
                            <span className="text-gray-400 font-bold">✓✓</span>
                          ) : (
                            <span className="text-gray-400">✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Typing indicator */}
        {chatTypingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-gray-500 text-sm">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
            <span>Someone is typing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx"
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5 text-gray-500" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Add emoji"
            >
              <Smile className="w-5 h-5 text-gray-500" />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-2 w-64">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-600 rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            value={messageInput}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 input-field"
          />

          <button
            type="button"
            onClick={handleScheduleMessage}
            disabled={!messageInput.trim()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Schedule message"
          >
            <Clock className="w-5 h-5 text-gray-500" />
          </button>

          <button
            type="submit"
            disabled={!messageInput.trim()}
            className="p-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>
      </div>

      {/* Forward Message Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Forward className="w-5 h-5" />
                Forward Message
              </h3>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedChatsToForward([]);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Select chats to forward to:</p>
              <div className="space-y-2">
                {useChatStore.getState().chats.filter(c => c.id !== currentChat?.id).map(chat => {
                  const otherMember = chat.isGroup ? null : chat.members.find(m => m.userId !== user?.id)?.user;
                  const isSelected = selectedChatsToForward.includes(chat.id);
                  
                  return (
                    <button
                      key={chat.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedChatsToForward(prev => prev.filter(id => id !== chat.id));
                        } else {
                          setSelectedChatsToForward(prev => [...prev, chat.id]);
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {chat.isGroup ? <Users className="w-5 h-5" /> : otherMember?.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{chat.isGroup ? chat.groupName : otherMember?.name}</p>
                        <p className="text-xs text-gray-500">{chat.isGroup ? `${chat.members.length} members` : otherMember?.email}</p>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-primary-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedChatsToForward([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitForward}
                disabled={selectedChatsToForward.length === 0}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Forward to {selectedChatsToForward.length || 0}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Message Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Schedule Message
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  value={scheduleMessage}
                  onChange={(e) => setScheduleMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Type your message..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Message will be sent automatically at the scheduled time
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitSchedule}
                disabled={!scheduleMessage || !scheduleDate || !scheduleTime}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && currentChat?.isGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Group Members ({currentChat.members.length})
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Members List */}
            <div className="overflow-y-auto max-h-[60vh] p-4">
              <div className="space-y-2">
                {currentChat.members.map((member) => {
                  const isAdmin = member.userId === currentChat.adminId;
                  const isCurrentUser = member.userId === user?.id;
                  const canRemove = currentChat.adminId === user?.id && !isCurrentUser && !isAdmin;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {member.user.name}
                            {isCurrentUser && (
                              <span className="text-xs text-gray-500">(You)</span>
                            )}
                            {isAdmin && (
                              <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 px-2 py-0.5 rounded-full">
                                Admin
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canRemove && (
                          <button
                            onClick={() => handleRemoveMember(member.userId)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Join Requests Section (Admin Only) */}
              {currentChat.adminId === user?.id && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 px-3">
                    Join Requests
                  </h4>
                  {loadingRequests ? (
                    <div className="text-center py-4 text-gray-500">Loading...</div>
                  ) : joinRequests.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">No pending requests</div>
                  ) : (
                    <div className="space-y-2">
                      {joinRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                              {request.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{request.user.name}</p>
                              <p className="text-xs text-gray-500">@{request.user.username}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleJoinRequest(request.id, 'approve')}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Approve request"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleJoinRequest(request.id, 'reject')}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Reject request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Leave Group Button */}
            {currentChat.adminId !== user?.id && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleLeaveGroup}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Group
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
