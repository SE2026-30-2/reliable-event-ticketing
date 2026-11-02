import { useRef, useState } from 'react';

// The file stays local until the event form is submitted. Preview never uploads to the API.
export default function BannerUpload({ value, onChange, onFile, disabled = false }) {
  const [error, setError] = useState(''), [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const select = async (file) => {
    if (!file || disabled) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
      setError('Chọn ảnh JPG hoặc PNG, tối đa 5 MB.'); return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width * bitmap.height > 20_000_000;
      bitmap.close();
      if (tooLarge) throw new Error();
      const reader = new FileReader();
      reader.onload = () => { onFile(file); onChange(reader.result); setError(''); };
      reader.onerror = () => setError('Không đọc được ảnh. Hãy chọn lại.');
      reader.readAsDataURL(file);
    } catch { setError('Ảnh không hợp lệ hoặc vượt quá 20 triệu điểm ảnh.'); }
  };
  return <div className="event-banner-upload">
    <div className={`event-banner-drop ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void select(e.dataTransfer.files[0]); }}>
      {value && <img key={value} src={value} alt="Xem trước ảnh bìa sự kiện" onError={(e) => { e.currentTarget.style.display = 'none'; setError('Không tải được ảnh bìa. Kiểm tra đường dẫn hoặc chọn ảnh khác.'); }} />}
      <button type="button" disabled={disabled} onClick={() => fileInput.current?.click()}>Chọn hoặc kéo thả ảnh bìa</button><small>JPG, PNG · Tối đa 5 MB</small>
      <input ref={fileInput} aria-label="Tải ảnh bìa" type="file" accept="image/jpeg,image/png" disabled={disabled} onChange={(e) => { void select(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
