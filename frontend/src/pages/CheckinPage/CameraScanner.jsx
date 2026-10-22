import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export default function CameraScanner({ onScan, disabled }) {
  const video = useRef(null), stream = useRef(null), scan = useRef(onScan);
  const [running, setRunning] = useState(false), [error, setError] = useState(''), [torch, setTorch] = useState(false);
  useEffect(() => { scan.current = onScan; }, [onScan]);
  useEffect(() => {
    if (!running || disabled) return;
    let cancelled = false, timer;
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true });
    async function start() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (cancelled) { media.getTracks().forEach((t) => t.stop()); return; }
        stream.current = media;
        video.current.srcObject = media;
        await video.current.play();
        let detector;
        if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        async function frame() {
          if (cancelled) return;
          try {
            const element = video.current;
            if (element?.readyState >= 2) {
              let value;
              if (detector) value = (await detector.detect(element))[0]?.rawValue;
              else {
                canvas.width = Math.min(800, element.videoWidth);
                canvas.height = Math.round(canvas.width * element.videoHeight / element.videoWidth);
                context.drawImage(element, 0, 0, canvas.width, canvas.height);
                value = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data;
              }
              if (value && !cancelled) await scan.current(value);
            }
          } catch { /* A single unreadable frame must not stop the scanner. */ }
          if (!cancelled) timer = setTimeout(frame, 200);
        }
        void frame();
      } catch (e) {
        if (!cancelled) { setError(e.name === 'NotAllowedError' ? 'Chưa được cấp quyền camera. Hãy cho phép camera hoặc chọn Nhập tay.' : 'Không mở được camera. Kiểm tra thiết bị và sử dụng HTTPS hoặc localhost.'); setRunning(false); }
      }
    }
    void start();
    return () => { cancelled = true; clearTimeout(timer); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  }, [running, disabled]);
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file), canvas = document.createElement('canvas');
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const result = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (!result) throw new Error('Không tìm thấy mã QR trong ảnh.');
      setError(''); await onScan(result.data);
    } catch (e) { setError(e.message || 'Không đọc được ảnh QR.'); }
    event.target.value = '';
  }
  async function toggleTorch() {
    try {
      const track = stream.current?.getVideoTracks()[0];
      if (!track?.getCapabilities().torch) throw new Error('Camera này không hỗ trợ đèn pin.');
      await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch);
    } catch (e) { setError(e.message); }
  }
  return <><div className="ci-camera">
    <video ref={video} muted playsInline aria-label="Camera quét mã vé" />
    <div className="ci-camera-shade" /><div className="ci-viewfinder"><i /><i /><i /><i />{running && !disabled && <span className="ci-scan-line" />}</div>
    {(!running || disabled) && <div className="ci-camera-prompt"><span>▣</span><h2>Đưa mã QR vào khung</h2><p>Quét vé nhanh chóng, chính xác</p><button className="ci-primary" disabled={disabled} onClick={() => { setError(''); setRunning(true); }}>Bật camera</button></div>}
    <div className="ci-camera-controls"><button aria-label="Bật hoặc tắt đèn pin" disabled={!running || disabled} onClick={toggleTorch}>ϟ</button><button disabled={disabled} onClick={() => { setError(''); setRunning(!running); }}>{running ? '● Dừng camera' : '● Camera đang tắt'}</button><label className={disabled ? 'ci-disabled' : ''} title="Quét QR từ ảnh">▧<span className="ci-sr">Chọn ảnh QR</span><input type="file" accept="image/*" disabled={disabled} onChange={upload} /></label></div>
  </div>{error && <p className="ci-error" role="alert">{error}</p>}</>;
}
