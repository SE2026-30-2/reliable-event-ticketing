import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { ticketService } from "../../services/ticketService";
import { eventService } from "../../services/eventService";

function formatDateRange(validFrom, validUntil) {
    if (!validFrom) return "Chưa xác định";
    const start = new Date(validFrom);
    const dateStr = start.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const startTime = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (!validUntil) return `${startTime} - ${dateStr}`;
    const endTime = new Date(validUntil).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr} | ${startTime} - ${endTime}`;
}

export default function MyTickets() {
    const navigate = useNavigate();

    // Active Tab: 'tickets' | 'waitlist'
    const [activeTab, setActiveTab] = useState("tickets");

    // Data States
    const [tickets, setTickets] = useState([]);
    const [waitlist, setWaitlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ticketsPerPage = 4;

    // Transfer Modal & Form State
    const [selectedTicketForTransfer, setSelectedTicketForTransfer] = useState(null);
    const [transferEmail, setTransferEmail] = useState("");
    const [transferName, setTransferName] = useState("");
    const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

    // Fetch & Enrich dữ liệu từ API
    const loadData = async () => {
        setLoading(true);
        setError("");
        try {
            const [ticketsRes, waitlistRes] = await Promise.all([
                ticketService.getMyTickets(),
                ticketService.getMyWaitlist().catch(() => [])
            ]);

            const rawTickets = Array.isArray(ticketsRes) ? ticketsRes : ticketsRes?.content || [];
            const rawWaitlist = Array.isArray(waitlistRes) ? waitlistRes : waitlistRes?.content || [];

            // Thu thập các unique eventId để enrich thông tin tên sự kiện, venue, banner
            const uniqueEventIds = [...new Set(rawTickets.map(t => t.eventId).filter(Boolean))];
            const eventMap = {};

            await Promise.all(
                uniqueEventIds.map(async (eId) => {
                    try {
                        const eventDetail = await eventService.getEventById(eId);
                        eventMap[eId] = eventDetail;
                    } catch {}
                })
            );

            // Enrich dữ liệu Ticket
            const enrichedTickets = rawTickets.map((t) => {
                const evt = eventMap[t.eventId] || {};
                return {
                    ...t,
                    id: t.ticketId, // Standardize ID
                    eventName: evt.name || "Sự kiện #" + (t.eventId?.slice(0, 8) || ""),
                    venue: evt.venue || "Địa điểm chưa cập nhật",
                    bannerUrl: evt.bannerUrl || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=800",
                    eventDate: formatDateRange(t.validFrom, t.validUntil),
                    ticketType: t.ticketTypeName || "Vé tham dự",
                    code: t.ticketId ? t.ticketId.slice(0, 8).toUpperCase() : "—"
                };
            });

            setTickets(enrichedTickets);
            setWaitlist(rawWaitlist);
        } catch (err) {
            console.error("Lỗi khi tải dữ liệu vé:", err);
            setError(err.message || "Không thể tải danh sách vé. Vui lòng thử lại sau.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // 2. Gọi API gửi lại email vé
    const handleResendEmail = async (ticketId) => {
        try {
            await ticketService.resendTicketEmail(ticketId);
            alert("Đã gửi lại email chứa vé và mã QR thành công!");
        } catch (err) {
            alert(err.message || "Không thể gửi lại email. Vui lòng thử lại sau.");
        }
    };

    // 3. Gọi API rời khỏi danh sách chờ
    const handleLeaveWaitlist = async (waitlistId) => {
        if (!window.confirm("Bạn có chắc chắn muốn rời khỏi danh sách chờ này?")) return;
        try {
            await ticketService.leaveWaitlist(waitlistId);
            setWaitlist((prev) => prev.filter((item) => item.id !== waitlistId));
            alert("Đã rời khỏi danh sách chờ thành công.");
        } catch (err) {
            alert(err.message || "Có lỗi xảy ra khi hủy vị trí chờ.");
        }
    };

    // 4. Từ chối nhận vé được cấp (OFFERED)
    const handleRejectOffer = async (waitlistId) => {
        if (!window.confirm("Nếu bạn từ chối, vé sẽ được nhường cho người tiếp theo trong hàng đợi.")) return;
        handleLeaveWaitlist(waitlistId);
    };

    // 5. Gọi API Chuyển nhượng vé
    const handleTransferSubmit = async (e) => {
        e.preventDefault();
        if (!transferEmail || !transferName) {
            alert("Vui lòng nhập đầy đủ thông tin người nhận.");
            return;
        }

        setIsSubmittingTransfer(true);
        try {
            await ticketService.transferTicket(selectedTicketForTransfer.ticketId || selectedTicketForTransfer.id, {
                toEmail: transferEmail,
                holderName: transferName
            });

            setTickets((prev) =>
                prev.map((t) =>
                    (t.ticketId || t.id) === (selectedTicketForTransfer.ticketId || selectedTicketForTransfer.id)
                        ? { ...t, status: "TRANSFERRED", holderName: transferName }
                        : t
                )
            );

            alert(`Đã chuyển nhượng vé thành công cho ${transferName} (${transferEmail})!`);
            setSelectedTicketForTransfer(null);
            setTransferEmail("");
            setTransferName("");
        } catch (err) {
            alert(err.message || "Chuyển nhượng thất bại. Vui lòng kiểm tra lại thông tin.");
        } finally {
            setIsSubmittingTransfer(false);
        }
    };

    // Render Status Badge chuẩn xác theo Enum Backend
    const renderStatusBadge = (status, statusReason) => {
        switch (status) {
            case "ISSUED":
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-600 border border-emerald-200">ISSUED</span>;
            case "RESERVED":
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600 border border-blue-200">RESERVED</span>;
            case "TRANSFERRED":
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-600 border border-purple-200">TRANSFERRED</span>;
            case "REFUNDED":
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-600 border border-rose-200">REFUNDED</span>;
            case "CANCELLED":
                return (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-600 border border-rose-200" title={statusReason || ""}>
                        CANCELLED
                    </span>
                );
            case "VOID":
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-500 border border-slate-200">VOID</span>;
            default:
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600">{status}</span>;
        }
    };

    // Phân trang
    const indexOfLastTicket = currentPage * ticketsPerPage;
    const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
    const currentTickets = tickets.slice(indexOfFirstTicket, indexOfLastTicket);
    const totalPages = Math.ceil(tickets.length / ticketsPerPage);

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

    return (
        <div className="bg-[#F8FAFC] text-slate-800 antialiased min-h-screen flex flex-col justify-between font-sans">
            <Header />

            <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 flex-1 space-y-6">

                {/* HEADING & TABS */}
                <section className="space-y-4">
                    <nav className="flex items-center space-x-2 text-xs font-medium text-slate-500">
                        <Link to="/home" className="hover:text-[#4353ff] transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-[#4353ff] font-semibold">Vé của tôi</span>
                    </nav>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Vé của tôi & Hàng đợi</h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">Quản lý vé đã mua, theo dõi hàng đợi nhận vé và thực hiện chuyển nhượng.</p>
                    </div>

                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={loadData} className="font-bold underline">Thử lại</button>
                        </div>
                    )}

                    <div className="flex items-center space-x-3 pt-1">
                        <button
                            onClick={() => setActiveTab("tickets")}
                            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border transition ${
                                activeTab === "tickets"
                                    ? "bg-white text-[#4353ff] border-indigo-200 shadow-xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                            </svg>
                            <span>Danh sách vé ({tickets.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("waitlist")}
                            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border transition ${
                                activeTab === "waitlist"
                                    ? "bg-white text-[#4353ff] border-indigo-200 shadow-xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                            </svg>
                            <span>Hàng đợi danh sách chờ ({waitlist.length})</span>
                        </button>
                    </div>
                </section>

                {/* TAB 1: DANH SÁCH VÉ & CHUYỂN NHƯỢNG */}
                {activeTab === "tickets" && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        <section className="xl:col-span-8 bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center space-x-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4353ff]">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                    </div>
                                    <h2 className="text-base font-extrabold text-slate-900">Danh sách vé ({tickets.length})</h2>
                                </div>
                            </div>

                            {tickets.length === 0 ? (
                                <div className="text-center py-8 text-xs text-slate-400">Bạn chưa có vé nào.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {currentTickets.map((ticket) => (
                                        <div key={ticket.ticketId} className="border border-slate-200/80 rounded-2xl p-4 bg-white flex flex-col justify-between hover:shadow-sm transition">
                                            <div>
                                                <div className="flex items-start justify-between gap-2 pb-2.5">
                                                    <div className="flex gap-3 min-w-0">
                                                        <img alt={ticket.eventName} className="w-16 h-14 rounded-xl object-cover shrink-0" src={ticket.bannerUrl} />
                                                        <div className="min-w-0">
                                                            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{ticket.eventName}</h3>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">Người giữ: <span className="text-[#4353ff] font-bold">{ticket.holderName}</span></p>
                                                        </div>
                                                    </div>
                                                    {renderStatusBadge(ticket.status, ticket.statusReason)}
                                                </div>

                                                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                                                    <div className="space-y-1 text-[11px] text-slate-500 flex-1 pr-2 min-w-0">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                            <span className="truncate">{ticket.venue}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                            <span>{ticket.eventDate}</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-center pl-2 border-l border-dashed border-slate-200 shrink-0">
                                                        <div className={`w-16 h-16 border border-slate-200 rounded-xl p-1 mx-auto bg-white flex items-center justify-center ${ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED' ? 'opacity-40 grayscale' : ''}`}>
                                                            <svg className="w-full h-full text-slate-800" fill="currentColor" viewBox="0 0 100 100">
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
                                                        <p className="text-[9px] text-slate-400 font-mono mt-1">#{ticket.code}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => handleResendEmail(ticket.ticketId)}
                                                    disabled={ticket.status !== "ISSUED"}
                                                    className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 transition"
                                                    type="button"
                                                >
                                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                    <span>Gửi lại email</span>
                                                </button>

                                                <button
                                                    disabled={ticket.status !== "ISSUED"}
                                                    onClick={() => setSelectedTicketForTransfer(ticket)}
                                                    className={`flex-1 py-1.5 px-2 border rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                                                        ticket.status !== "ISSUED"
                                                            ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                                                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                                                    }`}
                                                    type="button"
                                                >
                                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                    <span>Chuyển nhượng</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {totalPages > 1 && (
                                <div className="flex justify-center pt-3 border-t border-slate-100">
                                    <nav className="flex items-center space-x-1">
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-xs"
                                        >
                                            &lt;
                                        </button>
                                        {Array.from({ length: totalPages }).map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentPage(idx + 1)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs ${
                                                    currentPage === idx + 1
                                                        ? "bg-[#4353ff] text-white shadow-xs"
                                                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                }`}
                                            >
                                                {idx + 1}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-xs"
                                        >
                                            &gt;
                                        </button>
                                    </nav>
                                </div>
                            )}
                        </section>

                        <aside className="xl:col-span-4 bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-xs">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                <div className="flex items-center space-x-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4353ff]">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                    </div>
                                    <h2 className="text-sm font-extrabold text-slate-900">Chuyển nhượng vé</h2>
                                </div>
                            </div>

                            {selectedTicketForTransfer ? (
                                <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">
                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center space-x-3">
                                        <img alt={selectedTicketForTransfer.eventName} className="w-12 h-12 rounded-xl object-cover shrink-0" src={selectedTicketForTransfer.bannerUrl} />
                                        <div className="min-w-0">
                                            <h3 className="text-xs font-bold text-slate-900 truncate">{selectedTicketForTransfer.eventName}</h3>
                                            <p className="text-[11px] text-slate-500 mt-0.5">#{selectedTicketForTransfer.code}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Email người nhận <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={transferEmail}
                                            onChange={(e) => setTransferEmail(e.target.value)}
                                            placeholder="Nhập email người nhận..."
                                            className="w-full text-xs px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-[#4353ff] transition"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Họ tên người nhận <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={transferName}
                                            onChange={(e) => setTransferName(e.target.value)}
                                            placeholder="Nhập họ tên người nhận..."
                                            className="w-full text-xs px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-[#4353ff] transition"
                                        />
                                    </div>

                                    <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-2xl flex items-start space-x-2 text-xs text-amber-800">
                                        <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">!</div>
                                        <p className="text-[11px] leading-relaxed">
                                            Sau khi chuyển nhượng thành công, mã QR cũ sẽ lập tức bị hủy hiệu lực tại cổng check-in.
                                        </p>
                                    </div>

                                    <div className="flex items-center space-x-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTicketForTransfer(null)}
                                            className="flex-1 py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmittingTransfer}
                                            className="flex-1 py-2.5 px-3 bg-[#4353ff] hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                                        >
                                            {isSubmittingTransfer ? "Đang xử lý..." : "Xác nhận chuyển"}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="py-8 text-center space-y-2">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#4353ff] flex items-center justify-center mx-auto">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Chọn một vé có trạng thái <b>ISSUED</b> và bấm <b>"Chuyển nhượng"</b> để bắt đầu.
                                    </p>
                                </div>
                            )}
                        </aside>
                    </div>
                )}

                {/* TAB 2: HÀNG ĐỢI DANH SÁCH CHỜ (WAITLIST) */}
                {activeTab === "waitlist" && (
                    <section className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                            <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4353ff]">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <h2 className="text-base font-extrabold text-slate-900">Hàng đợi danh sách chờ (Waitlist)</h2>
                            </div>
                        </div>

                        {waitlist.length === 0 ? (
                            <div className="text-center py-6 text-xs text-slate-400">Bạn không ở trong hàng đợi của sự kiện nào.</div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {waitlist.map((item) => (
                                    <article
                                        key={item.id || item.waitlistId}
                                        className={`border rounded-2xl p-4 flex flex-col justify-between transition ${
                                            item.status === "OFFERED"
                                                ? "border-emerald-200 bg-emerald-50/20"
                                                : "border-slate-200/80 bg-white hover:border-indigo-200"
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <img alt={item.eventName || "Event"} className="w-24 h-20 rounded-xl object-cover shrink-0" src={item.bannerUrl || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=800"} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{item.eventName || "Sự kiện"}</h3>
                                                    {item.status === "WAITING" ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200/60 uppercase">
                                                            WAITING
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span> OFFERED
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                            {item.status === "WAITING" ? (
                                                <>
                                                    <div>
                                                        <span className="text-[11px] text-slate-400 block font-medium">Vị trí chờ</span>
                                                        <span className="text-xl font-black text-[#4353ff]">#{item.position || 1}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleLeaveWaitlist(item.id || item.waitlistId)}
                                                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition"
                                                    >
                                                        Rời danh sách
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg text-xs font-bold">
                                                        <span>🎉 Đã có vé cho bạn!</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => navigate(`/checkout/${item.eventId}`)}
                                                            className="px-3.5 py-1.5 rounded-xl bg-[#4353ff] text-white text-xs font-extrabold hover:bg-indigo-700 shadow-xs transition"
                                                        >
                                                            Thanh toán ngay
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectOffer(item.id || item.waitlistId)}
                                                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:text-red-600 hover:border-red-200 transition"
                                                        >
                                                            Từ chối
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}

            </main>

            <Footer />
        </div>
    );
}