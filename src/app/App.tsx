import { useEffect, useState } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Bookmark, LogOut } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Button } from './components/ui/button';
import { BookmarkCard } from './components/BookmarkCard';
import { AddBookmarkDialog } from './components/AddBookmarkDialog';
import { toast, Toaster } from 'sonner';

interface Bookmark {
  id: string;
  title: string;
  url: string;
  userId: string;
  createdAt: string;
}

interface BookmarkEvent {
  type: 'added' | 'deleted';
  bookmark?: Bookmark;
  bookmarkId?: string;
  userId: string;
}

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    // Check for existing session
    checkSession();
  }, []);

  useEffect(() => {
    if (user && accessToken) {
      fetchBookmarks();
      setupRealtimeSubscription();
    }

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [user, accessToken]);

  const setupRealtimeSubscription = () => {
    if (!user) return;

    // Create a channel for this user's bookmarks
    const realtimeChannel = supabase.channel(`bookmarks:${user.id}`)
      .on('broadcast', { event: 'bookmark-change' }, (payload) => {
        const event = payload.payload as BookmarkEvent;
        
        // Only process events for this user
        if (event.userId !== user.id) return;

        if (event.type === 'added' && event.bookmark) {
          setBookmarks(prev => {
            // Check if bookmark already exists
            if (prev.some(b => b.id === event.bookmark!.id)) {
              return prev;
            }
            return [event.bookmark!, ...prev];
          });
        } else if (event.type === 'deleted' && event.bookmarkId) {
          setBookmarks(prev => prev.filter(b => b.id !== event.bookmarkId));
        }
      })
      .subscribe();

    setChannel(realtimeChannel);
  };

  const broadcastBookmarkChange = async (event: BookmarkEvent) => {
    if (!channel || !user) return;

    await channel.send({
      type: 'broadcast',
      event: 'bookmark-change',
      payload: event,
    });
  };

  const checkSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session error:', error);
        setLoading(false);
        return;
      }

      if (data.session) {
        setUser(data.session.user);
        setAccessToken(data.session.access_token);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });

      if (error) {
        console.error('Sign in error:', error);
        toast.error('Failed to sign in with Google');
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      toast.error('An error occurred during sign in');
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        toast.error('Failed to sign out');
        return;
      }
      setUser(null);
      setAccessToken(null);
      setBookmarks([]);
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error during sign out:', error);
      toast.error('An error occurred during sign out');
    }
  };

  const fetchBookmarks = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04c71c6f/bookmarks`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to fetch bookmarks:', error);
        toast.error('Failed to load bookmarks');
        return;
      }

      const data = await response.json();
      setBookmarks(data.bookmarks || []);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      toast.error('Failed to load bookmarks');
    }
  };

  const handleAddBookmark = async (url: string, title: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04c71c6f/bookmarks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, title }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to add bookmark:', error);
        toast.error('Failed to add bookmark');
        return;
      }

      const data = await response.json();
      
      // Update local state
      setBookmarks([data.bookmark, ...bookmarks]);
      
      // Broadcast to other tabs
      await broadcastBookmarkChange({
        type: 'added',
        bookmark: data.bookmark,
        userId: user.id,
      });
      
      toast.success('Bookmark added successfully');
    } catch (error) {
      console.error('Error adding bookmark:', error);
      toast.error('Failed to add bookmark');
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04c71c6f/bookmarks/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to delete bookmark:', error);
        toast.error('Failed to delete bookmark');
        return;
      }

      // Update local state
      setBookmarks(bookmarks.filter(b => b.id !== id));
      
      // Broadcast to other tabs
      await broadcastBookmarkChange({
        type: 'deleted',
        bookmarkId: id,
        userId: user.id,
      });
      
      toast.success('Bookmark deleted');
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast.error('Failed to delete bookmark');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Toaster position="top-center" />
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="bg-blue-100 p-4 rounded-full mb-4">
              <Bookmark className="h-12 w-12 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Smart Bookmarks
            </h1>
            <p className="text-gray-600">
              Save and organize your favorite websites
            </p>
          </div>
          
          <Button 
            onClick={handleGoogleSignIn}
            className="w-full gap-2 py-6 text-lg"
            size="lg"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
          
          <p className="text-xs text-gray-500 mt-6 text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Bookmark className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Smart Bookmarks</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {user.email}
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">My Bookmarks</h2>
            <p className="text-sm text-gray-600 mt-1">
              {bookmarks.length} {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'} saved
            </p>
          </div>
          <AddBookmarkDialog onAdd={handleAddBookmark} />
        </div>

        {bookmarks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bookmark className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No bookmarks yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start saving your favorite websites by adding your first bookmark
            </p>
            <AddBookmarkDialog onAdd={handleAddBookmark} />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                id={bookmark.id}
                title={bookmark.title}
                url={bookmark.url}
                createdAt={bookmark.createdAt}
                onDelete={handleDeleteBookmark}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}