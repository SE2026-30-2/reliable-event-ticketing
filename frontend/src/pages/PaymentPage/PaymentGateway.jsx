import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { paymentService, validatePayment } from "../../services/paymentService";

export default function PaymentGateway() {
    const location = useLocation();
    const navigate = useNavigate();

    const bookingData = useMemo(() => location.state || {}, [location.state]);
    const txnRef        = bookingData.txnRef || null;
    const paymentUrl    = bookingData.paymentUrl || null;
    const amountCents   = bookingData.amountCents || 0;

    const eventName     = bookingData.eventName || "Sự kiện";
    const quantity      = bookingData.quantity || 1;
    const orderCode     = txnRef || bookingData.orderCode || "—";

    const displayAmount = amountCents > 0
        ? Math.round(amountCents / 100).toLocaleString("vi-VN") + "đ"
        : "0đ";

    const expiresAt = Date.parse(bookingData.expiresAt);
    const [now, setNow] = useState(Date.now);
    const timeLeft = Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const checking = useRef(false), controllerRef = useRef(null);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const checkStatus = useCallback(async (manual = false) => {
        if (!txnRef || checking.current || !controllerRef.current || controllerRef.current.signal.aborted) return;
        checking.current = true;
        const signal = controllerRef.current.signal;
        if (manual) { setIsProcessing(true); setErrorMessage(''); }
        try {
            const result = validatePayment(await paymentService.syncPaymentStatus(txnRef, { signal }), bookingData.reservationId);
            if (result.txnRef !== txnRef) throw new Error('Phản hồi không khớp mã giao dịch.');
            if (signal.aborted) return;
            if (result.status !== 'PENDING') {
                const params = new URLSearchParams({ vnp_TxnRef: txnRef, reservationId: result.reservationId });
                navigate(`/payment/result?${params}`, { state: { ...bookingData, payment: result } });
            } else if (manual) {
                setErrorMessage('Giao dịch đang chờ xác nhận từ máy chủ. Vui lòng kiểm tra lại sau.');
            }
        } catch (err) {
            if (!signal.aborted) setErrorMessage(err.message || 'Chưa xác nhận được giao dịch.');
        } finally {
            checking.current = false;
            if (!signal.aborted) setIsProcessing(false);
        }
    }, [txnRef, navigate, bookingData]);

    useEffect(() => {
        const controller = new AbortController(); controllerRef.current = controller;
        let timer;
        const poll = async () => { await checkStatus(); if (!controller.signal.aborted) timer = setTimeout(poll, 3000); };
        if (txnRef) timer = setTimeout(poll, 3000);
        return () => { controller.abort(); clearTimeout(timer); };
    }, [txnRef, checkStatus]);

    const handleConfirm = () => checkStatus(true);

    const formatCountdown = (s) => {
        const m = Math.floor(s / 60).toString().padStart(2, "0");
        const sec = (s % 60).toString().padStart(2, "0");
        return `${m}:${sec}`;
    };

        if (!txnRef && !paymentUrl) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
                    <h2 className="text-xl font-bold text-slate-800">Không tìm thấy giao dịch</h2>
                    <p className="text-sm text-slate-500">Vui lòng bắt đầu lại từ trang đặt vé.</p>
                    <Link to="/home" className="px-6 py-2.5 rounded-xl bg-[#4353ff] text-white font-semibold text-sm hover:bg-indigo-700 transition">
                        Về trang chủ
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="bg-[#F8FAFC] text-slate-800 antialiased min-h-screen flex flex-col justify-between">
            <Header />

            <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Cổng thanh toán an toàn</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Mở trang VNPay để chọn ngân hàng, thẻ hoặc quét QR thanh toán.</p>
                </div>

                {errorMessage && (
                    <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
                        <span>{errorMessage}</span>
                        <button onClick={() => setErrorMessage("")}>✕</button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-100 shadow-xl space-y-6">
                        <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-amber-700 uppercase">Thời gian còn lại</p>
                                <p className="text-lg font-black text-amber-800 font-mono">{timeLeft === null ? 'Theo thời hạn trên VNPay' : formatCountdown(timeLeft)}</p>
                            </div>
                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">Đang chờ chuyển khoản</span>
                        </div>

                        <div className="flex flex-col items-center justify-center p-6 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-4">
                            <div className="relative w-56 h-56 bg-white p-3 rounded-2xl border-2 border-[#4353ff] shadow-md flex items-center justify-center overflow-hidden">
                                {paymentUrl && /^https?:\/\//i.test(paymentUrl) ? (
                                    <a href={paymentUrl} className="text-center text-indigo-700 font-bold underline">Mở trang thanh toán VNPay</a>
                                ) : (
                                    <p className="text-xs text-slate-400">Chưa có đường dẫn thanh toán hợp lệ. Vui lòng kiểm tra lại đơn.</p>
                                )}
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-xs font-bold text-slate-700">Số tiền: <span className="text-base font-black text-[#4353ff]">{displayAmount}</span></p>
                                <p className="text-[11px] text-slate-400 font-mono">Nội dung CK: <span className="font-bold text-slate-700">{orderCode}</span></p>
                            </div>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                            <button
                                onClick={handleConfirm}
                                disabled={isProcessing || !txnRef}
                                className="w-full sm:flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#4353ff] to-indigo-600 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2"
                                type="button"
                            >
                                {isProcessing ? "Đang xác thực..." : "Tôi đã thanh toán thành công"}
                            </button>
                            <button onClick={() => navigate(-1)} className="w-full sm:w-auto px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-xs font-bold" type="button">Hủy</button>
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-3 text-xs">
                            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100">Chi tiết đơn hàng</h3>
                            <div className="flex justify-between"><span>Mã đơn</span><span className="font-mono font-bold">#{orderCode}</span></div>
                            <div className="flex justify-between"><span>Sự kiện</span><span className="font-bold">{eventName}</span></div>
                            <div className="flex justify-between"><span>Số lượng</span><span className="font-bold">{quantity} vé</span></div>
                            <div className="pt-3 border-t flex justify-between items-baseline"><span className="font-extrabold">Tổng tiền</span><span className="text-xl font-black text-[#4353ff]">{displayAmount}</span></div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
