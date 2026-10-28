import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../../contexts/useAuth";
import { eventService } from "../../services/eventService.js";

export default function EventDetail({ currentUser: propUser }) {
    const { user: authUser } = useAuth();
    const currentUser = propUser || authUser;
    const { eventId } = useParams();
    const navigate = useNavigate();

    // Event & Ticket Types Data States
    const [event, setEvent] = useState(null);
    const [ticketTypes, setTicketTypes] = useState([]);
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Active Tab (overview | program | venue | terms)
    const [activeTab, setActiveTab] = useState("overview");

    // Form & Booking States
    const [quantity, setQuantity] = useState(1);
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [bannerFailed, setBannerFailed] = useState(false);

    // Dynamic Quote & Submitting States
    const [quote, setQuote] = useState(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Helper: Chuyển đổi priceCents từ backend sang VNĐ
    const getTicketPrice = (ticket) => {
        if (!ticket) return 0;
        if (ticket.priceCents !== undefined && ticket.priceCents !== null) {
            return ticket.priceCents / 100;
        }
        return ticket.price || 0;
    };

    // 1. Fetch Event Info & Ticket Types list
    useEffect(() => {
        const fetchEventData = async () => {
            setLoading(true);
            try {
                const [eventData, ticketsData] = await Promise.all([
                    eventService.getEventById(eventId),
                    eventService.getTicketTypesByEventId(eventId)
                ]);
                setEvent(eventData);

                const list = ticketsData || [];
                setTicketTypes(list);
                if (list.length > 0) {
                    setSelectedTicketId(list[0].ticketTypeId || list[0].id);
                }
            } catch (err) {
                console.error("Lỗi khi tải thông tin sự kiện:", err);
                setError("Không thể tải thông tin sự kiện. Vui lòng thử lại sau.");
            } finally {
                setLoading(false);
            }
        };

        if (eventId) {
            fetchEventData();
        }
    }, [eventId]);

    // Active Ticket Type Object
    const selectedTicket = useMemo(() => {
        return ticketTypes.find((t) => (t.ticketTypeId || t.id) === selectedTicketId) || null;
    }, [ticketTypes, selectedTicketId]);

    // Check if item is out of stock for current quantity
    const isWaitlistMode = useMemo(() => {
        if (!selectedTicket) return false;
        return (selectedTicket.remaining ?? 0) < quantity;
    }, [selectedTicket, quantity]);

    // 2. Fetch Realtime Quote via API (GET /api/ticket-types/:id/quote)
    const fetchQuote = async (ticketTypeId, qty, couponCode) => {
        if (!ticketTypeId) return;
        setLoadingQuote(true);
        try {
            const quoteData = await eventService.getTicketQuote(ticketTypeId, qty, couponCode);

            if (quoteData) {
                // Quy đổi từ Cents sang VNĐ (chia 100)
                const grossVnd = (quoteData.grossCents ?? 0) / 100;
                const discountVnd = (quoteData.discountCents ?? 0) / 100;
                const totalVnd = (quoteData.totalCents ?? 0) / 100;

                // Nếu API trả về dữ liệu hợp lệ (> 0)
                if (grossVnd > 0 || totalVnd > 0) {
                    setQuote({
                        originalPrice: grossVnd,
                        discountAmount: discountVnd,
                        finalPrice: totalVnd,
                    });
                    return;
                }
            }
            throw new Error("Báo giá từ API bằng 0, chuyển sang fallback client.");
        } catch (err) {
            console.warn("Lỗi khi lấy báo giá từ server, sử dụng fallback client:", err);
            // Fallback tính toán tại Client nếu API gặp sự cố
            if (selectedTicket) {
                const unitPrice = getTicketPrice(selectedTicket);
                const originalTotal = unitPrice * qty;
                const discount = couponCode ? originalTotal * 0.1 : 0;

                setQuote({
                    originalPrice: originalTotal,
                    discountAmount: discount,
                    finalPrice: originalTotal - discount,
                });
            }
        } finally {
            setLoadingQuote(false);
        }
    };

    // Recalculate Quote when ticket, quantity, or applied coupon changes
    useEffect(() => {
        if (selectedTicketId) {
            fetchQuote(selectedTicketId, quantity, appliedCoupon);
        }
    }, [selectedTicketId, quantity, appliedCoupon]);

    // Auto-fill user info if logged in
    useEffect(() => {
        if (currentUser) {
            setFullName((prev) => prev || currentUser.fullName || currentUser.name || "");
            setEmail((prev) => prev || currentUser.email || "");
        }
    }, [currentUser]);

    const formatDate = (dateString) => {
        if (!dateString) return "";
        return new Date(dateString).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    };

    const formatTime = (dateString) => {
        if (!dateString) return "";
        return new Date(dateString).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const handleApplyCoupon = () => {
        setAppliedCoupon(couponInput.trim());
    };

    // 3. Main Action Handler: Reservation or Waitlist
    const handleAction = async () => {
        if (!currentUser) {
            alert("Vui lòng đăng nhập để thực hiện đặt vé hoặc tham gia danh sách chờ!");
            navigate("/login", { state: { from: `/event/${eventId}` } });
            return;
        }

        const isEmailVerified = currentUser.emailVerified ?? currentUser.isEmailVerified;
        if (isEmailVerified === false) {
            alert("Tài khoản của bạn chưa xác minh Email. Vui lòng kiểm tra email xác minh trước khi tiếp tục!");
            return;
        }

        if (!fullName.trim() || !email.trim()) {
            alert("Vui lòng nhập đầy đủ Họ tên và Email người nhận vé!");
            return;
        }

        setSubmitting(true);
        try {
            if (isWaitlistMode) {
                // Call Waitlist API: POST /api/ticket-types/:id/waitlist
                await eventService.joinWaitlist(selectedTicketId, {
                    quantity,
                    holderName: fullName,
                    holderEmail: email
                });
                alert("Bạn đã tham gia danh sách chờ thành công! Chúng tôi sẽ thông báo qua Email khi có vé.");
            } else {
                // Call Reservation API: POST /api/ticket-types/:id/reservations
                const reservation = await eventService.createReservation(selectedTicketId, {
                    quantity,
                    holderName: fullName,
                    holderEmail: email,
                    couponCode: appliedCoupon
                });

                const fallbackPrice = getTicketPrice(selectedTicket) * quantity;

                // Navigate to Checkout Page
                navigate(`/checkout/${reservation.id || eventId}`, {
                    state: {
                        reservationId: reservation.id,
                        ticketType: selectedTicket,
                        quantity,
                        holderName: fullName,
                        holderEmail: email,
                        quote: quote || {
                            originalPrice: fallbackPrice,
                            discountAmount: 0,
                            finalPrice: fallbackPrice
                        }
                    }
                });
            }
        } catch (err) {
            console.error("Thao tác thất bại:", err);
            alert(err.response?.data?.message || "Đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại!");
        } finally {
            setSubmitting(false);
        }
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

    if (error || !event) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Sự kiện không tồn tại</h2>
                    <p className="text-slate-500 mb-6">{error || "Không tìm thấy thông tin sự kiện yêu cầu."}</p>
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
                {/* HERO BANNER LỚN */}
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
                        </div>

                        <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-full overflow-hidden hero-mask">
                            {!bannerFailed && event.bannerUrl ? (
                                <img
                                    alt={event.name}
                                    className="w-full h-full object-cover object-center scale-105"
                                    src={event.bannerUrl}
                                    onError={() => setBannerFailed(true)}
                                />
                            ) : (
                                <div role="img" aria-label={`Ảnh bìa mặc định cho ${event.name}`} className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-indigo-500 via-violet-700 to-slate-950 text-white">
                                    <svg className="w-24 h-24 -rotate-12 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                                        <path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Zm8 0v3m0 3v4m0 3v3" />
                                    </svg>
                                    <span className="text-3xl font-extrabold tracking-tight">EventHub</span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* MAIN CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Event Tabs Details */}
                    <section className="lg:col-span-7 space-y-6">
                        <nav className="flex items-center gap-8 border-b border-slate-200 text-sm font-semibold text-slate-500">
                            {["overview", "program", "venue", "terms"].map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`pb-3 border-b-2 capitalize transition-all ${
                                        activeTab === tab
                                            ? "border-[#4353ff] text-[#4353ff] font-bold"
                                            : "border-transparent hover:text-slate-900"
                                    }`}
                                >
                                    {tab === "overview" && "Tổng quan"}
                                    {tab === "program" && "Nội dung chương trình"}
                                    {tab === "venue" && "Địa điểm"}
                                    {tab === "terms" && "Điều khoản"}
                                </button>
                            ))}
                        </nav>

                        {/* Tab Content */}
                        {activeTab === "overview" && (
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
                                <h2 className="text-lg font-bold text-slate-900">Giới thiệu sự kiện</h2>
                                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{event.description}</p>
                            </div>
                        )}
                        {activeTab === "program" && (
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                                <h2 className="text-lg font-bold text-slate-900">Lịch trình chương trình</h2>
                                <p className="text-sm text-slate-600">{event.programDetails || "Chương trình đang được cập nhật."}</p>
                            </div>
                        )}
                        {activeTab === "venue" && (
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                                <h2 className="text-lg font-bold text-slate-900">Địa điểm tổ chức</h2>
                                <p className="text-sm font-semibold text-slate-800">{event.venue}</p>
                            </div>
                        )}
                        {activeTab === "terms" && (
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                                <h2 className="text-lg font-bold text-slate-900">Quy định & Điều khoản</h2>
                                <ul className="list-disc list-inside text-sm text-slate-600 space-y-2">
                                    <li>Vé đã mua không hỗ trợ hoàn tiền hoặc hủy.</li>
                                    <li>Mang theo mã QR hợp lệ để check-in tại cổng.</li>
                                </ul>
                            </div>
                        )}
                    </section>

                    {/* Right Column: Dynamic Ticket Selector & Booking Widget */}
                    <aside className="lg:col-span-5">
                        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl shadow-slate-100/70 space-y-6 sticky top-28">
                            <h3 className="text-base font-extrabold text-slate-900">Chọn loại vé</h3>

                            {/* Ticket Types List / Selector */}
                            <div className="space-y-3">
                                {ticketTypes.length === 0 ? (
                                    <p className="text-xs text-slate-500">Chưa có thông tin vé cho sự kiện này.</p>
                                ) : (
                                    ticketTypes.map((ticket) => {
                                        const ticketId = ticket.ticketTypeId || ticket.id;
                                        const isSelected = selectedTicketId === ticketId;
                                        const priceVnd = getTicketPrice(ticket);

                                        return (
                                            <div
                                                key={ticketId}
                                                onClick={() => setSelectedTicketId(ticketId)}
                                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                                    isSelected ? "border-[#4353ff] bg-indigo-50/20" : "border-slate-200 hover:border-slate-300"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-bold text-slate-900">{ticket.name}</span>
                                                            {ticket.bundleSize > 1 && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                                                    Gói {ticket.bundleSize} vé
                                                                </span>
                                                            )}
                                                            {ticket.maxEntries > 1 && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                                                    {ticket.maxEntries} lượt vào
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Hiển thị giá VNĐ an toàn */}
                                                        <div className="text-sm font-extrabold text-[#4353ff]">
                                                            {priceVnd === 0 ? "Miễn phí" : `${priceVnd.toLocaleString("vi-VN")}đ`}
                                                        </div>

                                                        {/* Hiển thị khung giờ Check-in */}
                                                        {(ticket.validFrom || ticket.checkInWindow) && (
                                                            <div className="text-[11px] text-slate-500">
                                                                Check-in: {ticket.checkInWindow || `${formatTime(ticket.validFrom)} - ${formatTime(ticket.validUntil)}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="text-xs text-slate-400">Còn lại: </span>
                                                        <span className={`text-xs font-bold ${(ticket.remaining ?? 0) > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                                            {ticket.remaining ?? 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Coupon Code Input & Realtime Pricing */}
                            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        className="w-full pl-3 pr-3 py-2 text-xs uppercase font-bold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                                        type="text"
                                        placeholder="MÃ GIẢM GIÁ"
                                        value={couponInput}
                                        onChange={(e) => setCouponInput(e.target.value)}
                                    />
                                    <button
                                        onClick={handleApplyCoupon}
                                        className="px-4 py-2 rounded-xl bg-[#4353ff] text-white font-semibold text-xs hover:bg-indigo-700 transition"
                                        type="button"
                                    >
                                        Áp dụng
                                    </button>
                                </div>
                            </div>

                            {/* Quantity & Pricing Summary */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold text-slate-600 block mb-1">Số lượng (1 - 10)</span>
                                        <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                                            <button
                                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 font-bold hover:bg-slate-100"
                                                type="button"
                                            >
                                                -
                                            </button>
                                            <span className="w-9 text-center text-xs font-bold text-slate-800">{quantity}</span>
                                            <button
                                                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 font-bold hover:bg-slate-100"
                                                type="button"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {loadingQuote ? (
                                            <span className="text-xs text-slate-400">Đang tính toán...</span>
                                        ) : quote ? (
                                            <>
                                                <div className="text-xs text-slate-400 line-through">
                                                    {(quote.originalPrice || 0).toLocaleString("vi-VN")}đ
                                                </div>
                                                {quote.discountAmount > 0 && (
                                                    <div className="text-xs text-emerald-600 font-semibold">
                                                        Giảm: -{(quote.discountAmount || 0).toLocaleString("vi-VN")}đ
                                                    </div>
                                                )}
                                                <div className="text-xl font-extrabold text-[#4353ff]">
                                                    {quote.finalPrice === 0 ? "0đ (Miễn phí)" : `${(quote.finalPrice || 0).toLocaleString("vi-VN")}đ`}
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Form Receiver Info */}
                                <div className="space-y-3 pt-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông tin người nhận vé</h4>
                                    <div className="space-y-2">
                                        <input
                                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                                            type="text"
                                            placeholder="Họ và tên (holderName) *"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                        <input
                                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500"
                                            type="email"
                                            placeholder="Email (holderEmail) *"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Action Button (Dynamic: Reservation / Free / Waitlist) */}
                                <button
                                    onClick={handleAction}
                                    disabled={submitting || !selectedTicket}
                                    className={`w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                                        isWaitlistMode
                                            ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                                            : "bg-gradient-to-r from-[#4353ff] to-indigo-600 hover:from-indigo-700 hover:to-indigo-800 shadow-indigo-500/25"
                                    }`}
                                    type="button"
                                >
                                    {submitting ? (
                                        "Đang xử lý..."
                                    ) : isWaitlistMode ? (
                                        "Tham gia danh sách chờ (Join Waitlist)"
                                    ) : quote?.finalPrice === 0 ? (
                                        "Đặt vé miễn phí"
                                    ) : (
                                        "Đặt vé & Thanh toán"
                                    )}
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            <Footer />
        </div>
    );
}