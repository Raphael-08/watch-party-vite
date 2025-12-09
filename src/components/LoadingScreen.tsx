import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface LoadingScreenProps {
  message?: string;
}

/**
 * LoadingScreen - Unified loading screen with progress bar
 * 
 * Shows a glass-morphism card with an animated progress bar
 * for all loading states (connecting, creating room, etc.)
 */
export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Smooth progress animation
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Stop at 90% until actual completion
        return prev + 1;
      });
    }, 30); // Update every 30ms for smoother animation

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
      <div className="glass-morphism rounded-lg p-8 w-96">
        <div className="h-20 flex items-center justify-center mb-4">
          <h2 className="text-xl font-semibold text-white text-center">{message}</h2>
        </div>
        <Progress value={progress} className="h-2 transition-all duration-300 ease-out" />
      </div>
    </div>
  );
}
