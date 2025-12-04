import { MessageCircle } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center max-w-md px-4">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-primary-100 dark:bg-primary-900/20 rounded-full mb-6">
          <MessageCircle className="w-12 h-12 text-primary-600 dark:text-primary-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Welcome to BaatKare
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Select a chat from the sidebar to start messaging, or create a new conversation to connect with others.
        </p>

        <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-start space-x-2">
            <span className="text-primary-600 font-bold">✓</span>
            <p className="text-left">Real-time messaging with instant delivery</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-primary-600 font-bold">✓</span>
            <p className="text-left">Create groups and collaborate with teams</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-primary-600 font-bold">✓</span>
            <p className="text-left">AI-powered features with @smartbot</p>
          </div>
        </div>
      </div>
    </div>
  );
}
