import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { eventService } from "../../services/eventService.js";

export default function EventDetail() {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // State quản lý Tab đang chọn (overview | program | venue | terms)
    const [activeTab, setActiveTab] = useState("overview");

    // States hỗ trợ đặt vé
    const [selectedTicket, setSelectedTicket] = useState("VIP");
    const [quantity, setQuantity] = useState(1);
    const [coupon, setCoupon] = useState("EVENT10");
    const [isCouponApplied, setIsCouponApplied] = useState(true);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");

    useEffect(() => {
        const fetchEventDetail = async () => {
            setLoading(true);
            try {
                const data = await eventService.getEventById(id);
                setEvent(data);
            } catch (err) {
                console.error("Lỗi khi tải thông tin sự kiện:", err);
                setError("Không thể tải thông tin sự kiện. Vui lòng thử lại sau.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchEventDetail();
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                </div>
                <Footer />
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Sự kiện không tồn tại</h2>
                    <p className="text-slate-500 mb-6">{error || "Không tìm thấy thông tin sự kiện yêu cầu."}</p>
                    <Link
                        to="/home"
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
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
                {/* HERO BANNER */}
                <section className="relative bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px] relative">
                        <div className="lg:col-span-7 p-8 lg:p-10 flex flex-col justify-between z-10 bg-gradient-to-r from-white via-white/95 to-transparent">
                            <div className="space-y-4">
                                <div>
                                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-[#4353ff] text-white tracking-wide shadow-sm shadow-indigo-600/20">
                                        {event.category || "Sự kiện"}
                                    </span>
                                </div>
                                <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                                    {event.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-sm font-semibold text-slate-600 pt-1">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                        <span>
                                            {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
                                        </span>
                                        <span className="text-slate-300">|</span>
                                        <span>{formatDate(event.startsAt)}</span>
                                    </div>
                                    <span className="hidden sm:inline text-slate-300">|</span>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                        <span>{event.venue}</span>
                                    </div>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-600 font-normal pt-1 max-w-xl">
                                    {event.description}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 pt-6">
                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                    Nghệ sĩ khách mời
                                </span>
                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    <svg className="w-3.5 h-3.5 fill-[#4353ff] text-[#4353ff]" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                    </svg>
                                    Sân khấu trải nghiệm
                                </span>
                            </div>
                        </div>

                        <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-full overflow-hidden hero-mask">
                            <img
                                alt={event.name}
                                className="w-full h-full object-cover object-center scale-105"
                                src={
                                    event.bannerUrl ||
                                    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200"
                                }
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:hidden"></div>
                        </div>

                        <div className="absolute top-5 right-5 z-20 flex items-center gap-2.5">
                            <button
                                aria-label="Chia sẻ"
                                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow hover:bg-white text-slate-700 flex items-center justify-center transition-all"
                                type="button"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                            </button>
                            <button
                                aria-label="Yêu thích"
                                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow hover:bg-white text-[#4353ff] flex items-center justify-center transition-all"
                                type="button"
                            >
                                <svg className="w-4 h-4 fill-[#4353ff]" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </section>

                {/* MAIN CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Details & Tabs */}
                    <section className="lg:col-span-7 space-y-6">
                        {/* Navigation Tabs - Đã gắn onClick và active state */}
                        <nav className="flex items-center gap-8 border-b border-slate-200 text-sm font-semibold text-slate-500">
                            <button
                                type="button"
                                onClick={() => setActiveTab("overview")}
                                className={`pb-3 border-b-2 transition-all ${
                                    activeTab === "overview"
                                        ? "border-[#4353ff] text-[#4353ff] font-bold"
                                        : "border-transparent hover:text-slate-900"
                                }`}
                            >
                                Tổng quan
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("program")}
                                className={`pb-3 border-b-2 transition-all ${
                                    activeTab === "program"
                                        ? "border-[#4353ff] text-[#4353ff] font-bold"
                                        : "border-transparent hover:text-slate-900"
                                }`}
                            >
                                Nội dung chương trình
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("venue")}
                                className={`pb-3 border-b-2 transition-all ${
                                    activeTab === "venue"
                                        ? "border-[#4353ff] text-[#4353ff] font-bold"
                                        : "border-transparent hover:text-slate-900"
                                }`}
                            >
                                Địa điểm
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("terms")}
                                className={`pb-3 border-b-2 transition-all ${
                                    activeTab === "terms"
                                        ? "border-[#4353ff] text-[#4353ff] font-bold"
                                        : "border-transparent hover:text-slate-900"
                                }`}
                            >
                                Điều khoản
                            </button>
                        </nav>

                        {/* NỘI DUNG THAY ĐỔI THEO TAB */}

                        {/* 1. Tab: Tổng quan */}
                        {activeTab === "overview" && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-2.5 text-slate-900">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            </svg>
                                        </div>
                                        <h2 className="text-lg font-bold">Giới thiệu sự kiện</h2>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                        {event.description}
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50/70">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100/70 text-[#4353ff] flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5 fill-[#4353ff]" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                                </svg>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 leading-tight">Dàn nghệ sĩ hàng đầu</span>
                                        </div>
                                        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50/70">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100/70 text-[#4353ff] flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 leading-tight">Âm thanh ánh sáng đỉnh cao</span>
                                        </div>
                                        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50/70">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100/70 text-[#4353ff] flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 leading-tight">Trải nghiệm đáng nhớ</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-[#4353ff] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                                        i
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-600">
                                        <span className="font-bold text-slate-800">Lưu ý:</span> Sự kiện dành cho mọi đối tượng. Vui lòng mang theo CCCD/CMND để check-in.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 2. Tab: Nội dung chương trình */}
                        {activeTab === "program" && (
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                                <div className="flex items-center gap-2.5 text-slate-900 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold">Lịch trình chương trình</h2>
                                </div>

                                <div className="border-l-2 border-indigo-200 ml-4 pl-4 space-y-6">
                                    <div className="relative">
                                        <div className="absolute -left-[25px] top-1 w-3.5 h-3.5 rounded-full bg-[#4353ff] border-2 border-white"></div>
                                        <span className="text-xs font-bold text-[#4353ff] uppercase tracking-wider">{formatTime(event.startsAt)}</span>
                                        <h4 className="text-sm font-bold text-slate-800">Đón khách & Check-in</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Kiểm tra vé, quét mã QR và hướng dẫn vị trí chỗ ngồi.</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[25px] top-1 w-3.5 h-3.5 rounded-full bg-[#4353ff] border-2 border-white"></div>
                                        <span className="text-xs font-bold text-[#4353ff] uppercase tracking-wider">Khai mạc</span>
                                        <h4 className="text-sm font-bold text-slate-800">Biểu diễn mở màn & Phát biểu</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Giới thiệu ban tổ chức, nhà tài trợ và các tiết mục nổi bật.</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[25px] top-1 w-3.5 h-3.5 rounded-full bg-[#4353ff] border-2 border-white"></div>
                                        <span className="text-xs font-bold text-[#4353ff] uppercase tracking-wider">{formatTime(event.endsAt)}</span>
                                        <h4 className="text-sm font-bold text-slate-800">Kết thúc chương trình</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Giao lưu nghệ sĩ và bế mạc sự kiện.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Tab: Địa điểm */}
                        {activeTab === "venue" && (
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                                <div className="flex items-center gap-2.5 text-slate-900">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold">Vị trí tổ chức</h2>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 rounded-xl border border-slate-100 gap-4 bg-slate-50/40">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-[#4353ff] flex items-center justify-center shrink-0">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            </svg>
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-bold text-slate-800">{event.venue}</h3>
                                            <p className="text-xs text-slate-500">Xem bản đồ chỉ đường đến địa điểm sự kiện</p>
                                        </div>
                                    </div>
                                    <a
                                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#4353ff] hover:underline py-2 sm:py-0 whitespace-nowrap"
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Xem bản đồ
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* 4. Tab: Điều khoản */}
                        {activeTab === "terms" && (
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                                <div className="flex items-center gap-2.5 text-slate-900">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold">Quy định & Điều khoản tham gia</h2>
                                </div>
                                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 space-y-2 leading-relaxed">
                                    <li>Vé đã mua không hỗ trợ hoàn tiền hoặc hủy dưới mọi hình thức.</li>
                                    <li>Khán giả vui lòng xuất trình mã QR điện tử hoặc vé cứng hợp lệ tại cổng soát vé.</li>
                                    <li>Không mang theo vũ khí, chất cháy nổ hoặc chất cấm vào khu vực tổ chức.</li>
                                    <li>Ban tổ chức có quyền từ chối sự tham gia của các cá nhân không tuân thủ quy định chung.</li>
                                </ul>
                            </div>
                        )}
                    </section>

                    {/* Right Column: Sticky Booking Widget */}
                    <aside className="lg:col-span-5">
                        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl shadow-slate-100/70 space-y-6 sticky top-28">
                            <div className="flex items-center gap-2.5 pb-2">
                                <div className="w-8 h-8 rounded-xl bg-[#4353ff] text-white flex items-center justify-center shadow-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <h3 className="text-base font-extrabold text-slate-900">Chọn loại vé</h3>
                            </div>

                            <div className="space-y-3">
                                <div
                                    onClick={() => setSelectedTicket("VIP")}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                        selectedTicket === "VIP"
                                            ? "border-[#4353ff] bg-indigo-50/20"
                                            : "border-slate-200 hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-[#4353ff] text-white flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900">VIP</span>
                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Trọn gói</span>
                                                </div>
                                                <div className="text-sm font-extrabold text-[#4353ff] mt-0.5">2.500.000đ</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <span className="text-xs text-slate-400">Còn lại: </span>
                                                <span className="text-xs font-bold text-emerald-600">120</span>
                                            </div>
                                            {selectedTicket === "VIP" && (
                                                <div className="w-5 h-5 rounded-full bg-[#4353ff] text-white flex items-center justify-center">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setSelectedTicket("STD")}
                                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                        selectedTicket === "STD"
                                            ? "border-2 border-[#4353ff] bg-indigo-50/20"
                                            : "border-slate-200 hover:border-slate-300 bg-white"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900">Standard</span>
                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Vé thường</span>
                                                </div>
                                                <div className="text-sm font-extrabold text-slate-800 mt-0.5">1.200.000đ</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <span className="text-xs text-slate-400">Còn lại: </span>
                                                <span className="text-xs font-bold text-slate-700">350</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                                            <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            </svg>
                                        </span>
                                        <input
                                            className="w-full pl-9 pr-3 py-2 text-xs uppercase tracking-wider font-bold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                            type="text"
                                            value={coupon}
                                            onChange={(e) => setCoupon(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setIsCouponApplied(true)}
                                        className="px-5 py-2 rounded-xl bg-[#4353ff] hover:bg-indigo-700 text-white font-semibold text-xs transition-colors"
                                        type="button"
                                    >
                                        Áp dụng
                                    </button>
                                </div>
                                {isCouponApplied && (
                                    <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                                        </svg>
                                        Coupon hợp lệ! Giảm 10%
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4 pt-1">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin đặt vé</h4>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold text-slate-600 block mb-1.5">Số lượng</span>
                                        <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                                            <button
                                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
                                                type="button"
                                            >
                                                -
                                            </button>
                                            <span className="w-9 text-center text-xs font-bold text-slate-800">{quantity}</span>
                                            <button
                                                onClick={() => setQuantity(quantity + 1)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
                                                type="button"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="text-xs text-slate-400">
                                            Tổng tiền: <span className="font-medium text-slate-600 line-through">2.500.000đ</span>
                                        </div>
                                        <div className="text-xs text-emerald-600 font-semibold flex items-center justify-end gap-1">
                                            Giảm giá (-10%): <span>250.000đ</span>
                                        </div>
                                        <div className="text-xl font-extrabold text-[#4353ff] tracking-tight">
                                            {(2250000 * quantity).toLocaleString("vi-VN")}đ
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin người nhận vé</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                Họ tên <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                className="w-full text-xs font-medium px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                type="text"
                                                placeholder="Nguyễn Văn A"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                Email <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                className="w-full text-xs font-medium px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                type="email"
                                                placeholder="nguyenvana@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#4353ff] to-indigo-600 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all group"
                                    type="button"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                    <span>Đặt vé &amp; Thanh toán</span>
                                    <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </button>

                                <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 pt-1">
                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                    <span>Thanh toán an toàn • Hỗ trợ nhiều phương thức</span>
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