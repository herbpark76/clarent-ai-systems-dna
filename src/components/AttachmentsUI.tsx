import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import {
  type PendingFile, type AttachmentRow,
  validateFile, MAX_FILES, isImage, getSignedUrl,
} from '../lib/attachments';

// ── Upload Dropzone (for forms) ────────────────────────
export function AttachmentDropzone({
  pendingFiles,
  onAddFiles,
  onRemoveFile,
  existingAttachments,
  onRemoveExisting,
  disabled,
}: {
  pendingFiles: PendingFile[];
  onAddFiles: (files: PendingFile[]) => void;
  onRemoveFile: (index: number) => void;
  existingAttachments?: AttachmentRow[];
  onRemoveExisting?: (id: string) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(fileList)) {
      const error = validateFile(file);
      const previewUrl = isImage(file.type) ? URL.createObjectURL(file) : '';
      newFiles.push({ file, previewUrl, error });
    }
    onAddFiles(newFiles);
  }, [onAddFiles]);

  const total = pendingFiles.length + (existingAttachments?.length || 0);
  const canAdd = total < MAX_FILES && !disabled;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        onClick={() => canAdd && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (canAdd) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (canAdd && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed px-4 py-3 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-blue-500/60 bg-blue-500/[0.06]'
            : canAdd
              ? 'border-white/[0.12] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              : 'border-white/[0.06] bg-white/[0.01] opacity-50 cursor-not-allowed'
        }`}
      >
        <Paperclip className="w-4 h-4 text-white/30 mx-auto mb-1" />
        <p className="text-xs text-white/40">
          {canAdd ? 'Attach files (PNG, JPG, GIF, WebP, PDF — max 10 MB each)' : `Max ${MAX_FILES} files reached`}
        </p>
      </div>

      {(pendingFiles.length > 0 || (existingAttachments && existingAttachments.length > 0)) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {existingAttachments?.map((att) => (
            <AttachmentChip
              key={att.id}
              fileName={att.file_name}
              mimeType={att.mime_type}
              onRemove={onRemoveExisting ? () => onRemoveExisting(att.id) : undefined}
            />
          ))}
          {pendingFiles.map((pf, i) => (
            <AttachmentChip
              key={i}
              fileName={pf.file.name}
              mimeType={pf.file.type}
              previewUrl={pf.previewUrl}
              error={pf.error}
              onRemove={() => onRemoveFile(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attachment Chip (small file preview) ───────────────
function AttachmentChip({
  fileName, mimeType, previewUrl, error, onRemove,
}: {
  fileName: string;
  mimeType: string;
  previewUrl?: string;
  error?: string;
  onRemove?: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const handleClick = async () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
      return;
    }
    if (!signedUrl) {
      const url = await getSignedUrl(fileName);
      if (url) {
        setSignedUrl(url);
        window.open(url, '_blank');
      }
    } else {
      window.open(signedUrl, '_blank');
    }
  };

  return (
    <div className={`relative group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
      error ? 'border-red-500/30 bg-red-500/[0.06]' : 'border-white/[0.08] bg-white/[0.03]'
    }`}>
      <button onClick={handleClick} className="flex items-center gap-2 min-w-0">
        {isImage(mimeType) ? (
          previewUrl ? (
            <img src={previewUrl} alt={fileName} className="w-8 h-8 rounded object-cover flex-shrink-0" />
          ) : (
            <ImageIcon className="w-4 h-4 text-blue-400/60 flex-shrink-0" />
          )
        ) : (
          <FileText className="w-4 h-4 text-orange-400/60 flex-shrink-0" />
        )}
        <span className="text-xs text-white/60 truncate max-w-[120px]">{fileName}</span>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-0.5 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {error && <span className="text-[9px] text-red-400 absolute -bottom-3.5 left-0">{error}</span>}
    </div>
  );
}

// ── Attachment Gallery (display on cards/entries) ──────
export function AttachmentGallery({
  attachments,
  onDelete,
}: {
  attachments: AttachmentRow[];
  onDelete?: (att: AttachmentRow) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att) => (
        <AttachmentDisplayItem key={att.id} attachment={att} onDelete={onDelete ? () => onDelete(att) : undefined} />
      ))}
    </div>
  );
}

function AttachmentDisplayItem({
  attachment, onDelete,
}: {
  attachment: AttachmentRow;
  onDelete?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (url) {
      window.open(url, '_blank');
      return;
    }
    setLoading(true);
    const signedUrl = await getSignedUrl(attachment.file_path);
    setLoading(false);
    if (signedUrl) {
      setSignedUrl(signedUrl);
      window.open(signedUrl, '_blank');
    }
  };

  return (
    <div className="relative group flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
      <button onClick={handleClick} className="flex items-center gap-2 min-w-0">
        {isImage(attachment.mime_type) ? (
          url ? (
            <img src={url} alt={attachment.file_name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
          ) : (
            <ImageIcon className="w-4 h-4 text-blue-400/60 flex-shrink-0" />
          )
        ) : (
          <FileText className="w-4 h-4 text-orange-400/60 flex-shrink-0" />
        )}
        {loading ? (
          <Loader2 className="w-3 h-3 text-white/40 animate-spin flex-shrink-0" />
        ) : (
          <span className="text-xs text-white/60 truncate max-w-[120px]">{attachment.file_name}</span>
        )}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="p-0.5 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
