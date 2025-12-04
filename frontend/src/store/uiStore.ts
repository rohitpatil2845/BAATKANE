import { create } from 'zustand';

interface UIState {
  isDarkMode: boolean;
  isSidebarOpen: boolean;
  showUserProfile: boolean;
  showGroupInfo: boolean;

  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setShowUserProfile: (show: boolean) => void;
  setShowGroupInfo: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isDarkMode: localStorage.getItem('darkMode') === 'true',
  isSidebarOpen: true,
  showUserProfile: false,
  showGroupInfo: false,

  toggleDarkMode: () =>
    set((state) => {
      const newMode = !state.isDarkMode;
      localStorage.setItem('darkMode', String(newMode));
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { isDarkMode: newMode };
    }),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  setShowUserProfile: (show) => set({ showUserProfile: show }),
  
  setShowGroupInfo: (show) => set({ showGroupInfo: show }),
}));
