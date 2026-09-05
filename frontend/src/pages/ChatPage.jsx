import { useState, useCallback } from 'react';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import { useTheme } from '../context/ThemeContext';

const ChatPage = () => {
  const { sidebarOpen } = useTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className={`flex-shrink-0 ${sidebarOpen ? 'w-full md:w-80' : 'w-0 md:w-0'} transition-all duration-300 ease-in-out`}>
        <ChatSidebar
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ChatWindow />
      </div>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default ChatPage;
