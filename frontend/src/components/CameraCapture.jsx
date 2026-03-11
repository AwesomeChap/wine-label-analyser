import { useState, useRef, useEffect } from 'react';

/**
 * Renders a modal with live camera feed. On "Take photo", captures frame and calls onCapture(blob).
 */
export function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => setError(err.message || 'Camera access denied'));

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
        onClose();
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl max-w-[400px] w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="m-0 text-lg font-semibold">Capture from camera</h3>
          <button
            type="button"
            className="w-11 h-11 flex items-center justify-center text-muted hover:text-[#f5f0eb] text-2xl leading-none p-2 border-0 bg-transparent cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {error ? (
          <p className="px-5 py-4 text-error m-0">{error}</p>
        ) : (
          <>
            <div className="aspect-[3/4] bg-black flex-shrink min-h-0 relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="p-4 pt-4">
              <button
                type="button"
                className="w-full py-3 px-4 min-h-[48px] rounded-xl border-0 bg-accent text-bg font-semibold cursor-pointer hover:bg-accent-dim hover:text-[#f5f0eb]"
                onClick={takePhoto}
              >
                Take photo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
