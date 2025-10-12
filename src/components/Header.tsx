'use client';

import { Upload, LogOut } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

interface HeaderProps {
  onUploadClick?: () => void;
}

export default function Header({ onUploadClick }: HeaderProps) {
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-background-light dark:bg-background-dark px-10 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        {/* Empty left section - FinTrack removed */}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Upload className="h-4 w-4" />
          <span>Upload PDF</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
        {session?.user?.image && (
          <div
            className="size-10 rounded-full bg-cover bg-center border-2 border-gray-200 dark:border-gray-700"
            style={{ backgroundImage: `url("${session.user.image}")` }}
          />
        )}
      </div>
    </header>
  );
}
