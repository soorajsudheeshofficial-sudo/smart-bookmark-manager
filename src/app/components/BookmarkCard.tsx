import { Trash2, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface BookmarkCardProps {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  onDelete: (id: string) => void;
}

export function BookmarkCard({ id, title, url, createdAt, onDelete }: BookmarkCardProps) {
  const handleOpenUrl = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1 truncate">{title}</h3>
            <a 
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline break-all line-clamp-2"
              onClick={(e) => e.stopPropagation()}
            >
              {url}
            </a>
            <p className="text-xs text-gray-500 mt-2">
              Added {new Date(createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenUrl}
              className="h-8 w-8 p-0"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">Open link</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
