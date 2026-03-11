import { useState, useRef } from 'react';
import { analyzeLabels } from '../lib/api';
import { compressAndToBase64 } from '../lib/compress';
import { CameraCapture } from '../components/CameraCapture';
import styles from './AnalyzePage.module.css';

const FIELDS = ['Name', 'Winery', 'Vintage', 'Grape Variety', 'Vineyard Location', 'Country', 'DecodedText'];

/** Get image files from FileList, sort by path/name, pair as [front, back]. */
function filesToPairs(fileList) {
  if (!fileList?.length) return [];
  const files = Array.from(fileList).filter((f) => f.type?.startsWith('image/'));
  const sortKey = (f) => f.webkitRelativePath || f.name || '';
  files.sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true }));
  const pairs = [];
  for (let i = 0; i + 1 < files.length; i += 2) {
    pairs.push([files[i], files[i + 1]]);
  }
  return pairs;
}

export function AnalyzePage() {
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraSlot, setCameraSlot] = useState(null);
  const [dragOver, setDragOver] = useState({ front: false, back: false });
  const [batchPairs, setBatchPairs] = useState([]);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchDone, setBatchDone] = useState(null);
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const multiInputRef = useRef(null);

  const canAnalyze = frontImage && backImage && !loading;
  const canBatchAnalyze = batchPairs.length > 0 && !loading && !batchProgress;

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

  const handleFolderOrMultiChange = (e) => {
    const list = e.target.files;
    if (!list?.length) return;
    const pairs = filesToPairs(list);
    setBatchPairs(pairs);
    setBatchDone(null);
    setError(null);
    e.target.value = '';
  };

  const removeBatchPair = (index) => {
    setBatchPairs((prev) => prev.filter((_, i) => i !== index));
    setBatchDone(null);
  };

  const runBatchAnalysis = async () => {
    if (!canBatchAnalyze) return;
    setLoading(true);
    setError(null);
    setBatchDone(null);
    const total = batchPairs.length;
    let done = 0;
    let failed = 0;
    for (let i = 0; i < total; i++) {
      setBatchProgress({ current: i + 1, total });
      try {
        const [front, back] = batchPairs[i];
        const [frontBase64, backBase64] = await Promise.all([
          compressAndToBase64(front),
          compressAndToBase64(back),
        ]);
        await analyzeLabels(frontBase64, backBase64);
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setBatchProgress(null);
    setBatchDone({ done, failed, total });
    setBatchPairs([]);
    setLoading(false);
    if (folderInputRef.current) folderInputRef.current.value = '';
    if (multiInputRef.current) multiInputRef.current.value = '';
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

      <section className={styles.batch}>
        <h2 className={styles.batchTitle}>Upload multiple wines</h2>
        <p className={styles.batchSubtitle}>
          Choose a folder or multiple files. Images must be in order: front, back, front, back, … (sorted by filename).
        </p>
        <div className={styles.batchActions}>
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*"
            webkitdirectory=""
            multiple
            onChange={handleFolderOrMultiChange}
            className={styles.hiddenInput}
          />
          <input
            ref={multiInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFolderOrMultiChange}
            className={styles.hiddenInput}
          />
          <button type="button" className={styles.batchBtn} onClick={() => folderInputRef.current?.click()}>
            Choose folder
          </button>
          <button type="button" className={styles.batchBtn} onClick={() => multiInputRef.current?.click()}>
            Choose files
          </button>
        </div>
        {batchPairs.length > 0 && (
          <>
            <ul className={styles.batchList}>
              {batchPairs.map((pair, i) => (
                <li key={i} className={styles.batchItem}>
                  <span className={styles.batchItemLabel}>Wine {i + 1}:</span>
                  <span className={styles.batchItemFiles}>{pair[0].name}, {pair[1].name}</span>
                  <button
                    type="button"
                    className={styles.batchRemoveBtn}
                    onClick={() => removeBatchPair(i)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.batchAnalyzeRow}>
              <button
                type="button"
                className={styles.analyzeBtn}
                disabled={!canBatchAnalyze}
                onClick={runBatchAnalysis}
              >
                {batchProgress
                  ? `Analysing ${batchProgress.current}/${batchProgress.total}…`
                  : `Analyse all (${batchPairs.length})`}
              </button>
            </div>
          </>
        )}
        {batchDone && (
          <p className={styles.batchDone}>
            {batchDone.done} wine{batchDone.done !== 1 ? 's' : ''} saved to history.
            {batchDone.failed > 0 && ` ${batchDone.failed} failed.`}
          </p>
        )}
      </section>
    </div>
  );
}
