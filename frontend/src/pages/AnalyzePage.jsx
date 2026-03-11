import { useState, useRef } from 'react';
import { analyzeLabels } from '../lib/api';
import { compressAndToBase64 } from '../lib/compress';
import { CameraCapture } from '../components/CameraCapture';
import styles from './AnalyzePage.module.css';

const FIELDS = ['Name', 'Winery', 'Vintage', 'Grape Variety', 'Vineyard Location', 'Country', 'DecodedText'];

export function AnalyzePage() {
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraSlot, setCameraSlot] = useState(null);
  const [dragOver, setDragOver] = useState({ front: false, back: false });
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);

  const canAnalyze = frontImage && backImage && !loading;

  const getFirstImageFile = (files) => {
    if (!files?.length) return null;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type?.startsWith('image/')) return files[i];
    }
    return null;
  };

  const handleDragOver = (e, slot) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver((prev) => ({ ...prev, [slot]: true }));
  };

  const handleDragLeave = (e, slot) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver((prev) => ({ ...prev, [slot]: false }));
  };

  const handleDrop = (e, slot) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver((prev) => ({ ...prev, [slot]: false }));
    const file = getFirstImageFile(e.dataTransfer.files);
    if (file) handleFile(slot, file);
  };

  const handleFile = (slot, file) => {
    if (!file?.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    if (slot === 'front') {
      setFrontImage({ file, url });
    } else {
      setBackImage({ file, url });
    }
    setError(null);
    setResult(null);
  };

  const handleUpload = (slot, e) => {
    const file = e?.target?.files?.[0];
    if (file) handleFile(slot, file);
  };

  const openCamera = (slot) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser.');
      return;
    }
    setCameraSlot(slot);
    setError(null);
  };

  const onCameraCapture = (blob) => {
    if (!cameraSlot) return;
    handleFile(cameraSlot, new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
    setCameraSlot(null);
  };

  const clearSlot = (slot) => {
    if (slot === 'front') {
      if (frontImage) URL.revokeObjectURL(frontImage.url);
      setFrontImage(null);
      if (frontInputRef.current) frontInputRef.current.value = '';
    } else {
      if (backImage) URL.revokeObjectURL(backImage.url);
      setBackImage(null);
      if (backInputRef.current) backInputRef.current.value = '';
    }
    setError(null);
    setResult(null);
  };

  const runAnalysis = async () => {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const [frontBase64, backBase64] = await Promise.all([
        compressAndToBase64(frontImage.file),
        compressAndToBase64(backImage.file),
      ]);
      const data = await analyzeLabels(frontBase64, backBase64);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Analyse a wine label</h1>
      <p className={styles.subtitle}>
        Add both the front and back label images, then run the analysis. Drag and drop images, upload files, or capture with your camera.
      </p>

      <div className={styles.slots}>
        <div className={styles.slot}>
          <span className={styles.slotLabel}>Front label</span>
          <div
            className={`${styles.preview} ${dragOver.front ? styles.previewDragOver : ''}`}
            onDragOver={(e) => handleDragOver(e, 'front')}
            onDragLeave={(e) => handleDragLeave(e, 'front')}
            onDrop={(e) => handleDrop(e, 'front')}
          >
            {frontImage ? (
              <>
                <img src={frontImage.url} alt="Front label" />
                <button type="button" className={styles.clearBtn} onClick={() => clearSlot('front')} aria-label="Remove">×</button>
              </>
            ) : (
              <span className={styles.placeholder}>
                {dragOver.front ? (
                  'Drop image here'
                ) : (
                  <>
                    <span>No image</span>
                    <span className={styles.placeholderHint}>Drag & drop or use buttons below</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className={styles.actions}>
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload('front', e)}
            />
            <button type="button" onClick={() => frontInputRef.current?.click()}>Upload</button>
            <button type="button" onClick={() => openCamera('front')}>Capture</button>
          </div>
        </div>

        <div className={styles.slot}>
          <span className={styles.slotLabel}>Back label</span>
          <div
            className={`${styles.preview} ${dragOver.back ? styles.previewDragOver : ''}`}
            onDragOver={(e) => handleDragOver(e, 'back')}
            onDragLeave={(e) => handleDragLeave(e, 'back')}
            onDrop={(e) => handleDrop(e, 'back')}
          >
            {backImage ? (
              <>
                <img src={backImage.url} alt="Back label" />
                <button type="button" className={styles.clearBtn} onClick={() => clearSlot('back')} aria-label="Remove">×</button>
              </>
            ) : (
              <span className={styles.placeholder}>
                {dragOver.back ? (
                  'Drop image here'
                ) : (
                  <>
                    <span>No image</span>
                    <span className={styles.placeholderHint}>Drag & drop or use buttons below</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className={styles.actions}>
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload('back', e)}
            />
            <button type="button" onClick={() => backInputRef.current?.click()}>Upload</button>
            <button type="button" onClick={() => openCamera('back')}>Capture</button>
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.analyzeRow}>
        <button
          type="button"
          className={styles.analyzeBtn}
          disabled={!canAnalyze}
          onClick={runAnalysis}
        >
          {loading ? 'Analysing…' : 'Analyse labels'}
        </button>
        {!frontImage && !backImage && (
          <span className={styles.hint}>Add both images to enable analysis.</span>
        )}
      </div>

      {cameraSlot && (
        <CameraCapture
          onCapture={onCameraCapture}
          onClose={() => setCameraSlot(null)}
        />
      )}

      {result && (
        <div className={styles.result}>
          <h2>Extracted details</h2>
          <dl className={styles.dl}>
            {FIELDS.map((key) => (
              <div key={key} className={styles.row}>
                <dt>{key}</dt>
                <dd>{result.data?.[key]?.trim() || '—'}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.saved}>Saved to history. You can view it on the History page.</p>
        </div>
      )}
    </div>
  );
}
