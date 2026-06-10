'use client';

import { LogOut, TrendingUp, Upload } from 'lucide-react';
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
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface/80 backdrop-blur pt-safe">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-xl bg-primary p-1.5">
            <TrendingUp className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-base font-bold">Gastos</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUploadClick}
            aria-label="Upload"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:px-4"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition-colors hover:text-foreground"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
          {session?.user?.image && (
            <div
              role="img"
              aria-label="User avatar"
              className="size-9 rounded-full bg-cover bg-center"
              style={{ backgroundImage: `url("${session.user.image}")` }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
