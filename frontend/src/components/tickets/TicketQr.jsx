import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function TicketQr({ ticket, size = 256 }) {
  const payload = ticket.status === 'ISSUED' && typeof ticket.qrPayload === 'string' ? ticket.qrPayload : '';
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!payload) return;
    let active = true;
    // Encode locally: the signed credential must never be sent to a QR image service.
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 4, scale: 5 }).then(src => {
      if (active) setImage({ payload, src });
    }).catch(() => { if (active) setImage({ payload, error: true }); });
    return () => { active = false; };
  }, [payload]);
  if (!payload) return <p className="text-xs text-slate-500">{ticket.status === 'RESERVED' ? 'Đang chờ phát hành vé.' : 'Vé này chưa có QR hợp lệ để vào cổng.'}</p>;
  if (image?.payload !== payload) return <p role="status" className="text-xs text-slate-500">Đang tạo mã QR…</p>;
  if (image.error) return <p role="alert" className="text-xs text-rose-700">Không hiển thị được QR. Vui lòng gửi lại email vé để lấy mã.</p>;
  return <img src={image.src} alt={`QR vé ${ticket.ticketId}`} width={size} height={size} style={{ maxWidth: '100%', height: 'auto', imageRendering: 'pixelated' }} />;
}
