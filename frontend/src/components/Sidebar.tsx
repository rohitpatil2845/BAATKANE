import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Menu,
  Search,
  MessageCircle,
  Users,
  LogOut,
  Moon,
  Sun,
  Plus,
  User,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Sidebar() {
  const navigate = useNavigate();
  const { chats, currentChat, setCurrentChat } = useChatStore();
  const { user, logout } = useAuthStore();
  const { isSidebarOpen, toggleSidebar, isDarkMode, toggleDarkMode } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSearchGroups, setShowSearchGroups] = useState(false);

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    
    if (chat.isGroup) {
      return chat.groupName?.toLowerCase().includes(searchQuery.toLowerCase());
    } else {
      const otherUser = chat.members.find((m) => m.userId !== user?.id);
      return otherUser?.user.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
  });

  const handleChatClick = async (chat: any) => {
    setCurrentChat(chat);
    
    // Clear unread count
    useChatStore.getState().clearUnreadCount(chat.id);
    
    // Load messages
    try {
      const response = await api.get(`/chats/${chat.id}/messages`);
      useChatStore.getState().setMessages(chat.id, response.data.messages);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-50 transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">BaatKare</h1>
                <p className="text-xs text-gray-500">{user?.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleDarkMode}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={isDarkMode ? 'Light mode' : 'Dark mode'}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={() => navigate('/profile')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Profile"
              >
                <User className="w-5 h-5" />
              </button>

              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs mt-1">Start a new conversation</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredChats.map((chat) => {
                const isActive = currentChat?.id === chat.id;
                const otherUser = chat.isGroup
                  ? null
                  : chat.members.find((m) => m.userId !== user?.id)?.user;

                return (
                  <button
                    key={chat.id}
                    onClick={() => handleChatClick(chat)}
                    className={`w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                      isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {chat.isGroup ? (
                            <Users className="w-6 h-6" />
                          ) : otherUser?.username === 'smartbot' ? (
                            <span className="text-2xl">🤖</span>
                          ) : (
                            otherUser?.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {/* Presence indicator for non-group, non-bot chats */}
                        {!chat.isGroup && otherUser && otherUser.username !== 'smartbot' && (
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${
                            otherUser.presence_status === 'online' ? 'bg-green-500' :
                            otherUser.presence_status === 'away' ? 'bg-yellow-500' :
                            otherUser.presence_status === 'busy' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`}></div>
                        )}
                        {/* SmartBot badge */}
                        {!chat.isGroup && otherUser?.username === 'smartbot' && (
                          <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-green-400 to-blue-500 rounded-full p-1">
                            <span className="text-xs font-bold text-white">AI</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold truncate flex items-center gap-1">
                            {chat.isGroup ? chat.groupName : otherUser?.name}
                            {!chat.isGroup && otherUser?.username === 'smartbot' && (
                              <span className="text-xs bg-gradient-to-r from-green-400 to-blue-500 text-white px-2 py-0.5 rounded-full">✨ AI</span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2">
                            {chat.lastMessage && (
                              <span className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(chat.lastMessage.createdAt), {
                                  addSuffix: false,
                                })}
                              </span>
                            )}
                            {chat.unreadCount > 0 && (
                              <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {chat.lastMessage?.content || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* New chat buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button 
            onClick={() => setShowNewChat(true)}
            className="w-full btn-primary flex items-center justify-center space-x-2"
          >
            <MessageCircle className="w-5 h-5" />
            <span>New Chat</span>
          </button>
          <button 
            onClick={() => setShowCreateGroup(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span>Create Group</span>
          </button>
          <button 
            onClick={() => setShowSearchGroups(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Search className="w-5 h-5" />
            <span>Search Groups</span>
          </button>
        </div>
      </aside>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}

      {/* Search Groups Modal */}
      {showSearchGroups && (
        <SearchGroupsModal onClose={() => setShowSearchGroups(false)} />
      )}
    </>
  );
}

// New Chat Modal Component
function NewChatModal({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { addChat, setCurrentChat } = useChatStore();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.users);
    } catch (error) {
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChat = async (otherUser: any) => {
    try {
      const response = await api.post('/chats', {
        isGroup: false,
        memberIds: [otherUser.id],
      });

      const newChat = response.data.chat;
      addChat(newChat);
      setCurrentChat(newChat);
      toast.success(`Started chat with ${otherUser.name}`);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create chat');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">New Chat</h2>
          <p className="text-sm text-gray-500 mt-1">Search for users to start chatting</p>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700"
              autoFocus
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? 'No users found' : 'Type to search users'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((searchUser) => (
                  <button
                    key={searchUser.id}
                    onClick={() => handleCreateChat(searchUser)}
                    className="w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left flex items-center space-x-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                      {searchUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{searchUser.name}</p>
                      <p className="text-sm text-gray-500 truncate">{searchUser.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Group Modal Component
function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { addChat, setCurrentChat } = useChatStore();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.users.filter((u: any) => 
        !selectedMembers.find(m => m.id === u.id)
      ));
    } catch (error) {
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (user: any) => {
    if (selectedMembers.find(m => m.id === user.id)) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== user.id));
    } else {
      setSelectedMembers([...selectedMembers, user]);
      setSearchResults(searchResults.filter(u => u.id !== user.id));
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter group name');
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error('Please add at least one member');
      return;
    }

    try {
      const response = await api.post('/chats', {
        isGroup: true,
        groupName: groupName.trim(),
        memberIds: selectedMembers.map(m => m.id),
      });

      const newGroup = response.data.chat;
      addChat(newGroup);
      setCurrentChat(newGroup);
      toast.success(`Group "${groupName}" created!`);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create group');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Create Group</h2>
          <p className="text-sm text-gray-500 mt-1">Add members to your new group</p>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Group Name</label>
            <input
              type="text"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700"
            />
          </div>

          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Members ({selectedMembers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-2 bg-primary-100 dark:bg-primary-900 px-3 py-1 rounded-full"
                  >
                    <span className="text-sm">{member.name}</span>
                    <button
                      onClick={() => toggleMember(member)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Users */}
          <div>
            <label className="block text-sm font-medium mb-2">Add Members</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700"
              />
            </div>

            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  {searchQuery ? 'No users found' : 'Search to add members'}
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleMember(user)}
                      className="w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left flex items-center space-x-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex space-x-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedMembers.length === 0}
            className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}

// Search Groups Modal Component
function SearchGroupsModal({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/chats/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.groups);
    } catch (error) {
      toast.error('Failed to search groups');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async (groupId: string) => {
    try {
      await api.post(`/chats/${groupId}/join-request`);
      toast.success('Join request sent successfully');
      // Refresh search results
      handleSearch(searchQuery);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send join request');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Search Groups</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups by name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p>Searching...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No groups found' : 'Search for groups to join'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((group) => (
                <div
                  key={group.id}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{group.groupName}</p>
                        {group.description && (
                          <p className="text-xs text-gray-500 truncate">{group.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{group.memberCount} members</p>
                      </div>
                    </div>
                    <div>
                      {group.isMember ? (
                        <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
                          Joined
                        </span>
                      ) : group.hasPendingRequest ? (
                        <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded">
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJoinRequest(group.id)}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-colors"
                        >
                          Join
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
