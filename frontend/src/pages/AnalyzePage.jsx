import { useState, useRef, useEffect } from 'react';
import { analyzeLabels, getDefaultPrompt } from '../lib/api';
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
  const [promptText, setPromptText] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const multiInputRef = useRef(null);

  useEffect(() => {
    getDefaultPrompt()
      .then((p) => {
        setDefaultPrompt(p);
        setPromptText(p);
      })
      .catch(() => {});
  }, []);

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
      const data = await analyzeLabels(frontBase64, backBase64, promptText);
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
        await analyzeLabels(frontBase64, backBase64, promptText);
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
    <div className="w-full max-w-3xl mx-auto">
      <header className="mb-10">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#f5f0eb] mb-2">
          Analyse wine labels
        </h1>
        <p className="text-muted text-base leading-relaxed max-w-xl">
          Add front and back label photos—one wine or many. Drag & drop, upload, or capture. We extract name, winery, vintage, and more.
        </p>
      </header>

      <section className="rounded-2xl bg-surface/60 border border-white/5 p-5 sm:p-6 mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted/90 mb-5">Upload</h2>

        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted/80">Single wine</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted/90">Front</span>
            <div
              className={`relative aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200 ${
                dragOver.front
                  ? 'ring-2 ring-accent/50 bg-accent/5 border border-accent/30'
                  : 'bg-bg/80 border border-dashed border-white/10'
              }`}
              onDragOver={(e) => handleDragOver(e, 'front')}
              onDragLeave={(e) => handleDragLeave(e, 'front')}
              onDrop={(e) => handleDrop(e, 'front')}
            >
              {frontImage ? (
                <>
                  <img src={frontImage.url} alt="Front label" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/70 text-white/90 text-lg leading-none flex items-center justify-center hover:bg-black/90 transition-colors backdrop-blur-sm"
                    onClick={() => clearSlot('front')}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </>
              ) : (
                <span className="text-muted/90 text-sm flex flex-col items-center justify-center gap-2 text-center px-4">
                  {dragOver.front ? (
                    <span className="font-medium text-accent">Drop here</span>
                  ) : (
                    <>
                      <span className="font-semibold text-[#f5f0eb]/80">No image</span>
                      <span className="text-xs">Drag & drop or use buttons below</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload('front', e)}
                className="hidden"
              />
              <button
                type="button"
                className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium text-[#f5f0eb]/90 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                onClick={() => frontInputRef.current?.click()}
              >
                Upload
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium text-[#f5f0eb]/90 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                onClick={() => openCamera('front')}
              >
                Capture
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted/90">Back</span>
            <div
              className={`relative aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200 ${
                dragOver.back
                  ? 'ring-2 ring-accent/50 bg-accent/5 border border-accent/30'
                  : 'bg-bg/80 border border-dashed border-white/10'
              }`}
              onDragOver={(e) => handleDragOver(e, 'back')}
              onDragLeave={(e) => handleDragLeave(e, 'back')}
              onDrop={(e) => handleDrop(e, 'back')}
            >
              {backImage ? (
                <>
                  <img src={backImage.url} alt="Back label" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/70 text-white/90 text-lg leading-none flex items-center justify-center hover:bg-black/90 transition-colors backdrop-blur-sm"
                    onClick={() => clearSlot('back')}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </>
              ) : (
                <span className="text-muted/90 text-sm flex flex-col items-center justify-center gap-2 text-center px-4">
                  {dragOver.back ? (
                    <span className="font-medium text-accent">Drop here</span>
                  ) : (
                    <>
                      <span className="font-semibold text-[#f5f0eb]/80">No image</span>
                      <span className="text-xs">Drag & drop or use buttons below</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload('back', e)}
                className="hidden"
              />
              <button
                type="button"
                className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium text-[#f5f0eb]/90 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                onClick={() => backInputRef.current?.click()}
              >
                Upload
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium text-[#f5f0eb]/90 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                onClick={() => openCamera('back')}
              >
                Capture
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted/80 block mb-3">Multiple wines</span>
          <p className="text-muted text-sm mb-3 leading-relaxed">
            Folder or multiple files, ordered front, back, front, back… (sorted by filename).
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
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#f5f0eb]/90 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
              onClick={() => folderInputRef.current?.click()}
            >
              Choose folder
            </button>
            <button
              type="button"
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#f5f0eb]/90 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
              onClick={() => multiInputRef.current?.click()}
            >
              Choose files
            </button>
          </div>
          {batchPairs.length > 0 && (
            <ul className="list-none p-0 m-0 mt-4 flex flex-col gap-1.5">
              {batchPairs.map((pair, i) => (
                <li key={i} className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg bg-bg/50 border border-white/5">
                  <span className="text-muted shrink-0 font-medium">Wine {i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-[#f5f0eb]/80">
                    {pair[0].name}, {pair[1].name}
                  </span>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-md border-0 bg-transparent text-muted hover:text-error hover:bg-red-500/10 flex items-center justify-center shrink-0 transition-colors"
                    onClick={() => removeBatchPair(i)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {batchDone && (
            <p className="text-success text-sm mt-3 m-0">
              {batchDone.done} wine{batchDone.done !== 1 ? 's' : ''} saved to history.
              {batchDone.failed > 0 && ` ${batchDone.failed} failed.`}
            </p>
          )}
        </div>
      </section>

      <section className="mb-6">
        <button
          type="button"
          className="px-4 py-2.5 rounded-xl border border-accent/50 bg-accent/10 text-accent font-medium text-sm hover:bg-accent/15 hover:border-accent/70 transition-colors"
          onClick={() => setShowPromptEditor((v) => !v)}
        >
          {showPromptEditor ? 'Hide prompt' : 'Edit extraction prompt'}
        </button>
        {showPromptEditor && (
          <div className="mt-3 p-5 rounded-2xl border border-white/5 bg-surface/60">
            <p className="text-muted text-sm mb-3 leading-relaxed">
              This prompt is sent with the two images. The model must still return the same JSON fields (Name, Winery, Vintage, etc.).
            </p>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-bg/80 text-[#f5f0eb] text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted/60"
              placeholder="Extraction prompt..."
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg border border-white/10 bg-white/5 text-muted hover:bg-white/10 hover:text-[#f5f0eb] transition-colors"
                onClick={() => setPromptText(defaultPrompt)}
              >
                Reset to default
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg border border-white/10 bg-white/5 text-muted hover:bg-white/10 hover:text-[#f5f0eb] transition-colors"
                onClick={() => setShowPromptEditor(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-error text-sm">
          {error}
        </div>
      )}

      <section className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="px-8 py-3.5 rounded-xl bg-accent text-bg font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-accent-dim hover:enabled:text-[#f5f0eb] transition-colors shadow-lg shadow-accent/20"
            disabled={!canAnalyze || !!batchProgress}
            onClick={runAnalysis}
          >
            {loading && !batchProgress ? 'Analysing…' : 'Analyse labels'}
          </button>
          {batchPairs.length > 0 && (
            <button
              type="button"
              className="px-6 py-3.5 rounded-xl bg-white/10 text-[#f5f0eb] font-semibold text-sm border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-white/15 transition-colors"
              disabled={!canBatchAnalyze || !!loading}
              onClick={runBatchAnalysis}
            >
              {batchProgress
                ? `Analysing ${batchProgress.current}/${batchProgress.total}…`
                : `Analyse all (${batchPairs.length})`}
            </button>
          )}
          {!canAnalyze && batchPairs.length === 0 && (
            <span className="text-muted text-sm">Add images above, then run analysis.</span>
          )}
        </div>
      </section>

      {cameraSlot && (
        <CameraCapture onCapture={onCameraCapture} onClose={() => setCameraSlot(null)} />
      )}

      {result && (
        <section className="rounded-2xl bg-surface/60 border border-white/5 p-6 mb-8">
          <h2 className="font-serif text-xl font-semibold text-[#f5f0eb] mb-4">Extracted details</h2>
          <dl className="m-0 grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-6 gap-y-2">
            {FIELDS.map((key) => (
              <div key={key} className="contents">
                <dt className="m-0 font-medium text-muted text-sm pt-0.5">{key}</dt>
                <dd className="m-0 text-[#f5f0eb] text-sm sm:text-base">
                  {result.data?.[key]?.trim() || '—'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 pt-4 border-t border-white/5 text-success text-sm">
            Saved to history. View it on the History page.
          </p>
        </section>
      )}

    </div>
  );
}
