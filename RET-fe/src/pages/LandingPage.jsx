import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  // State mô phỏng tương tác quét QR trực tiếp
  const [ticketType, setTicketType] = useState('VIP');
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'scanning' | 'success' | 'warning'
  const [scanMessage, setScanMessage] = useState('Cổng VIP 01 • Sẵn sàng quét');

  const handleSimulateScan = () => {
    if (scanStatus === 'scanning') return;
    setScanStatus('scanning');
    setScanMessage('Đang giải mã chữ ký số QR...');

    setTimeout(() => {
      if (ticketType === 'VIP') {
        setScanStatus('success');
        setScanMessage('Check-in thành công: Zone VIP A (0.28s)');
      } else {
        setScanStatus('warning');
        setScanMessage('Cảnh báo: Phát hiện vé đã check-in lúc 19:42');
      }
    }, 800);
  };

  const featureList = [
    {
      title: 'Quản lý sự kiện',
      desc: 'Tạo sự kiện, cấu hình hạng vé, giới hạn số lượng và thời gian mở bán linh hoạt.',
      color: 'bg-indigo-50 text-indigo-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'QR có chữ ký số',
      desc: 'Mỗi vé mang mã QR mã hoá mật mã học chống giả mạo và can thiệp tham số.',
      color: 'bg-emerald-50 text-emerald-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'Check-in offline',
      desc: 'Xác thực cục bộ ngay cả khi mất mạng internet, tự động sync khi có mạng.',
      color: 'bg-blue-50 text-blue-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'Phát hiện dùng lại vé',
      desc: 'Hệ thống khoá token tức thì, cảnh báo quét trùng ngay tại cửa ra vào.',
      color: 'bg-rose-50 text-rose-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'Audit log minh bạch',
      desc: 'Ghi nhận chi tiết từng mili-giây, danh tính thiết bị scan và lịch sử truy xuất.',
      color: 'bg-amber-50 text-amber-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'Dashboard trực quan',
      desc: 'Theo dõi lưu lượng khách, số vé hợp lệ và biểu đồ doanh thu theo thời gian thực.',
      color: 'bg-purple-50 text-purple-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ];

  const steps = [
    {
      num: 1,
      title: 'Tạo sự kiện',
      desc: 'Thiết lập thông tin, địa điểm và phân tầng các hạng vé.'
    },
    {
      num: 2,
      title: 'Bán vé trực tuyến',
      desc: 'Người tham dự thanh toán và nhận QR có chữ ký số tức thì.'
    },
    {
      num: 3,
      title: 'Quét QR check-in',
      desc: 'Check-in tốc độ cao trên thiết bị di động, mượt mà cả offline.'
    },
    {
      num: 4,
      title: 'Theo dõi & báo cáo',
      desc: 'Xem biểu đồ check-in và audit log minh bạch thời gian thực.'
    }
  ];

  const stats = [
    { label: 'Người tham dự tin tưởng', value: '10,000+' },
    { label: 'Sự kiện được tổ chức', value: '500+' },
    { label: 'Tỷ lệ check-in chuẩn xác', value: '99.9%' },
    { label: 'Thời gian quét trung bình', value: '< 0.3s' }
  ];

  return (
      <div className="min-h-screen bg-[#f8faff] text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
        {/* HEADER */}
        <header className="w-full bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <a className="flex items-center gap-3 group" href="#home">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-slate-900 leading-none">EventPass</span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-1">Secure Tickets • Real Experiences</span>
              </div>
            </a>

            <nav className="hidden md:flex items-center gap-8 font-semibold text-[15px]">
              <a className="text-indigo-600 relative py-1 border-b-2 border-indigo-600" href="#home">Trang chủ</a>
              <a className="text-slate-600 hover:text-indigo-600 transition" href="#features">Tính năng</a>
              <a className="text-slate-600 hover:text-indigo-600 transition" href="#how-it-works">Cách hoạt động</a>
              <a className="text-slate-600 hover:text-indigo-600 transition" href="#stats">Thống kê</a>
            </nav>

            {/* Thay đổi các nút bấm thành thẻ Link để điều hướng mượt mà */}
            <div className="flex items-center gap-3">
              <Link
                  to="/login"
                  className="px-5 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition shadow-sm text-center"
              >
                Đăng nhập
              </Link>
              <Link
                  to="/register"
                  className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition shadow-md shadow-indigo-200 hover:shadow-indigo-300 text-center"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        </header>

      {/* HERO SECTION */}
      <section 
        id="home" 
        className="relative pt-12 pb-24 overflow-hidden bg-gradient-to-b from-indigo-100/90 via-blue-50/70 to-slate-50"
      >
        {/* Lớp lưới Grid công nghệ tương phản cao */}
        <div 
          className="absolute inset-0 bg-[radial-gradient(#94a3b8_1.5px,transparent_1.5px)] [background-size:28px_28px] opacity-60 pointer-events-none" 
        />

        {/* Khối màu Aura tím/indigo rực rõ nét góc trên bên trái */}
        <div 
          className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-indigo-500/25 rounded-full blur-[100px] pointer-events-none" 
        />
        
        {/* Khối màu Aura tím hồng/cyan rực rỡ bên phải */}
        <div 
          className="absolute top-10 -right-20 w-[520px] h-[520px] bg-purple-500/25 rounded-full blur-[100px] pointer-events-none" 
        />

        {/* Điểm nhấn vệt sáng trung tâm ngay dưới nội dung */}
        <div 
          className="absolute bottom-0 left-1/3 w-96 h-40 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" 
        />

        <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
          {/* Cột trái: Giới thiệu */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-xs uppercase tracking-wide">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
              Hệ thống bán vé & check-in sự kiện
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-slate-900 leading-[1.18] tracking-tight">
              Kết nối bạn với <br />
              những sự kiện <br />
              <span className="text-indigo-600 relative inline-block">
                đáng nhớ
                <svg className="absolute -top-1 -right-8 w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-medium">
              Nền tảng quản lý sự kiện hiện đại với QR check-in bảo mật cao, vận hành ổn định kể cả khi mất kết nối mạng, ngăn chặn quay vòng vé và audit log minh bạch.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button className="inline-flex items-center gap-3 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-300 hover:shadow-indigo-400 transition-all transform hover:-translate-y-0.5">
                <span>Khám phá sự kiện</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                onClick={handleSimulateScan}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white hover:bg-slate-50 text-indigo-700 font-bold rounded-2xl border-2 border-indigo-200 hover:border-indigo-300 transition shadow-sm active:scale-95"
              >
                <span className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <svg className="w-4 h-4 fill-indigo-600" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span>Thử test quét QR vé</span>
              </button>
            </div>
          </div>

          {/* Cột phải: Mockup điện thoại tương tác */}
          <div className="lg:col-span-6 relative flex justify-center items-center py-6">
            {/* Thẻ phụ nổi bật bên trái */}
            <div className="absolute -left-6 top-8 z-10 w-48 bg-gradient-to-tr from-indigo-900 to-indigo-700 rounded-2xl p-4 text-white shadow-xl shadow-indigo-900/20 transform -rotate-6 border border-white/10 hidden sm:block">
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Concert 2026</div>
              <div className="text-sm font-extrabold uppercase mt-1 leading-tight">Summer Wave Fest</div>
              <div className="mt-3 pt-2 border-t border-dashed border-white/20 text-[10px] text-indigo-200">
                <p>20:00 • 24.10.2026</p>
                <p className="font-bold">SÂN VẬN ĐỘNG QG</p>
              </div>
            </div>

            {/* Khung điện thoại */}
            <div className="relative mx-auto w-[310px] bg-slate-900 rounded-[44px] p-3.5 shadow-2xl ring-1 ring-slate-800 z-20">
              <div className="w-24 h-4 bg-slate-950 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
              </div>

              {/* Màn hình trong máy */}
              <div className="bg-white rounded-[32px] overflow-hidden p-4 space-y-3.5 text-slate-800 shadow-inner">
                {/* Header app */}
                <div className="flex items-center justify-between text-xs font-bold border-b pb-2 text-slate-600">
                  <span className="text-indigo-600 font-extrabold">EventPass App</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTicketType('VIP')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${ticketType === 'VIP' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      VIP
                    </button>
                    <button
                      onClick={() => setTicketType('Standard')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${ticketType === 'Standard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      Standard
                    </button>
                  </div>
                </div>

                <div className="text-center">
                  <h4 className="font-black text-slate-900 text-sm">Summer Wave Fest 2026</h4>
                  <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">{ticketType} Pass</p>
                </div>

                {/* QR Code Container */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center justify-center relative">
                  <div className="w-32 h-32 bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center relative overflow-hidden">
                    {/* Đường quét laser mô phỏng khi nhấn scan */}
                    {scanStatus === 'scanning' && (
                      <div className="absolute inset-x-0 h-1 bg-red-500 shadow-[0_0_12px_#ef4444] animate-bounce z-10" />
                    )}
                    <svg className="w-full h-full text-slate-900" fill="currentColor" viewBox="0 0 100 100">
                      <rect fill="none" height="25" rx="3" stroke="currentColor" strokeWidth="5" width="25" x="5" y="5" />
                      <rect height="13" width="13" x="11" y="11" />
                      <rect fill="none" height="25" rx="3" stroke="currentColor" strokeWidth="5" width="25" x="70" y="5" />
                      <rect height="13" width="13" x="76" y="11" />
                      <rect fill="none" height="25" rx="3" stroke="currentColor" strokeWidth="5" width="25" x="5" y="70" />
                      <rect height="13" width="13" x="11" y="76" />
                      <rect fill="#6366f1" height="20" rx="3" width="20" x="40" y="40" />
                      <rect height="6" width="6" x="36" y="10" />
                      <rect height="6" width="10" x="48" y="10" />
                      <rect height="8" width="8" x="36" y="24" />
                      <rect height="10" width="10" x="74" y="60" />
                    </svg>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 font-mono">
                    {ticketType === 'VIP' ? 'HASH: #VIP-8902-SEC' : 'HASH: #STD-3411-USED'}
                  </span>
                </div>

                {/* Trạng thái xác thực */}
                <div className={`w-full py-2 rounded-xl text-center font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition ${
                  scanStatus === 'warning'
                    ? 'bg-rose-500 text-white'
                    : scanStatus === 'scanning'
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white'
                }`}>
                  <span>{scanStatus === 'warning' ? '⚠️ ĐÃ QUA CỬA' : scanStatus === 'scanning' ? '⏳ ĐANG XÁC THỰC' : '✓ VÉ HỢP LỆ'}</span>
                </div>

                <div className="text-[11px] space-y-1.5 pt-1 text-slate-600 border-t border-slate-100 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Người mua:</span>
                    <span className="font-bold text-slate-800">Hoàng Mạnh Duy</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vị trí:</span>
                    <span className="font-bold text-slate-800">{ticketType === 'VIP' ? 'Zone VIP A' : 'Zone Regular B'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thời gian:</span>
                    <span className="font-bold text-slate-800">20:00 • 24/10/2026</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge mô phỏng kết quả quét trực tiếp */}
            <div className="absolute -right-4 bottom-4 z-30 hidden sm:block">
              <div className="bg-slate-900/95 text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700 flex items-center gap-3 w-64 backdrop-blur-md">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  scanStatus === 'warning' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Scanner Terminal</h5>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{scanMessage}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TÍNH NĂNG NỔI BẬT */}
      <section id="features" className="max-w-7xl mx-auto px-6 -mt-6 relative z-30 mb-20">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {featureList.map((item, idx) => (
              <div key={idx} className="pt-4 lg:pt-0 lg:px-3 first:pt-0 first:px-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${item.color}`}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÁCH HOẠT ĐỘNG */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Quy trình vận hành tối ưu</h2>
          <p className="text-slate-500 mt-2 text-base font-medium">Bốn bước tinh gọn từ khâu chuẩn bị vé tới cổng soát vé thực tế</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((st, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative group hover:shadow-md transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-indigo-200">
                  {st.num}
                </span>
                <h4 className="font-bold text-slate-900 text-sm">{st.title}</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATS & SOCIAL PROOF */}
      <section id="stats" className="max-w-7xl mx-auto px-6 py-14 border-t border-slate-100/80">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">{s.value}</div>
                <div className="text-xs font-semibold text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <p>© 2026 EventPass. Hệ thống bán vé & check-in sự kiện bảo mật. All rights reserved.</p>
      </footer>
    </div>
  );
}