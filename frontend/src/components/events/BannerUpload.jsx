import { useEffect, useRef, useState } from 'react';

// The file stays local until the event form is submitted. Preview never uploads to the API.
export default function BannerUpload({ value, onChange, onFile, onReadingChange, disabled = false }) {
  const [error, setError] = useState(''), [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const fileInput = useRef(null);
  const selection = useRef(0), activeReader = useRef(null);
  useEffect(() => () => {
    selection.current += 1;
    activeReader.current?.abort();
  }, []);
  const select = async (file) => {
    if (!file || disabled || fileInput.current?.matches(':disabled')) return;
    const current = ++selection.current;
    activeReader.current?.abort();
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
      setReading(false); onReadingChange?.(false);
      setError('Chọn ảnh JPG hoặc PNG, tối đa 5 MB.'); return;
    }
    setReading(true); onReadingChange?.(true); setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width * bitmap.height > 20_000_000;
      bitmap.close();
      if (current !== selection.current) return;
      if (tooLarge) throw new Error();
      const reader = new FileReader();
      activeReader.current = reader;
      const result = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reader.onabort = () => reject(new Error());
        reader.readAsDataURL(file);
      });
      if (current !== selection.current) return;
      onFile(file); onChange(result); setError('');
    } catch {
      if (current === selection.current) setError('Ảnh không hợp lệ hoặc không đọc được. Chọn ảnh tối đa 20 triệu điểm ảnh.');
    } finally {
      if (current === selection.current) {
        activeReader.current = null;
        setReading(false); onReadingChange?.(false);
      }
    }
  };
  return <div className="event-banner-upload">
    <div className={`event-banner-drop ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void select(e.dataTransfer.files[0]); }}>
      {value && <img key={value} src={value} alt="Xem trước ảnh bìa sự kiện" onError={(e) => { e.currentTarget.style.display = 'none'; setError('Không tải được ảnh bìa. Kiểm tra đường dẫn hoặc chọn ảnh khác.'); }} />}
      <button type="button" disabled={disabled} onClick={() => fileInput.current?.click()}>Chọn hoặc kéo thả ảnh bìa</button><small>JPG, PNG · Tối đa 5 MB</small>
      <input ref={fileInput} aria-label="Tải ảnh bìa" type="file" accept="image/jpeg,image/png" disabled={disabled} onChange={(e) => { void select(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
    {reading && <p role="status">Đang đọc ảnh bìa…</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
