import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { useAuth } from '../../contexts/useAuth';
import { userService } from '../../services/userService';
import { hasRole } from '../../utils/permissions';

export default function Profile() {
    const { user: authUser, logout } = useAuth();

    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resendingEmail, setResendingEmail] = useState(false);
    const [resendMessage, setResendMessage] = useState('');

    // 1. Gọi API GET /api/user/me qua userService
    useEffect(() => {
        async function fetchUserProfile() {
            try {
                setLoading(true);
                const data = await userService.getProfile();
                setProfileData(data);
            } catch (error) {
                console.error('Lỗi khi tải thông tin người dùng:', error);
                // Fallback dùng tạm dữ liệu ở AuthContext nếu API chưa hoàn thiện
                setProfileData(authUser);
            } finally {
                setLoading(false);
            }
        }

        fetchUserProfile();
    }, [authUser]);

    const currentUser = profileData || authUser || {};

    // Format thông tin người dùng
    const fullName = currentUser.fullName || currentUser.name || 'Người dùng EventHub';
    const email = currentUser.email || 'nguyenvana@example.com';
    const createdAt = currentUser.createdAt
        ? new Date(currentUser.createdAt).toLocaleDateString('vi-VN')
        : '12/10/2024';

    const isEmailVerified = currentUser.emailVerified ?? true;

    // Xác định Vai trò (Badge)
    const roles = currentUser.roles || [];
    let roleLabel = 'Người mua';
    if (roles.includes('ADMIN') || roles.includes('ROLE_ADMIN')) {
        roleLabel = 'Quản trị viên';
    } else if (roles.includes('ORGANIZER') || roles.includes('ROLE_ORGANIZER')) {
        roleLabel = 'Nhà tổ chức';
    }

    // 2. Xử lý Đăng xuất (Gửi API /api/user/logout & xóa local storage)
    const handleLogout = async () => {
        try {
            await userService.logout();
        } catch (error) {
            console.warn('API logout trả về lỗi hoặc không phản hồi:', error);
        } finally {
            logout(); // Xóa token & thông tin lưu tại client
            window.location.replace('/');
        }
    };

    // 3. Xử lý Gửi lại email xác minh (POST /api/user/email/verify/resend)
    const handleResendVerification = async () => {
        setResendingEmail(true);
        setResendMessage('');
        try {
            await userService.resendVerificationEmail();
            setResendMessage('Đã gửi lại email xác minh! Vui lòng kiểm tra hộp thư.');
        } catch (error) {
            console.error('Lỗi gửi lại email xác minh:', error);
            setResendMessage(error.response?.data?.message || error.message || 'Không thể gửi lại email xác minh lúc này.');
        } finally {
            setResendingEmail(false);
        }
    };

    if (loading && !profileData) {
        return (
            <div className="bg-[#f8fafc] min-h-screen flex items-center justify-center">
                <div className="text-indigo-600 font-semibold text-sm">Đang tải thông tin hồ sơ...</div>
            </div>
        );
    }

    return (
        <div className="bg-[#f8fafc] text-slate-800 font-sans antialiased min-h-screen flex flex-col justify-between">
            {/* Header dùng chung */}
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* CỘT TRÁI: Sidebar Điều hướng */}
                    <aside className="lg:col-span-3 space-y-2">
                        {hasRole(authUser, 'ADMIN') && <Link to="/admin" className="block px-4 py-3 bg-white border border-indigo-100 rounded-xl text-indigo-600 font-semibold text-sm">Quản trị hệ thống →</Link>}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100/80 space-y-1">
                            <button className="w-full flex items-center space-x-3 px-4 py-3 bg-indigo-50 text-indigo-600 font-bold text-sm rounded-xl transition">
                                <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Hồ sơ cá nhân</span>
                            </button>

                            <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-600 hover:bg-slate-50 font-medium text-sm rounded-xl transition">
                                <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Đơn hàng của tôi</span>
                            </button>

                            <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-600 hover:bg-slate-50 font-medium text-sm rounded-xl transition">
                                <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Sự kiện đã lưu</span>
                            </button>

                            <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-600 hover:bg-slate-50 font-medium text-sm rounded-xl transition">
                                <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Thông báo</span>
                            </button>

                            <button className="w-full flex items-center space-x-3 px-4 py-3 text-slate-600 hover:bg-slate-50 font-medium text-sm rounded-xl transition">
                                <svg className="w-5 h-5 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Cài đặt</span>
                            </button>
                        </div>

                        <div className="pt-8 px-4 text-indigo-500/80 font-['Caveat'] text-2xl hidden lg:block select-none">
                            <p>Good</p>
                            <p>Vibes</p>
                            <p>Only <span className="text-xl">♡</span></p>
                        </div>
                    </aside>

                    {/* CỘT PHẢI: Nội dung Profile chính */}
                    <section className="lg:col-span-9 space-y-6">

                        {/* HERO BANNER THÔNG TIN NGƯỜI DÙNG */}
                        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-100 via-indigo-50 to-sky-100 p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">

                                {/* Avatar Holder */}
                                <div className="relative">
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-indigo-300 text-white flex items-center justify-center font-bold text-3xl shadow-inner border-4 border-white">
                                        {fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow hover:bg-indigo-700 transition">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Tên, Email & Ngày tham gia */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-center sm:justify-start space-x-2">
                                        <h1 className="text-2xl font-extrabold text-slate-900">{fullName}</h1>
                                        <svg className="w-5 h-5 text-indigo-600 fill-current" viewBox="0 0 24 24">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium flex items-center justify-center sm:justify-start space-x-1">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>{email}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium flex items-center justify-center sm:justify-start space-x-1 pt-1">
                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Tham gia từ {createdAt}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Badges bên phải */}
                            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 shrink-0">
                <span className="px-3.5 py-1.5 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full flex items-center space-x-1.5">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                  <span>{roleLabel}</span>
                </span>

                                {isEmailVerified ? (
                                    <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-full flex items-center space-x-1.5">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    <span>Đã xác minh email</span>
                  </span>
                                ) : (
                                    <span className="px-3.5 py-1.5 bg-amber-100 text-amber-700 font-bold text-xs rounded-full flex items-center space-x-1.5">
                    <span>Chưa xác minh email</span>
                  </span>
                                )}
                            </div>
                        </div>

                        {/* LƯỚI CHI TIẾT THÔNG TIN VÀ CÁC NÚT HÀNH ĐỘNG */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            <div className="lg:col-span-7 space-y-6">
                                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">

                                    <div className="flex items-center space-x-3 pb-2 border-b border-slate-100">
                                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                        <h2 className="text-xl font-bold text-slate-900">Thông tin cá nhân</h2>
                                    </div>

                                    <div className="space-y-4 text-sm font-medium text-slate-600">
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-slate-500">Họ tên</span>
                                            <span className="text-slate-900 font-bold">{fullName}</span>
                                        </div>

                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-slate-500">Email</span>
                                            <span className="text-slate-900 font-bold">{email}</span>
                                        </div>

                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-slate-500">Ngày tham gia</span>
                                            <span className="text-slate-900 font-bold">{createdAt}</span>
                                        </div>

                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-slate-500">Trạng thái xác minh email</span>
                                            {isEmailVerified ? (
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-full inline-flex items-center gap-1">
                          ✓ Đã xác minh
                        </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-amber-50 text-amber-600 font-bold text-xs rounded-full">
                          Chưa xác minh
                        </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 space-y-3">
                                        <h3 className="font-bold text-slate-900 text-sm">Vai trò của bạn</h3>
                                        <div className="p-4 bg-indigo-50/50 rounded-2xl flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-bold text-indigo-900 text-sm">{roleLabel}</p>
                                                <p className="text-xs text-slate-500">Bạn có thể mua vé và tham gia các sự kiện trên EventHub.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {isEmailVerified ? (
                                        <div className="p-4 bg-emerald-50/60 rounded-2xl flex items-start space-x-3 border border-emerald-100">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                ✓
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-emerald-900 text-sm">Email của bạn đã được xác minh!</h4>
                                                <p className="text-xs text-emerald-700 mt-0.5">
                                                    Cảm ơn bạn đã xác minh tài khoản. Bạn có thể nhận thông báo và cập nhật thông tin sự kiện mới nhất.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-amber-50/60 rounded-2xl flex items-start space-x-3 border border-amber-100">
                                            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                !
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-amber-900 text-sm">Tài khoản chưa xác minh email</h4>
                                                <p className="text-xs text-amber-700 mt-0.5">
                                                    Vui lòng xác minh email để đảm bảo an toàn cho tài khoản và nhận vé điện tử nhanh chóng.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>

                            <div className="lg:col-span-5 space-y-6">

                                {/* Thẻ Xác minh Email */}
                                <div className="bg-emerald-50/40 rounded-3xl p-6 border border-emerald-100/80 space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-base">Xác minh email</h3>
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        {isEmailVerified
                                            ? 'Tài khoản của bạn đã được xác minh. Bạn có thể nhận thông báo và cập nhật thông tin sự kiện mới nhất.'
                                            : 'Email của bạn chưa được xác minh. Vui lòng bấm nút bên dưới để nhận liên kết xác minh qua hộp thư.'}
                                    </p>

                                    <div>
                                        {isEmailVerified ? (
                                            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl">
                        ✓ Đã xác minh
                      </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-700 text-xs font-bold rounded-xl">
                        ⚠️ Chưa xác minh
                      </span>
                                        )}
                                    </div>
                                </div>

                                {/* Thẻ Đăng xuất */}
                                <div className="bg-rose-50/40 rounded-3xl p-6 border border-rose-100/80 space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-200">
                                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                                <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-base">Đăng xuất</h3>
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Thoát khỏi tài khoản của bạn trên thiết bị này. Sau khi đăng xuất, bạn sẽ cần đăng nhập lại để tiếp tục sử dụng dịch vụ.
                                    </p>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full py-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-bold rounded-2xl shadow-md shadow-rose-200 transition-all"
                                    >
                                        Đăng xuất
                                    </button>
                                </div>

                                {/* Thẻ Nút Gửi lại email xác minh */}
                                <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-100 space-y-3">
                                    <button
                                        onClick={handleResendVerification}
                                        disabled={resendingEmail || isEmailVerified}
                                        className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-600 text-sm font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                        </svg>
                                        <span>{resendingEmail ? 'Đang gửi...' : 'Gửi lại email xác minh'}</span>
                                    </button>

                                    {resendMessage && (
                                        <p className="text-xs text-center font-medium text-indigo-600 pt-1">
                                            {resendMessage}
                                        </p>
                                    )}

                                    <p className="text-[11px] text-center text-slate-400">
                                        Chỉ áp dụng khi tài khoản chưa được xác minh.
                                    </p>
                                </div>

                            </div>

                        </div>

                    </section>

                </div>
            </main>

            <Footer />
        </div>
    );
}
