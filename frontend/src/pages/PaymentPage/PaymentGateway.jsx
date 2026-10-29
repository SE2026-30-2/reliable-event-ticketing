import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { paymentService } from "../../services/paymentService";

export default function PaymentGateway() {
    const location = useLocation();
    const navigate = useNavigate();

    const bookingData = location.state || {};
    const txnRef        = bookingData.txnRef || null;
    const paymentUrl    = bookingData.paymentUrl || null;
    const amountCents   = bookingData.amountCents || 0;

    const eventName     = bookingData.eventName || "Sự kiện";
    const ticketType    = bookingData.ticketType || "Vé";
    const quantity      = bookingData.quantity || 1;
    const customerName  = bookingData.customerName || "";
    const customerEmail = bookingData.customerEmail || "";
    const orderCode     = txnRef || bookingData.orderCode || "—";

    const displayAmount = amountCents > 0
        ? Math.round(amountCents / 100).toLocaleString("vi-VN") + "đ"
        : "0đ";

    const [timeLeft, setTimeLeft]         = useState(900);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const pollingRef = useRef(null);

    const qrCodeUrl = paymentUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentUrl)}`
        : null;

    useEffect(() => {
        if (timeLeft <= 0) return;
        const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
        return () => clearInterval(t);
    }, [timeLeft]);

    // Polling định kỳ kiểm tra trạng thái từ VNPay
    useEffect(() => {
        if (!txnRef || timeLeft <= 0) return;

        const checkStatus = async () => {
            try {
                const result = await paymentService.syncPaymentStatus(txnRef);
                const status = result?.status;
                if (status === "COMPLETED") {
                    clearInterval(pollingRef.current);
                    navigate("/payment-result", {
                        state: {
                            ...bookingData,
                            status: "success",
                            paidAt: result.completedAt || new Date().toISOString(),
                            transactionId: result.txnRef || txnRef,
                        }
                    });
                } else if (status === "FAILED" || status === "REFUND_REQUIRED") {
                    clearInterval(pollingRef.current);
                    navigate("/payment-result", {
                        state: {
                            ...bookingData,
                            status: "failed",
                            failureReason: result.failureReason || "Giao dịch không thành công.",
                        }
                    });
                }
            } catch {
                // Bỏ qua lỗi mạng khi polling
            }
        };

        pollingRef.current = setInterval(checkStatus, 3000);
        return () => clearInterval(pollingRef.current);
    }, [txnRef, timeLeft, navigate, bookingData]);

    const handleConfirm = async () => {
        if (!txnRef) return;
        setIsProcessing(true);
        setErrorMessage("");
        try {
            const result = await paymentService.syncPaymentStatus(txnRef);
            if (result?.status === "COMPLETED") {
                navigate("/payment-result", {
                    state: {
                        ...bookingData,
                        status: "success",
                        paidAt: result.completedAt || new Date().toISOString(),
                        transactionId: result.txnRef || txnRef,
                    }
                });
            } else if (result?.status === "FAILED") {
                navigate("/payment-result", {
                    state: { ...bookingData, status: "failed", failureReason: result.failureReason }
                });
            } else {
                setErrorMessage("Hệ thống chưa nhận được khoản thanh toán. Vui lòng kiểm tra lại ứng dụng ngân hàng.");
            }
        } catch (err) {
            setErrorMessage(err.message || "Lỗi xác thực giao dịch.");
        } finally {
            setIsProcessing(false);
        }
    };

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
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Quét mã QR bằng ứng dụng ngân hàng hoặc ví VNPay để hoàn tất đơn hàng.</p>
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
                                <p className="text-lg font-black text-amber-800 font-mono">{formatCountdown(timeLeft)}</p>
                            </div>
                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">Đang chờ chuyển khoản</span>
                        </div>

                        <div className="flex flex-col items-center justify-center p-6 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-4">
                            <div className="relative w-56 h-56 bg-white p-3 rounded-2xl border-2 border-[#4353ff] shadow-md flex items-center justify-center overflow-hidden">
                                {qrCodeUrl ? (
                                    <img src={qrCodeUrl} alt="VNPay QR Code" className="w-full h-full object-contain" />
                                ) : (
                                    <p className="text-xs text-slate-400">Không thể tạo mã QR.</p>
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
                                disabled={isProcessing || timeLeft <= 0}
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