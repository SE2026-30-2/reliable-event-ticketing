import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { eventService } from "../../services/eventService.js";

export default function Checkout() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Data states
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Form & Checkout states
    const [paymentMethod, setPaymentMethod] = useState("vnpay");
    const [timeLeft, setTimeLeft] = useState(600); // 10 phút giữ chỗ

    // 1. Nhận thông tin booking truyền từ EventDetail (hoặc dữ liệu mặc định)
    const bookingDetails = location.state || {
        ticketType: "VIP",
        packageInfo: "Gói 2 ngày",
        quantity: 2,
        pricePerTicket: 2250000,
        customerName: "Nguyễn Văn A",
        customerEmail: "nguyenvana@example.com",
        orderCode: "EH" + Date.now().toString().slice(-8)
    };

    // Countdown Timer 10 phút
    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    // Format thời gian đếm ngược MM:SS
    const formatCountdown = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    useEffect(() => {
        const fetchEventDetail = async () => {
            setLoading(true);
            try {
                // Fetch dữ liệu sự kiện
                const data = await eventService.getEventById(id);
                setEvent(data);
            } catch (err) {
                console.error("Lỗi khi tải thông tin sự kiện:", err);
                setError("Không thể tải thông tin đơn hàng. Vui lòng thử lại.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchEventDetail();
        } else {
            // Mock data hiển thị tạm nếu không tìm thấy ID
            setEvent({
                name: "The Dreams Concert 2025",
                venue: "SVĐ Mỹ Đình, Hà Nội",
                startsAt: "2025-10-25T15:00:00",
                endsAt: "2025-10-25T22:00:00",
                bannerUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200",
                description: "The Dreams Concert 2025 - Đêm nhạc hội tụ những nghệ sĩ hàng đầu, mang đến hành trình âm nhạc đầy cảm xúc và trải nghiệm đẳng cấp."
            });
            setLoading(false);
        }
    }, [id]);

    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    const formatTime = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // 2. Sửa phép tính tổng tiền
    const totalAmount = bookingDetails.quantity * bookingDetails.pricePerTicket;

    // 3. Hàm xử lý chuyển hướng sang Cổng thanh toán (PaymentGateway)
    const handlePayment = () => {
        navigate("/payment-gateway", {
            state: {
                orderCode: bookingDetails.orderCode,
                eventName: event?.name || "The Dreams Concert 2025",
                ticketType: bookingDetails.ticketType,
                packageInfo: bookingDetails.packageInfo,
                quantity: bookingDetails.quantity,
                totalAmount: totalAmount,
                customerName: bookingDetails.customerName,
                customerEmail: bookingDetails.customerEmail,
                paymentMethod: paymentMethod
            }
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4353ff] border-t-transparent"></div>
                </div>
                <Footer />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Đã có lỗi xảy ra</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <Link
                        to="/home"
                        className="px-6 py-2.5 rounded-xl bg-[#4353ff] text-white font-semibold hover:bg-indigo-700 transition"
                    >
                        Quay lại trang chủ
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="bg-[#F8FAFC] text-slate-800 antialiased min-h-screen flex flex-col justify-between">
            <Header />

            <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
                {/* PAGE HEADER & COUNTDOWN ALERT */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <div className="flex items-center space-x-2 text-sm text-slate-400 mb-2">
                            <Link to="/home" className="hover:text-slate-600 transition">Trang chủ</Link>
                            <span>/</span>
                            <span className="text-slate-500 font-medium">Thanh toán đơn đặt chỗ</span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Thanh toán đơn đặt chỗ</h1>
                        <p className="text-sm text-slate-500 mt-1">Vui lòng hoàn tất thanh toán trong thời gian giữ chỗ để xác nhận đơn hàng của bạn.</p>
                    </div>

                    {/* Countdown Alert Box */}
                    <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 flex items-center gap-6 shadow-xs self-start lg:self-auto min-w-[360px]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-rose-200">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                                </svg>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-rose-500">Thời gian giữ chỗ còn lại</div>
                                <div className="text-2xl font-black text-rose-600 tracking-wider mt-0.5">
                                    {formatCountdown(timeLeft)}
                                </div>
                            </div>
                        </div>
                        <div className="h-10 w-[1px] bg-rose-200"></div>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-[150px]">
                            Sau khi hết thời gian, đơn đặt chỗ sẽ tự động bị hủy.
                        </p>
                    </div>
                </div>

                {/* MAIN TWO-COLUMN LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT COLUMN: Event Banner & Payment Methods */}
                    <div className="lg:col-span-7 space-y-6">

                        {/* Event Summary Banner */}
                        <section className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row gap-5">
                                <div className="relative w-full sm:w-48 h-36 rounded-2xl overflow-hidden shrink-0 bg-slate-900">
                                    <img
                                        alt={event.name}
                                        className="w-full h-full object-cover"
                                        src={event.bannerUrl || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200"}
                                    />
                                </div>
                                <div className="flex flex-col justify-between py-0.5">
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-extrabold text-slate-900">{event.name}</h2>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                                <span>{event.venue}</span>
                                            </div>
                                            <span className="text-slate-300">|</span>
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                                <span>{formatDate(event.startsAt)}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                                            {event.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Ticket & Attendee Info */}
                        <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
                            <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900">Thông tin vé đã chọn</h3>
                                </div>
                                <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                                    <div className="flex items-center gap-3 sm:pr-2">
                                        <div className="w-9 h-9 rounded-xl bg-[#4353ff] text-white flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-slate-900">{bookingDetails.ticketType}</span>
                                                <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{bookingDetails.packageInfo}</span>
                                            </div>
                                            <div className="text-xs font-bold text-slate-700 mt-0.5">
                                                {bookingDetails.pricePerTicket.toLocaleString("vi-VN")}đ <span className="text-slate-400 font-normal">/ vé</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-3 sm:pt-0 sm:px-4">
                                        <span className="text-[11px] text-slate-400 block font-medium">Số lượng</span>
                                        <span className="text-xs font-bold text-slate-800 mt-1 block">{bookingDetails.quantity} vé</span>
                                    </div>
                                    <div className="pt-3 sm:pt-0 sm:px-4">
                                        <span className="text-[11px] text-slate-400 block font-medium">Tổng tiền vé</span>
                                        <span className="text-xs font-bold text-[#4353ff] mt-1 block">{totalAmount.toLocaleString("vi-VN")}đ</span>
                                    </div>
                                    <div className="pt-3 sm:pt-0 sm:pl-4">
                                        <span className="text-[11px] text-slate-400 block font-medium">Khung giờ</span>
                                        <span className="text-xs font-semibold text-slate-800 mt-1 block">{formatTime(event.startsAt)} - {formatTime(event.endsAt)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900">Thông tin người nhận vé</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 block text-[11px] mb-0.5">Họ tên</span>
                                        <span className="font-bold text-slate-800">{bookingDetails.customerName}</span>
                                    </div>
                                    <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 block text-[11px] mb-0.5">Email nhận vé</span>
                                        <span className="font-bold text-slate-800">{bookingDetails.customerEmail}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Select Payment Method */}
                        <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">Chọn phương thức thanh toán</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* VNPay Option */}
                                <div
                                    onClick={() => setPaymentMethod("vnpay")}
                                    className={`relative flex flex-col justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                                        paymentMethod === "vnpay"
                                            ? "border-2 border-[#4353ff] bg-indigo-50/20"
                                            : "border border-slate-200 hover:border-slate-300 bg-white"
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                                                <span className="font-black text-[10px] text-blue-600 tracking-tighter">VN<span className="text-red-500">PAY</span></span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-900">VNPay</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            paymentMethod === "vnpay" ? "border-[#4353ff] bg-[#4353ff]" : "border-slate-300"
                                        }`}>
                                            {paymentMethod === "vnpay" && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-4 leading-tight">
                                        Thanh toán qua QR/Thẻ ngân hàng (VNPay)
                                    </p>
                                </div>

                                {/* Mock Mode Option */}
                                <div
                                    onClick={() => setPaymentMethod("mock")}
                                    className={`relative flex flex-col justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                                        paymentMethod === "mock"
                                            ? "border-2 border-[#4353ff] bg-indigo-50/20"
                                            : "border border-slate-200 hover:border-slate-300 bg-white"
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                            </div>
                                            <span className="text-xs font-bold text-slate-900">Mock Test</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            paymentMethod === "mock" ? "border-[#4353ff] bg-[#4353ff]" : "border-slate-300"
                                        }`}>
                                            {paymentMethod === "mock" && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-4 leading-tight">
                                        Môi trường thử nghiệm (Giả lập kết quả)
                                    </p>
                                </div>

                                {/* Free/Direct Option */}
                                <div
                                    onClick={() => setPaymentMethod("free")}
                                    className={`relative flex flex-col justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                                        paymentMethod === "free"
                                            ? "border-2 border-[#4353ff] bg-indigo-50/20"
                                            : "border border-slate-200 hover:border-slate-300 bg-white"
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                            </div>
                                            <span className="text-xs font-bold text-slate-900">Đơn 0đ</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            paymentMethod === "free" ? "border-[#4353ff] bg-[#4353ff]" : "border-slate-300"
                                        }`}>
                                            {paymentMethod === "free" && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-4 leading-tight">
                                        Miễn phí / Vé mời (Xác nhận ngay)
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2.5 text-xs text-slate-600">
                                <div className="w-5 h-5 rounded-full bg-[#4353ff] text-white flex items-center justify-center shrink-0 font-bold text-xs">
                                    i
                                </div>
                                <span>Sau khi thanh toán thành công, vé điện tử và mã QR check-in sẽ được gửi trực tiếp qua email của bạn.</span>
                            </div>
                        </section>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
                                type="button"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                                Quay lại
                            </button>

                            <button
                                onClick={handlePayment}
                                className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-[#4353ff] to-indigo-600 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 transition group"
                                type="button"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                                Thanh toán ngay ({totalAmount.toLocaleString("vi-VN")}đ)
                                <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Order Summary Card */}
                    <aside className="lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl shadow-slate-100/70 space-y-5 sticky top-28">
                            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                                <div className="w-8 h-8 rounded-xl bg-[#4353ff] text-white flex items-center justify-center shadow-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <h3 className="text-base font-extrabold text-slate-900">Tóm tắt đơn hàng</h3>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Sự kiện</span>
                                    <span className="font-bold text-slate-800 text-right">{event?.name || "The Dreams Concert 2025"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Loại vé</span>
                                    <span className="font-bold text-slate-800">{bookingDetails.ticketType} ({bookingDetails.packageInfo})</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Số lượng</span>
                                    <span className="font-bold text-slate-800">{bookingDetails.quantity} vé</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Đơn giá</span>
                                    <span className="font-bold text-slate-800">{bookingDetails.pricePerTicket.toLocaleString("vi-VN")}đ</span>
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
                                    <span className="text-xs font-extrabold text-slate-800">Tổng thanh toán</span>
                                    <span className="text-2xl font-black text-[#4353ff]">{totalAmount.toLocaleString("vi-VN")}đ</span>
                                </div>
                            </div>

                            {/* Trust Badge 1 */}
                            <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100/60 flex items-start gap-3">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-[#4353ff] flex items-center justify-center shrink-0 mt-0.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-indigo-900">Bảo mật thanh toán 100%</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        Mọi giao dịch mã hóa theo chuẩn PCI-DSS an toàn tuyệt đối.
                                    </p>
                                </div>
                            </div>

                            {/* Pending Ticket Preview */}
                            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200/60">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        Chờ thanh toán
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">#{bookingDetails.orderCode}</span>
                                </div>

                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{event?.name || "The Dreams Concert 2025"}</h4>
                                        <p className="text-[11px] text-slate-500 font-medium">{bookingDetails.ticketType} • {bookingDetails.quantity} vé</p>
                                        <p className="text-[10px] text-slate-400">{event?.venue || "SVĐ Mỹ Đình, Hà Nội"}</p>
                                    </div>
                                    <div className="w-16 h-16 p-1 bg-white border border-slate-200 rounded-xl shrink-0 flex items-center justify-center">
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
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                </div>
            </main>

            <Footer />
        </div>
    );
}