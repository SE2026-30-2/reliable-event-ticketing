import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { eventService } from "../../services/eventService.js";
import { paymentService } from "../../services/paymentService.js";
import { ticketService } from "../../services/ticketService.js";

function formatCountdown(seconds) {
    if (seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
    });
}

function formatTime(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString("vi-VN", {
        hour: "2-digit", minute: "2-digit",
    });
}

function formatVnd(cents) {
    if (!cents && cents !== 0) return "0đ";
    return Math.round(cents / 100).toLocaleString("vi-VN") + "đ";
}

function QrPlaceholder() {
    return (
        <svg className="w-full h-full text-slate-800" fill="currentColor" viewBox="0 0 100 100">
            <path d="M10 10 h30 v30 h-30 z M16 16 v18 h18 v-18 z M22 22 h6 v6 h-6 z" />
            <path d="M60 10 h30 v30 h-30 z M66 16 v18 h18 v-18 z M72 22 h6 v6 h-6 z" />
            <path d="M10 60 h30 v30 h-30 z M16 66 v18 h18 v-18 z M22 72 h6 v6 h-6 z" />
            <rect height="8" width="8" x="46" y="10" />
            <rect height="12" width="8" x="46" y="24" />
            <rect height="8" width="12" x="10" y="46" />
            <rect height="8" width="8" x="28" y="46" />
            <rect height="8" width="8" x="46" y="46" />
            <rect height="8" width="14" x="60" y="46" />
            <rect height="14" width="8" x="46" y="60" />
            <rect height="16" width="16" x="74" y="74" />
        </svg>
    );
}

async function pollUntilIssued(ticketIds, maxAttempts = 20, intervalMs = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        const results = await Promise.all(ticketIds.map((id) => ticketService.getTicketById(id)));
        if (results.every((t) => t?.status === "ISSUED")) {
            return results;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
}

export default function Checkout() {
    const { id: eventId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const locationState = location.state || {};
    const reservationId = locationState.reservationId || null;
    const tickets      = locationState.tickets || [];
    const amountCents  = locationState.amountCents ?? locationState.totalAmountCents ?? null;
    const discountCents = locationState.discountCents ?? 0;

    const displayTotalAmount = locationState.totalAmount ?? 0;
    const displayUnitPrice   = locationState.pricePerTicket ?? 0;
    const displayQuantity    = locationState.quantity ?? tickets.length ?? 1;
    const ticketTypeName     = locationState.ticketType ?? "Vé";
    const customerName       = locationState.customerName ?? locationState.holderName ?? "";
    const customerEmail      = locationState.customerEmail ?? locationState.holderEmail ?? "";

    const firstExpiry = tickets[0]?.reservationExpiresAt;
    const initialSeconds = firstExpiry
        ? Math.max(0, Math.floor((new Date(firstExpiry).getTime() - Date.now()) / 1000))
        : 600;

    const [event, setEvent]               = useState(null);
    const [loadingEvent, setLoadingEvent] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState("mock_success");
    const [timeLeft, setTimeLeft]         = useState(initialSeconds);
    const expired = timeLeft <= 0;

    const [paying, setPaying]         = useState(false);
    const [payError, setPayError]     = useState("");
    const [missingState]              = useState(!reservationId);

    useEffect(() => {
        if (!eventId) { setLoadingEvent(false); return; }
        eventService.getEventById(eventId)
            .then((data) => setEvent(data))
            .catch(() => {})
            .finally(() => setLoadingEvent(false));
    }, [eventId]);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
        return () => clearInterval(t);
    }, [timeLeft]);

    const handlePayment = useCallback(async () => {
        if (!reservationId) return;
        setPaying(true);
        setPayError("");

        try {
            let forceOutcome = null;
            if (paymentMethod === "mock_success") forceOutcome = "COMPLETED";
            if (paymentMethod === "mock_failed")  forceOutcome = "FAILED";

            const result = await paymentService.createPaymentRequest(reservationId, forceOutcome);

            // --- TRƯỜNG HỢP VNPAY: Chuyển hướng sang PaymentGateway để hiển thị QR ---
            if (result.status === "PENDING" && result.paymentUrl) {
                navigate("/payment-gateway", {
                    state: {
                        ...result,
                        eventName: event?.name || "Sự kiện",
                        ticketType: ticketTypeName,
                        quantity: displayQuantity,
                        customerName,
                        customerEmail,
                        orderCode: result.txnRef || reservationId,
                    }
                });
                return;
            }

            // --- TRƯỜNG HỢP MOCK / COMPLETED: Chuyển thẳng tới PaymentResult ---
            if (result.status === "COMPLETED") {
                const ticketIds = tickets.map((t) => t.ticketId || t.id);
                const issued = await pollUntilIssued(ticketIds);

                navigate("/payment-result", {
                    state: {
                        status: "success",
                        orderCode: result.txnRef || reservationId,
                        totalAmount: displayTotalAmount,
                        amountCents: result.amountCents || amountCents,
                        paymentMethod: "Thanh toán giả lập",
                        paidAt: new Date().toLocaleString("vi-VN"),
                        eventName: event?.name || "Sự kiện",
                        venue: event?.venue || "",
                        ticketType: ticketTypeName,
                        quantity: displayQuantity,
                        bannerUrl: event?.bannerUrl,
                        tickets: issued || tickets
                    }
                });
                return;
            }

            // --- TRƯỜNG HỢP MOCK FAILED ---
            if (result.status === "FAILED") {
                navigate("/payment-result", {
                    state: {
                        status: "failed",
                        orderCode: result.txnRef || reservationId,
                        failureReason: result.failureReason || "Thanh toán giả lập thất bại."
                    }
                });
            }

        } catch (err) {
            console.error("Payment Error:", err.response?.data || err);
            const serverError = err.response?.data?.message || err.message;
            if (err.response?.status === 400 && serverError?.toLowerCase().includes("force")) {
                setPayError("Server chưa bật tính năng Mock giả lập. Vui lòng chọn phương thức VNPay.");
            } else {
                setPayError(serverError || "Không thể khởi tạo thanh toán.");
            }
        } finally {
            setPaying(false);
        }
    }, [reservationId, paymentMethod, tickets, navigate, event, ticketTypeName, displayQuantity, customerName, customerEmail, displayTotalAmount, amountCents]);

    if (missingState) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                        <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Không tìm thấy đơn đặt chỗ</h2>
                    <p className="text-sm text-slate-500 max-w-xs">
                        Phiên thanh toán đã hết hạn hoặc trang được tải lại. Vui lòng đặt vé lại từ trang sự kiện.
                    </p>
                    <Link to="/home" className="mt-2 px-6 py-2.5 rounded-xl bg-[#4353ff] text-white font-semibold text-sm hover:bg-indigo-700 transition">
                        Về trang chủ
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    const displayTotal = amountCents != null ? formatVnd(amountCents) : `${displayTotalAmount.toLocaleString("vi-VN")}đ`;
    const displayDiscount = discountCents > 0 ? formatVnd(discountCents) : null;
    const isFreeOrder = (amountCents != null && amountCents === 0) || displayTotalAmount === 0;

    return (
        <div className="bg-[#F8FAFC] text-slate-800 antialiased min-h-screen flex flex-col justify-between">
            <Header />

            <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <div className="flex items-center space-x-2 text-sm text-slate-400 mb-2">
                            <Link to="/home" className="hover:text-slate-600 transition">Trang chủ</Link>
                            <span>/</span>
                            <span className="text-slate-500 font-medium">Thanh toán đơn đặt chỗ</span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Thanh toán đơn đặt chỗ</h1>
                        <p className="text-sm text-slate-500 mt-1">Vui lòng hoàn tất thanh toán trong thời gian giữ chỗ để xác nhận đơn hàng.</p>
                    </div>

                    <div className={`rounded-2xl p-4 flex items-center gap-6 shadow-xs self-start lg:self-auto min-w-[340px] border ${expired ? "bg-red-50/80 border-red-200" : "bg-rose-50/70 border-rose-200/80"}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${expired ? "bg-red-600" : "bg-rose-500 shadow-rose-200"}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-rose-500">
                                    {expired ? "Đơn đã hết hạn" : "Thời gian giữ chỗ còn lại"}
                                </div>
                                <div className={`text-2xl font-black tracking-wider mt-0.5 ${expired ? "text-red-600" : "text-rose-600"}`}>
                                    {expired ? "00:00" : formatCountdown(timeLeft)}
                                </div>
                            </div>
                        </div>
                        <div className="h-10 w-[1px] bg-rose-200" />
                        <p className="text-xs text-slate-500 leading-relaxed max-w-[150px]">
                            {expired
                                ? "Đơn giữ chỗ đã bị hủy tự động."
                                : "Sau khi hết thời gian, đơn đặt chỗ sẽ tự động bị hủy."}
                        </p>
                    </div>
                </div>

                {expired && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-5 flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</div>
                        <div>
                            <p className="font-bold text-red-800 text-sm">Đơn giữ chỗ đã hết hạn</p>
                            <p className="text-xs text-slate-600 mt-1">Quota vé đã được trả lại. Vui lòng đặt lại từ trang sự kiện.</p>
                            <Link to="/home" className="inline-block mt-3 px-4 py-2 rounded-xl bg-[#4353ff] text-white text-xs font-bold hover:bg-indigo-700 transition">
                                Đặt vé lại
                            </Link>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-7 space-y-6">
                        <section className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row gap-5">
                                <div className="relative w-full sm:w-48 h-36 rounded-2xl overflow-hidden shrink-0 bg-slate-900">
                                    {event?.bannerUrl && (
                                        <img alt={event?.name} className="w-full h-full object-cover" src={event.bannerUrl} />
                                    )}
                                    {!event?.bannerUrl && (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-between py-0.5">
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-extrabold text-slate-900">{event?.name || "Đang tải..."}</h2>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                                            {event?.venue && (
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                                    </svg>
                                                    <span>{event.venue}</span>
                                                </div>
                                            )}
                                            {event?.startsAt && (
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-[#4353ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                                    </svg>
                                                    <span>{formatDate(event.startsAt)} {formatTime(event.startsAt)} — {formatTime(event.endsAt)}</span>
                                                </div>
                                            )}
                                        </div>
                                        {event?.description && (
                                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{event.description}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
                            <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900">Thông tin vé đã chọn</h3>
                                </div>
                                <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                                    <div className="flex items-center gap-3 sm:pr-2">
                                        <div className="w-9 h-9 rounded-xl bg-[#4353ff] text-white flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <span className="font-bold text-xs text-slate-900">{ticketTypeName}</span>
                                            <div className="text-xs font-bold text-slate-700 mt-0.5">
                                                {displayUnitPrice > 0
                                                    ? `${displayUnitPrice.toLocaleString("vi-VN")}đ / vé`
                                                    : "Miễn phí"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-3 sm:pt-0 sm:px-4">
                                        <span className="text-[11px] text-slate-400 block font-medium">Số lượng</span>
                                        <span className="text-xs font-bold text-slate-800 mt-1 block">{displayQuantity} vé</span>
                                    </div>
                                    <div className="pt-3 sm:pt-0 sm:px-4">
                                        <span className="text-[11px] text-slate-400 block font-medium">Tổng tiền vé</span>
                                        <span className="text-xs font-bold text-[#4353ff] mt-1 block">{displayTotal}</span>
                                        {displayDiscount && (
                                            <span className="text-[10px] text-emerald-600 font-semibold">Tiết kiệm: {displayDiscount}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900">Thông tin người nhận vé</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 block text-[11px] mb-0.5">Họ tên</span>
                                        <span className="font-bold text-slate-800">{customerName || "—"}</span>
                                    </div>
                                    <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 block text-[11px] mb-0.5">Email nhận vé</span>
                                        <span className="font-bold text-slate-800">{customerEmail || "—"}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">Chọn phương thức thanh toán</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <PayMethodCard
                                    id="vnpay"
                                    selected={paymentMethod}
                                    onSelect={setPaymentMethod}
                                    label="VNPay"
                                    description="QR / Thẻ ngân hàng (VNPay)"
                                    icon={<span className="font-black text-[10px] text-blue-600 tracking-tighter">VN<span className="text-red-500">PAY</span></span>}
                                    disabled={expired}
                                />
                                <PayMethodCard
                                    id="mock_success"
                                    selected={paymentMethod}
                                    onSelect={setPaymentMethod}
                                    label="Mock ✓"
                                    description="Giả lập thanh toán THÀNH CÔNG"
                                    icon={
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                    }
                                    disabled={expired}
                                />
                                <PayMethodCard
                                    id="mock_failed"
                                    selected={paymentMethod}
                                    onSelect={setPaymentMethod}
                                    label="Mock ✗"
                                    description="Giả lập thanh toán THẤT BẠI"
                                    icon={
                                        <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                    }
                                    disabled={expired}
                                />
                                <PayMethodCard
                                    id="free"
                                    selected={paymentMethod}
                                    onSelect={setPaymentMethod}
                                    label="Đơn 0đ"
                                    description="Miễn phí / Vé mời (Xác nhận ngay)"
                                    icon={
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                    }
                                    disabled={expired}
                                />
                            </div>
                        </section>

                        {payError && (
                            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</div>
                                <div>
                                    <p className="font-bold text-rose-800 text-sm">Thanh toán thất bại</p>
                                    <p className="text-xs text-slate-600 mt-0.5">{payError}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
                                type="button"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                </svg>
                                Quay lại
                            </button>

                            <button
                                onClick={handlePayment}
                                disabled={paying || expired}
                                className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-[#4353ff] to-indigo-600 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg transition group"
                                type="button"
                            >
                                {paying ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Đang xử lý...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>
                                            {isFreeOrder
                                                ? "Xác nhận (miễn phí)"
                                                : paymentMethod === "mock_failed"
                                                    ? "Giả lập thất bại"
                                                    : `Thanh toán ngay (${displayTotal})`}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <aside className="lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl space-y-5 sticky top-28">
                            <h3 className="text-base font-extrabold text-slate-900 pb-2 border-b border-slate-100">Tóm tắt đơn hàng</h3>
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Sự kiện</span>
                                    <span className="font-bold text-slate-800 text-right max-w-[60%] truncate">{event?.name || "Đang tải..."}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Loại vé</span>
                                    <span className="font-bold text-slate-800">{ticketTypeName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Số lượng</span>
                                    <span className="font-bold text-slate-800">{displayQuantity} vé</span>
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
                                    <span className="text-xs font-extrabold text-slate-800">Tổng thanh toán</span>
                                    <span className="text-2xl font-black text-[#4353ff]">{displayTotal}</span>
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

function PayMethodCard({ id, selected, onSelect, label, description, icon, disabled }) {
    const isSelected = selected === id;
    return (
        <div
            onClick={() => !disabled && onSelect(id)}
            className={`relative flex flex-col justify-between p-4 rounded-2xl transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${
                isSelected
                    ? "border-2 border-[#4353ff] bg-indigo-50/20"
                    : "border border-slate-200 hover:border-slate-300 bg-white"
            }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4353ff] flex items-center justify-center">
                        {icon}
                    </div>
                    <span className="text-xs font-bold text-slate-900">{label}</span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? "border-[#4353ff] bg-[#4353ff]" : "border-slate-300"
                }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-4 leading-tight">{description}</p>
        </div>
    );
}