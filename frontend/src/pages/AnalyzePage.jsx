import { useState, useRef } from 'react';
import { analyzeLabels } from '../lib/api';
import { compressAndToBase64 } from '../lib/compress';
import { CameraCapture } from '../components/CameraCapture';

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
    <div className="w-full">
      <h1 className="font-serif text-2xl sm:text-3xl font-semibold mb-2">Analyse a wine label</h1>
      <p className="text-muted text-sm sm:text-base mb-8">
        Add both the front and back label images, then run the analysis. Drag and drop images, upload files, or capture with your camera.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="flex flex-col gap-3">
          <span className="font-semibold text-sm text-muted">Front label</span>
          <div
            className={`relative aspect-[3/4] bg-surface border-2 border-dashed rounded-xl overflow-hidden flex items-center justify-center transition-colors ${dragOver.front ? 'border-accent bg-accent/10' : 'border-border'}`}
            onDragOver={(e) => handleDragOver(e, 'front')}
            onDragLeave={(e) => handleDragLeave(e, 'front')}
            onDrop={(e) => handleDrop(e, 'front')}
          >
            {frontImage ? (
              <>
                <img src={frontImage.url} alt="Front label" className="w-full h-full object-contain" />
                <button
                  type="button"
                  className="absolute top-2 right-2 w-10 h-10 min-w-[44px] min-h-[44px] rounded-full border-0 bg-black/60 text-white text-xl leading-none cursor-pointer flex items-center justify-center hover:bg-black/80"
                  onClick={() => clearSlot('front')}
                  aria-label="Remove"
                >
                  ×
                </button>
              </>
            ) : (
              <span className="text-muted text-sm flex flex-col items-center justify-center gap-1.5 text-center px-2">
                {dragOver.front ? (
                  'Drop image here'
                ) : (
                  <>
                    <span className="font-semibold text-[0.95rem]">No image</span>
                    <span className="text-xs opacity-90">Drag & drop or use buttons below</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload('front', e)}
              className="hidden"
            />
            <button
              type="button"
              className="px-4 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-[#f5f0eb] text-sm hover:bg-border"
              onClick={() => frontInputRef.current?.click()}
            >
              Upload
            </button>
            <button
              type="button"
              className="px-4 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-[#f5f0eb] text-sm hover:bg-border"
              onClick={() => openCamera('front')}
            >
              Capture
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="font-semibold text-sm text-muted">Back label</span>
          <div
            className={`relative aspect-[3/4] bg-surface border-2 border-dashed rounded-xl overflow-hidden flex items-center justify-center transition-colors ${dragOver.back ? 'border-accent bg-accent/10' : 'border-border'}`}
            onDragOver={(e) => handleDragOver(e, 'back')}
            onDragLeave={(e) => handleDragLeave(e, 'back')}
            onDrop={(e) => handleDrop(e, 'back')}
          >
            {backImage ? (
              <>
                <img src={backImage.url} alt="Back label" className="w-full h-full object-contain" />
                <button
                  type="button"
                  className="absolute top-2 right-2 w-10 h-10 min-w-[44px] min-h-[44px] rounded-full border-0 bg-black/60 text-white text-xl leading-none cursor-pointer flex items-center justify-center hover:bg-black/80"
                  onClick={() => clearSlot('back')}
                  aria-label="Remove"
                >
                  ×
                </button>
              </>
            ) : (
              <span className="text-muted text-sm flex flex-col items-center justify-center gap-1.5 text-center px-2">
                {dragOver.back ? (
                  'Drop image here'
                ) : (
                  <>
                    <span className="font-semibold text-[0.95rem]">No image</span>
                    <span className="text-xs opacity-90">Drag & drop or use buttons below</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload('back', e)}
              className="hidden"
            />
            <button
              type="button"
              className="px-4 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-[#f5f0eb] text-sm hover:bg-border"
              onClick={() => backInputRef.current?.click()}
            >
              Upload
            </button>
            <button
              type="button"
              className="px-4 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-[#f5f0eb] text-sm hover:bg-border"
              onClick={() => openCamera('back')}
            >
              Capture
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-error">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-8">
        <button
          type="button"
          className="px-6 py-3 rounded-xl border-0 bg-accent text-bg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:bg-accent-dim hover:enabled:text-[#f5f0eb] min-h-[48px] sm:min-h-0"
          disabled={!canAnalyze}
          onClick={runAnalysis}
        >
          {loading ? 'Analysing…' : 'Analyse labels'}
        </button>
        {!frontImage && !backImage && (
          <span className="text-muted text-sm">Add both images to enable analysis.</span>
        )}
      </div>

      {cameraSlot && (
        <CameraCapture onCapture={onCameraCapture} onClose={() => setCameraSlot(null)} />
      )}

      {result && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Extracted details</h2>
          <dl className="m-0 grid gap-3">
            {FIELDS.map((key) => (
              <div key={key} className="grid grid-cols-[140px_1fr] gap-4 items-baseline sm:grid-cols-1 sm:gap-1">
                <dt className="m-0 font-medium text-muted text-sm">{key}</dt>
                <dd className="m-0 text-base">{result.data?.[key]?.trim() || '—'}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 pt-4 border-t border-border text-success text-sm">
            Saved to history. You can view it on the History page.
          </p>
        </div>
      )}

      <section className="mt-10 pt-6 border-t border-border">
        <h2 className="text-lg font-semibold mb-1">Upload multiple wines</h2>
        <p className="text-muted text-sm mb-4">
          Choose a folder or multiple files. Images must be in order: front, back, front, back, … (sorted by filename).
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*"
            webkitdirectory=""
            multiple
            onChange={handleFolderOrMultiChange}
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
          />
          <input
            ref={multiInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFolderOrMultiChange}
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
          />
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-border bg-surface text-[#f5f0eb] text-sm cursor-pointer hover:bg-border"
            onClick={() => folderInputRef.current?.click()}
          >
            Choose folder
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-border bg-surface text-[#f5f0eb] text-sm cursor-pointer hover:bg-border"
            onClick={() => multiInputRef.current?.click()}
          >
            Choose files
          </button>
        </div>
        {batchPairs.length > 0 && (
          <>
            <ul className="list-none p-0 m-0 mt-4 mb-4 flex flex-col gap-1">
              {batchPairs.map((pair, i) => (
                <li key={i} className="flex items-center gap-2 text-sm py-1.5">
                  <span className="text-muted shrink-0">Wine {i + 1}:</span>
                  <span className="flex-1 min-w-0 truncate">
                    {pair[0].name}, {pair[1].name}
                  </span>
                  <button
                    type="button"
                    className="w-6 h-6 p-0 rounded border-0 bg-transparent text-muted text-lg leading-none cursor-pointer shrink-0 flex items-center justify-center hover:text-error hover:bg-red-500/10"
                    onClick={() => removeBatchPair(i)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="mb-2">
              <button
                type="button"
                className="px-6 py-3 rounded-xl border-0 bg-accent text-bg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:bg-accent-dim hover:enabled:text-[#f5f0eb]"
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
          <p className="text-success text-sm m-0">
            {batchDone.done} wine{batchDone.done !== 1 ? 's' : ''} saved to history.
            {batchDone.failed > 0 && ` ${batchDone.failed} failed.`}
          </p>
        )}
      </section>
    </div>
  );
}
