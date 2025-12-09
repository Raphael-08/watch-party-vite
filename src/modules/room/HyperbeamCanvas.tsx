import { useEffect, useRef, useState } from 'react';

interface HyperbeamCanvasProps {
  embedUrl: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

/**
 * HyperbeamCanvas - Fullscreen iframe wrapper for Hyperbeam browser sessions
 *
 * Uses iframe instead of SDK due to WebRTC TURN server issues with SDK.
 * The iframe approach is more stable and reliable.
 */
export function HyperbeamCanvas({ embedUrl, onReady, onError }: HyperbeamCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      onReady?.();
    };

    const handleError = () => {
      const errorMsg = 'Failed to load Hyperbeam session';
      setError(errorMsg);
      onError?.(new Error(errorMsg));
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [onReady, onError]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="glass-morphism rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Session Error</h2>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="w-full h-full border-0"
        allow="autoplay; camera; microphone; clipboard-read; clipboard-write; display-capture"
        title="Hyperbeam Browser Session"
      />
    </div>
  );
}
