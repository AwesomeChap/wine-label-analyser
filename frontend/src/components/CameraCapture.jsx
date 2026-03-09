import { useState, useRef, useEffect } from 'react';
import styles from './CameraCapture.module.css';

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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Capture from camera</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        {error ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <>
            <div className={styles.videoWrap}>
              <video ref={videoRef} autoPlay playsInline muted />
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.captureBtn} onClick={takePhoto}>
                Take photo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
