import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";

export default function PaymentGateway() {
    const location = useLocation();
    const navigate = useNavigate();

    // Nhận dữ liệu truyền từ Checkout.jsx
    const bookingData = location.state || {
        orderCode: "EH" + Date.now().toString().slice(-8),
        eventName: "The Dreams Concert 2025",
        ticketType: "VIP",
        packageInfo: "Gói 2 ngày",
        quantity: 2,
        totalAmount: 4500000,
        customerName: "Nguyễn Văn A",
        customerEmail: "nguyenvana@example.com",
        paymentMethod: "vnpay"
    };

    // Đếm ngược hết hạn giao dịch (15 phút = 900 giây)
    const [timeLeft, setTimeLeft] = useState(900);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const formatCountdown = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    // Giả lập xử lý xác nhận thanh toán thành công
    const handleConfirmPayment = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            // Chuyển sang trang kết quả thành công
            navigate("/payment-result", {
                state: {
                    ...bookingData,
                    status: "success",
                    paidAt: new Date().toISOString(),
                    transactionId: "VNP" + Math.floor(10000000 + Math.random() * 90000000)
                }
            });
        }, 2000);
    };

    return (
        <div className="bg-[#F8FAFC] text-slate-800 antialiased min-h-screen flex flex-col justify-between">
            <Header />

            <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
                {/* BREADCRUMB & HEADER */}
                <div className="mb-6 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start space-x-2 text-sm text-slate-400 mb-2">
                        <Link to="/home" className="hover:text-slate-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-slate-500 font-medium">Cổng thanh toán</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Cổng thanh toán an toàn
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Quét mã QR bằng ứng dụng ngân hàng hoặc ví điện tử để hoàn tất đơn hàng.
                    </p>
                </div>

                {/* MAIN PAYMENT CONTAINER */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT COLUMN: QR CODE & PAYMENT INSTRUCTIONS */}
                    <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-100/70 space-y-6">

                        {/* Countdown Header Alert */}
                        <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Thời gian thanh toán còn lại</p>
                                    <p className="text-lg font-black text-amber-800 font-mono">{formatCountdown(timeLeft)}</p>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full hidden sm:inline-block">
                                Đang chờ chuyển khoản
                            </span>
                        </div>

                        {/* QR Code Box */}
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-4">
                            <div className="text-center">
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-[#4353ff] mb-2">
                                    VNPay / VietQR
                                </span>
                                <h3 className="text-sm font-extrabold text-slate-900">Quét mã QR để thanh toán</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Sử dụng App Ngân hàng hoặc Ví VNPay để quét</p>
                            </div>

                            {/* Dynamic Fake QR Frame */}
                            <div className="relative w-52 h-52 bg-white p-3 rounded-2xl border-2 border-[#4353ff] shadow-md flex items-center justify-center">
                                <svg className="w-full h-full text-slate-800" fill="currentColor" viewBox="0 0 100 100">
                                    <path d="M10 10 h30 v30 h-30 z M16 16 v18 h18 v-18 z M22 22 h6 v6 h-6 z"></path>
                                    <path d="M60 10 h30 v30 h-30 z M66 16 v18 h18 v-18 z M72 22 h6 v6 h-6 z"></path>
                                    <path d="M10 60 h30 v30 h-30 z M16 66 v18 h18 v-18 z M22 72 h6 v6 h-6 z"></path>
                                    <rect height="8" width="8" x="46" y="10"></rect>
                                    <rect height="12" width="8" x="46" y="24"></rect>
                                    <rect height="8" width="12" x="10" y="46"></rect>
                                    <rect height="8" width="8" x="28" y="46"></rect>
                                    <rect height="8" width="8" x="46" y="46"></rect>
                                    <rect height="8" width="14" x="60" y="46"></rect>
                                    <rect height="14" width="8" x="46" y="60"></rect>
                                    <rect height="16" width="16" x="74" y="74"></rect>
                                </svg>
                                {/* Center Logo overlay */}
                                <div className="absolute inset-auto w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-xs">
                                    <span className="font-black text-[9px] text-[#4353ff]">EventHub</span>
                                </div>
                            </div>

                            <div className="text-center space-y-1">
                                <p className="text-xs font-bold text-slate-700">Số tiền: <span className="text-base font-black text-[#4353ff]">{bookingData.totalAmount.toLocaleString("vi-VN")}đ</span></p>
                                <p className="text-[11px] text-slate-400 font-mono">Nội dung CK: <span className="font-bold text-slate-700">{bookingData.orderCode}</span></p>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-2 text-xs text-slate-600 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-50">
                            <p className="font-bold text-slate-800 mb-1">Hướng dẫn thanh toán:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Mở ứng dụng Ngân hàng (Vietcombank, MB, Techcombank...) hoặc Ví VNPay.</li>
                                <li>Chọn tính năng <b>Quét mã QR</b> và quét mã hiển thị trên màn hình.</li>
                                <li>Kiểm tra số tiền và nội dung chuyển khoản trùng với thông tin trên.</li>
                                <li>Bấm <b>Xác nhận thanh toán</b> bên dưới sau khi chuyển tiền thành công.</li>
                            </ol>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                            <button
                                onClick={handleConfirmPayment}
                                disabled={isProcessing}
                                className="w-full sm:flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#4353ff] to-indigo-600 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2"
                                type="button"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xác thực giao dịch...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                                        </svg>
                                        <span>Tôi đã thanh toán thành công</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => navigate(-1)}
                                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                                type="button"
                            >
                                Hủy giao dịch
                            </button>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: ORDER SUMMARY INFO */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
                            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100">
                                Chi tiết đơn hàng
                            </h3>

                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Mã đơn hàng</span>
                                    <span className="font-mono font-bold text-slate-800">#{bookingData.orderCode}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Sự kiện</span>
                                    <span className="font-bold text-slate-800 text-right">{bookingData.eventName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Loại vé</span>
                                    <span className="font-bold text-slate-800">{bookingData.ticketType} ({bookingData.packageInfo})</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Số lượng</span>
                                    <span className="font-bold text-slate-800">{bookingData.quantity} vé</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Người đặt</span>
                                    <span className="font-bold text-slate-800">{bookingData.customerName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Email</span>
                                    <span className="font-bold text-slate-800">{bookingData.customerEmail}</span>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
                                    <span className="text-xs font-extrabold text-slate-800">Tổng tiền</span>
                                    <span className="text-xl font-black text-[#4353ff]">{bookingData.totalAmount.toLocaleString("vi-VN")}đ</span>
                                </div>
                            </div>
                        </div>

                        {/* Security notice */}
                        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800">Thanh toán an toàn SSL</h4>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                    Thông tin giao dịch được mã hóa an toàn và xác nhận tự động.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            <Footer />
        </div>
    );
}