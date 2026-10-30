import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        async function handleVerify() {
            if (!token) {
                setStatus('error');
                setMessage('Mã xác thực (token) không hợp lệ hoặc thiếu trong liên kết.');
                return;
            }

            try {
                // Gọi API POST /api/user/email/verify qua userService
                await userService.verifyEmail(token);
                setStatus('success');
                setMessage('Xác minh email thành công! Tài khoản của bạn đã được kích hoạt.');
            } catch (err) {
                console.error('Lỗi xác minh email:', err);
                setStatus('error');
                setMessage(err.response?.data?.message || err.message || 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.');
            }
        }

        handleVerify();
    }, [token]);

    return (
        <div className="relative min-h-screen text-slate-800 flex flex-col justify-center select-none antialiased bg-[#F8FAFD] overflow-x-hidden font-sans">
            {/* Ambient Background Blobs */}
            <div className="absolute -top-[10%] -left-[8%] w-[48vw] h-[48vw] bg-[radial-gradient(circle,rgba(219,234,254,0.75)_0%,rgba(239,246,255,0)_70%)] rounded-full blur-[45px] z-0 pointer-events-none"></div>
            <div className="absolute -top-[12%] -right-[6%] w-[45vw] h-[45vw] bg-[radial-gradient(circle,rgba(224,231,255,0.8)_0%,rgba(245,243,255,0)_70%)] rounded-full blur-[50px] z-0 pointer-events-none"></div>
            <div className="absolute -bottom-[15%] -left-[10%] w-[52vw] h-[52vw] bg-[radial-gradient(circle,rgba(191,219,254,0.65)_0%,rgba(219,234,254,0)_70%)] rounded-full blur-[55px] z-0 pointer-events-none"></div>
            <div className="absolute -bottom-[18%] -right-[8%] w-[46vw] h-[46vw] bg-[radial-gradient(circle,rgba(237,233,254,0.75)_0%,rgba(250,245,255,0)_70%)] rounded-full blur-[50px] z-0 pointer-events-none"></div>

            <main className="relative z-10 w-full max-w-[1480px] mx-auto px-6 py-8 lg:py-12 flex-1 flex flex-col justify-between">
                {/* Header Logo */}
                <header className="w-full mb-6 lg:mb-8 text-center sm:text-left">
                    <Link to="/" className="inline-flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
                            <svg className="w-6 h-6 transform -rotate-12" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.5 7.05h-15a2.25 2.25 0 00-2.25 2.25v1.2a1.5 1.5 0 010 3v1.2a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-1.2a1.5 1.5 0 010-3v-1.2a2.25 2.25 0 00-2.25-2.25zm-6 8.2h-3v-1.5h3v1.5zm0-3.2h-3v-1.5h3v1.5zm0-3.2h-3v-1.5h3v1.5z"></path>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-slate-900">EventPass</span>
                    </Link>
                </header>

                {/* Card trạng thái xử lý */}
                <div className="w-full max-w-[520px] mx-auto my-auto">
                    <div className="bg-white rounded-[32px] p-8 sm:p-11 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.08),0_10px_25px_-5px_rgba(0,0,0,0.04)] border border-slate-100 text-center space-y-6">

                        {/* State 1: Đang xử lý */}
                        {status === 'loading' && (
                            <div className="space-y-4 py-4">
                                <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900">Đang xác minh email...</h2>
                                <p className="text-sm text-slate-500">Vui lòng đợi trong giây lát, hệ thống đang kiểm tra liên kết của bạn.</p>
                            </div>
                        )}

                        {/* State 2: Thành công */}
                        {status === 'success' && (
                            <div className="space-y-5 py-2">
                                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                                    <svg className="w-9 h-9 fill-current" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Thành công!</h2>
                                <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
                                >
                                    Đăng nhập ngay
                                </button>
                            </div>
                        )}

                        {/* State 3: Thất bại */}
                        {status === 'error' && (
                            <div className="space-y-5 py-2">
                                <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/20">
                                    <svg className="w-9 h-9 fill-current" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Xác minh thất bại</h2>
                                <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <Link
                                        to="/profile"
                                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
                                    >
                                        Gửi lại yêu cầu từ Hồ sơ
                                    </Link>
                                    <Link
                                        to="/login"
                                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all"
                                    >
                                        Về Đăng nhập
                                    </Link>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                <footer className="w-full mt-4 text-center text-[11px] text-slate-400">
                    © EventPass. Tất cả quyền được bảo lưu.
                </footer>
            </main>
        </div>
    );
}