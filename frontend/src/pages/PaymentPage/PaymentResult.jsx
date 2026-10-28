import { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";

export default function PaymentResult() {
    const location = useLocation();
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(location.search);
    const vnpResponseCode = queryParams.get("vnp_ResponseCode");

    const getInitialState = () => {
        if (location.state?.status) {
            return location.state.status; // 'success' | 'failed' | 'expired'
        }
        if (vnpResponseCode) {
            if (vnpResponseCode === "00") return "success";
            if (vnpResponseCode === "11" || vnpResponseCode === "24") return "expired"; // Quá hạn hoặc Hủy
            return "failed";
        }
        return "success"; // Default fallback
    };

    const [status, setStatus] = useState(getInitialState);

    // Dữ liệu giao dịch (Ưu tiên lấy từ state hoặc URL params, fallback dữ liệu mẫu)
    const transactionData = {
        orderCode: queryParams.get("vnp_TxnRef") || location.state?.orderCode || "EH20251025001",
        amount: queryParams.get("vnp_Amount")
            ? parseInt(queryParams.get("vnp_Amount")) / 100
            : location.state?.totalAmount || 2250000,
        paymentMethod: queryParams.get("vnp_BankCode") || location.state?.paymentMethod || "VNPay",
        paidAt: location.state?.paidAt || new Date().toLocaleString("vi-VN"),
        eventName: location.state?.eventName || "The Dreams Concert 2025",
        venue: location.state?.venue || "SVĐ Mỹ Đình, Hà Nội",
        eventDate: location.state?.eventDate || "25 Tháng 10, 2025 | 15:00 - 22:00",
        ticketType: location.state?.ticketType || "VIP",
        quantity: location.state?.quantity || 2,
        bannerUrl: location.state?.bannerUrl || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200",
        failureReason: location.state?.failureReason || "Giao dịch bị hủy hoặc vượt quá thời gian xác thực OTP."
    };

    return (
        <div className="bg-[#F8FAFC] text-slate-800 antialiased min-h-screen flex flex-col justify-between font-sans">
            <Header />

            <main className="flex-1 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    {/* BREADCRUMB & STATE SWITCHER */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <nav aria-label="Breadcrumb" className="flex items-center text-sm font-medium text-slate-500 space-x-2">
                            <Link to="/home" className="hover:text-[#4353ff] transition">Trang chủ</Link>
                            <span>/</span>
                            <span className="text-slate-800 font-semibold">Kết quả thanh toán</span>
                        </nav>

                        {/* Interactive Toolbar Test Switcher */}
                        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-1 self-start md:self-auto overflow-x-auto max-w-full">
                            <span className="text-[11px] text-slate-400 font-bold px-2 hidden lg:inline-block uppercase tracking-wider">Mô phỏng:</span>

                            <button
                                onClick={() => setStatus("success")}
                                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                                    status === "success"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                                        : "text-slate-600 hover:bg-slate-50 border border-transparent"
                                }`}
                                type="button"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span>Thành công</span>
                            </button>

                            <button
                                onClick={() => setStatus("failed")}
                                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                                    status === "failed"
                                        ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                                        : "text-slate-600 hover:bg-slate-50 border border-transparent"
                                }`}
                                type="button"
                            >
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                <span>Thất bại</span>
                            </button>

                            <button
                                onClick={() => setStatus("expired")}
                                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                                    status === "expired"
                                        ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                                        : "text-slate-600 hover:bg-slate-50 border border-transparent"
                                }`}
                                type="button"
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span>Hết hạn</span>
                            </button>
                        </div>
                    </div>

                    {/* MAIN TWO-COLUMN LAYOUT */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        {/* LEFT COLUMN: DYNAMIC STATE CONTENT (SPAN 8) */}
                        <div className="lg:col-span-8 flex flex-col space-y-6">

                            {/* ================= 1. TRƯỜNG HỢP: THÀNH CÔNG ================= */}
                            {status === "success" && (
                                <div className="space-y-6 animate-fadeIn">
                                    {/* Hero Banner Success */}
                                    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-purple-50 border border-indigo-100/60 p-6 sm:p-8 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 shadow-xs">
                                        <div className="relative shrink-0">
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                                <svg className="w-9 h-9 sm:w-11 sm:h-11" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="text-center sm:text-left">
                                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Thanh toán thành công!</h1>
                                            <p className="mt-1 text-xs sm:text-sm text-slate-600">Cảm ơn bạn đã tham gia sự kiện. Vé của bạn đã được xác nhận thành công.</p>
                                        </div>
                                    </section>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                        {/* Thông tin đơn hàng */}
                                        <div className="md:col-span-7 space-y-5">
                                            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center justify-between">
                                                <div className="flex items-center space-x-3.5">
                                                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] text-slate-400 font-semibold uppercase">Số tiền đã thanh toán</p>
                                                        <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">{transactionData.amount.toLocaleString("vi-VN")}đ</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-100 hidden sm:inline-block">Đã xác nhận</span>
                                            </div>

                                            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-xs space-y-4">
                                                <h2 className="text-sm font-extrabold text-slate-900">Chi tiết giao dịch</h2>
                                                <div className="divide-y divide-slate-100 text-xs">
                                                    <div className="py-2.5 flex justify-between items-center">
                                                        <span className="text-slate-500">Mã đơn hàng</span>
                                                        <span className="font-bold font-mono text-slate-800">#{transactionData.orderCode}</span>
                                                    </div>
                                                    <div className="py-2.5 flex justify-between items-center">
                                                        <span className="text-slate-500">Cổng thanh toán</span>
                                                        <span className="font-bold text-slate-800">{transactionData.paymentMethod}</span>
                                                    </div>
                                                    <div className="py-2.5 flex justify-between items-center">
                                                        <span className="text-slate-500">Thời gian thực hiện</span>
                                                        <span className="font-bold text-slate-800">{transactionData.paidAt}</span>
                                                    </div>
                                                    <div className="py-2.5 flex justify-between items-center">
                                                        <span className="text-slate-500">Trạng thái</span>
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            COMPLETED
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Alert Email Notice */}
                                            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 flex items-start space-x-3 text-xs text-blue-800">
                                                <div className="w-5 h-5 rounded-full bg-[#4353ff] text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">i</div>
                                                <span>Vé điện tử đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư (bao gồm cả thư mục Spam/Quảng cáo).</span>
                                            </div>

                                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
                                                <Link to="/profile" className="flex-1 inline-flex justify-center items-center px-4 py-3 bg-[#4353ff] hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-500/20 transition">
                                                    Quản lý vé của tôi
                                                </Link>
                                                <Link to="/home" className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-2xl transition bg-white">
                                                    Về trang chủ
                                                </Link>
                                            </div>
                                        </div>

                                        {/* Vé QR hiển thị */}
                                        <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <div className="flex items-center space-x-2 text-[#4353ff] font-extrabold text-xs">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 100-4V6z"></path>
                                                    </svg>
                                                    <span>Vé điện tử của bạn</span>
                                                </div>

                                                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-[#4353ff]">{transactionData.ticketType}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">{transactionData.quantity} vé</span>
                                                    </div>
                                                    <h4 className="font-extrabold text-slate-900 text-xs leading-snug">{transactionData.eventName}</h4>

                                                    <div className="mt-3 bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center">
                                                        <div className="w-32 h-32 bg-white p-1 border border-slate-100 rounded-lg flex items-center justify-center">
                                                            <svg className="w-full h-full text-slate-900" fill="currentColor" viewBox="0 0 100 100">
                                                                <rect fill="none" height="28" rx="2" stroke="currentColor" strokeWidth="6" width="28" x="5" y="5"></rect>
                                                                <rect height="12" width="12" x="13" y="13"></rect>
                                                                <rect fill="none" height="28" rx="2" stroke="currentColor" strokeWidth="6" width="28" x="67" y="5"></rect>
                                                                <rect height="12" width="12" x="75" y="13"></rect>
                                                                <rect fill="none" height="28" rx="2" stroke="currentColor" strokeWidth="6" width="28" x="5" y="67"></rect>
                                                                <rect height="12" width="12" x="13" y="75"></rect>
                                                                <rect height="8" width="8" x="42" y="10"></rect>
                                                                <rect height="16" width="16" x="42" y="42"></rect>
                                                                <rect height="18" width="18" x="72" y="72"></rect>
                                                            </svg>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 mt-2 font-mono">Mã vé: <strong class="text-slate-800">#{transactionData.orderCode}</strong></span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button className="mt-4 w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-[#4353ff] font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition" type="button">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round"></path>
                                                </svg>
                                                <span>Tải vé xuống (PDF)</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ================= 2. TRƯỜNG HỢP: THẤT BẠI ================= */}
                            {status === "failed" && (
                                <div className="space-y-6 animate-fadeIn">
                                    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-50 via-red-50/70 to-pink-50 border border-rose-100 p-6 sm:p-8 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 shadow-xs">
                                        <div className="relative shrink-0">
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
                                                <svg className="w-9 h-9 sm:w-11 sm:h-11" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"></path>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="text-center sm:text-left">
                                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Thanh toán thất bại!</h1>
                                            <p className="mt-1 text-xs sm:text-sm text-slate-600">Giao dịch không thành công. Vui lòng kiểm tra lại số dư hoặc thử phương thức khác.</p>
                                        </div>
                                    </section>

                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-5">
                                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start space-x-3 text-xs text-rose-800">
                                            <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-rose-900">Vé của bạn chưa được thanh toán thành công.</p>
                                                <p className="text-slate-600">Tài khoản ngân hàng chưa bị trừ tiền. Nếu đã trừ tiền, hệ thống sẽ tự động đối soát và hoàn trả trong 24-48 giờ.</p>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100 pt-4 divide-y divide-slate-100 text-xs">
                                            <div className="py-2.5 flex justify-between items-center">
                                                <span className="text-slate-500">Mã đơn hàng</span>
                                                <span className="font-bold font-mono text-slate-800">#{transactionData.orderCode}</span>
                                            </div>
                                            <div className="py-2.5 flex justify-between items-center">
                                                <span className="text-slate-500">Lý do thất bại</span>
                                                <span className="font-semibold text-rose-600">{transactionData.failureReason}</span>
                                            </div>
                                            <div className="py-2.5 flex justify-between items-center">
                                                <span className="text-slate-500">Phương thức thử</span>
                                                <span className="font-bold text-slate-800">{transactionData.paymentMethod}</span>
                                            </div>
                                        </div>

                                        <div className="pt-3 flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => navigate(-1)}
                                                className="flex-1 inline-flex justify-center items-center px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-rose-500/20 transition"
                                                type="button"
                                            >
                                                Thử thanh toán lại
                                            </button>
                                            <Link to="/home" className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-2xl transition bg-white">
                                                Quay về trang chủ
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ================= 3. TRƯỜNG HỢP: HẾT HẠN ================= */}
                            {status === "expired" && (
                                <div className="space-y-6 animate-fadeIn">
                                    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-50 via-blue-50/70 to-slate-50 border border-sky-100 p-6 sm:p-8 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 shadow-xs">
                                        <div className="relative shrink-0">
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                                <svg className="w-9 h-9 sm:w-11 sm:h-11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="text-center sm:text-left">
                                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Đơn giữ chỗ đã hết hạn</h1>
                                            <p className="mt-1 text-xs sm:text-sm text-slate-600">Đơn hàng của bạn đã bị hủy do quá thời hạn giữ chỗ 10 phút quy định.</p>
                                        </div>
                                    </section>

                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-5">
                                        <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 flex items-center justify-between text-xs text-sky-800">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">i</div>
                                                <span className="font-medium">Số tiền sẽ được hoàn trả (nếu đã chuyển): <strong className="text-sky-950 font-bold">{transactionData.amount.toLocaleString("vi-VN")}đ</strong></span>
                                            </div>
                                            <span className="bg-white px-2.5 py-1 rounded-xl text-sky-700 font-bold border border-sky-200">Tự động hoàn tiền</span>
                                        </div>

                                        <div className="border-t border-slate-100 pt-4 divide-y divide-slate-100 text-xs">
                                            <div className="py-2.5 flex justify-between items-center">
                                                <span className="text-slate-500">Mã đơn hàng</span>
                                                <span className="font-bold font-mono text-slate-800">#{transactionData.orderCode}</span>
                                            </div>
                                            <div className="py-2.5 flex justify-between items-center">
                                                <span className="text-slate-500">Thời gian giữ chỗ tối đa</span>
                                                <span className="font-bold text-slate-800">10 phút</span>
                                            </div>
                                            <div className="py-2.5 flex justify-between items-center">
                                                <span className="text-slate-500">Trạng thái giữ chỗ</span>
                                                <span className="font-bold text-rose-600">Đã trả lại vé về hệ thống</span>
                                            </div>
                                        </div>

                                        <div className="pt-3 flex flex-col sm:flex-row gap-3">
                                            <Link to="/home" className="flex-1 inline-flex justify-center items-center px-4 py-3 bg-[#4353ff] hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-500/20 transition">
                                                Đặt vé lại ngay
                                            </Link>
                                            <Link to="/home" className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-2xl transition bg-white">
                                                Khám phá sự kiện khác
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* RIGHT COLUMN: EVENT SUMMARY CARD (SPAN 4) */}
                        <aside className="lg:col-span-4 space-y-4">
                            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4 sticky top-28">
                                <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 border-b border-slate-100 pb-3">
                                    Thông tin sự kiện
                                </h3>

                                <div className="space-y-3">
                                    <div className="relative h-32 rounded-2xl overflow-hidden bg-slate-900">
                                        <img
                                            alt={transactionData.eventName}
                                            className="w-full h-full object-cover"
                                            src={transactionData.bannerUrl}
                                        />
                                    </div>

                                    <div className="space-y-2 pt-1">
                                        <h4 className="text-sm font-extrabold text-slate-900">{transactionData.eventName}</h4>

                                        <div className="space-y-1 text-xs text-slate-500 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-[#4353ff] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                                <span>{transactionData.venue}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-[#4353ff] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                                <span>{transactionData.eventDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </aside>

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}