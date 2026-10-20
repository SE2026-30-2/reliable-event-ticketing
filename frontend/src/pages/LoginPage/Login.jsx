import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; // Import thư viện decode JWT
import { useAuth } from '../../contexts/useAuth';
import { authService } from '../../services/authService';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. Gọi API đăng nhập thông qua authService
            const data = await authService.login({ email, password });

            // 2. Bóc tách token
            const token = data?.token || data?.accessToken || data?.access_token;
            const refreshToken = data?.refreshToken;

            let userData = null;

            // 3. Giải mã (Decode) Token để lấy thông tin roles, email, fullName từ Payload
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    console.log('Decoded Token Payload:', decoded);

                    userData = {
                        id: decoded.id || decoded.sub || null,
                        email: decoded.email || decoded.sub || email,
                        fullName: decoded.fullName || decoded.name || email,
                        // Hỗ trợ bóc tách mảng roles từ các định dạng JWT chuẩn (roles, authorities, scope)
                        roles: decoded.roles || decoded.authorities || (decoded.scope ? decoded.scope.split(' ') : []),
                    };
                } catch (decodeErr) {
                    console.error('Lỗi giải mã token:', decodeErr);
                }
            }

            // Fallback nếu decode thất bại
            if (!userData) {
                userData = data?.user || { email };
            }

            // 4. Lưu thông tin user và token vào AuthContext & LocalStorage
            login(userData, token, refreshToken);

            // 5. Chuyển hướng trang
            const destination = location.state?.from;
            navigate(
                typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
                    ? destination
                    : '/home',
                { replace: true }
            );
        } catch (err) {
            console.error('Lỗi đăng nhập:', err);
            setError(err.message || 'Email hoặc mật khẩu không chính xác.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen text-slate-800 flex flex-col justify-center select-none antialiased bg-[#F8FAFD] overflow-x-hidden font-sans">
            {/* Ambient Background Blobs */}
            <div className="absolute -top-[10%] -left-[8%] w-[48vw] h-[48vw] bg-[radial-gradient(circle,rgba(219,234,254,0.75)_0%,rgba(239,246,255,0)_70%)] rounded-full blur-[45px] z-0 pointer-events-none"></div>
            <div className="absolute -top-[12%] -right-[6%] w-[45vw] h-[45vw] bg-[radial-gradient(circle,rgba(224,231,255,0.8)_0%,rgba(245,243,255,0)_70%)] rounded-full blur-[50px] z-0 pointer-events-none"></div>
            <div className="absolute -bottom-[15%] -left-[10%] w-[52vw] h-[52vw] bg-[radial-gradient(circle,rgba(191,219,254,0.65)_0%,rgba(219,234,254,0)_70%)] rounded-full blur-[55px] z-0 pointer-events-none"></div>
            <div className="absolute -bottom-[18%] -right-[8%] w-[46vw] h-[46vw] bg-[radial-gradient(circle,rgba(237,233,254,0.75)_0%,rgba(250,245,255,0)_70%)] rounded-full blur-[50px] z-0 pointer-events-none"></div>

            <main className="relative z-10 w-full max-w-[1480px] mx-auto px-6 py-8 lg:py-12 flex-1 flex flex-col justify-between">
                {/* Top Navigation Bar / Logo */}
                <header className="w-full mb-6 lg:mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
                            <svg className="w-6 h-6 transform -rotate-12" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.5 7.05h-15a2.25 2.25 0 00-2.25 2.25v1.2a1.5 1.5 0 010 3v1.2a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-1.2a1.5 1.5 0 010-3v-1.2a2.25 2.25 0 00-2.25-2.25zm-6 8.2h-3v-1.5h3v1.5zm0-3.2h-3v-1.5h3v1.5zm0-3.2h-3v-1.5h3v1.5z"></path>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-slate-900">EventPass</span>
                    </div>
                </header>

                {/* Main Grid Container */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center my-auto">
                    {/* Left Column (Brand & Showcase Section) */}
                    <section className="lg:col-span-7 flex flex-col justify-center pr-0 xl:pr-6">
                        <div className="inline-flex items-center gap-2 mb-3">
                            <span className="text-xs sm:text-sm font-extrabold tracking-wider text-indigo-600 uppercase">
                                KẾT NỐI ĐAM MÊ <span className="text-[10px] align-middle">•</span> TRẢI NGHIỆM TUYỆT VỜI
                            </span>
                        </div>

                        <h1 className="text-3xl sm:text-5xl xl:text-[54px] font-extrabold text-slate-950 tracking-tight leading-[1.18] mb-4">
                            Những sự kiện <br />
                            <span className="text-indigo-600 inline-block">tuyệt vời</span> đang chờ bạn!
                        </h1>

                        <p className="text-slate-500 text-sm sm:text-base font-normal max-w-xl leading-relaxed mb-8">
                            Từ âm nhạc, thể thao, hội thảo đến các sự kiện giải trí, đừng bỏ lỡ những khoảnh khắc đáng nhớ nhất!
                        </p>

                        {/* Feature Badges Trio */}
                        <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-xl mb-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                </div>
                                <div className="text-xs sm:text-sm font-semibold text-slate-700 leading-tight">
                                    Đa dạng<br /><span className="font-normal text-slate-500">sự kiện</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                </div>
                                <div className="text-xs sm:text-sm font-semibold text-slate-700 leading-tight">
                                    Thanh toán<br /><span className="font-normal text-slate-500">an toàn</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600 shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                </div>
                                <div className="text-xs sm:text-sm font-semibold text-slate-700 leading-tight">
                                    Trải nghiệm<br /><span className="font-normal text-slate-500">mượt mà</span>
                                </div>
                            </div>
                        </div>

                        {/* Artistic Concert Image */}
                        <div className="relative w-full max-w-lg mx-auto lg:mx-0 pt-2 pb-6">
                            <div className="relative mx-auto w-[90%] sm:w-[460px] h-[230px] sm:h-[260px] overflow-hidden shadow-2xl bg-indigo-950 rounded-3xl">
                                <img
                                    alt="Concert crowd"
                                    className="w-full h-full object-cover object-center transform scale-110 hover:scale-115 transition-transform duration-700 brightness-110 contrast-110"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBV_t_5hb_TgyB3reEX5c96Z6mYUkFlBQZnC97y0DfdtIRDhQ94MA6TRbuCUiAYt1kM8H4-hnt6h4EblUq7DHVQ94WdcQmbt8RYVPUJOMRK1jZCOM3kdxMmFkaj9cVTfzIcHJnT9fgtji5C18ppV02VW4QS86P4ltzPDNZ3MFv32WvF0bJfAVwVS8M9NWJureiql6ne3PXwmcXFhkGJFR0uw2gftSY91s7OR04d3769DNiIZIBf-LshyQ"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/70 via-indigo-600/30 to-purple-600/20 mix-blend-color"></div>
                            </div>
                        </div>
                    </section>

                    {/* Right Column (Login Card Form) */}
                    <section className="lg:col-span-5 w-full max-w-[490px] mx-auto lg:mr-0 lg:ml-auto">
                        <div className="bg-white rounded-[32px] p-8 sm:p-11 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.08),0_10px_25px_-5px_rgba(0,0,0,0.04)] border border-slate-100">
                            <div className="mb-7">
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
                                    Chào mừng trở lại!
                                </h2>
                                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                                    Đăng nhập để khám phá và đặt vé cho những sự kiện bạn yêu thích.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
                                    {error}
                                </div>
                            )}

                            {/* Login Form */}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-slate-700" htmlFor="email">
                                        Email
                                    </label>
                                    <div className="relative rounded-xl shadow-sm">
                                        <input
                                            className="block w-full pl-4 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                            id="email"
                                            type="email"
                                            placeholder="Nhập email của bạn"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
                                        Mật khẩu
                                    </label>
                                    <div className="relative rounded-xl shadow-sm">
                                        <input
                                            className="block w-full pl-4 pr-10 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Nhập mật khẩu"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-3 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg transition-all disabled:opacity-70"
                                >
                                    <span>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</span>
                                </button>
                            </form>

                            <div className="mt-8 text-center text-xs text-slate-500">
                                Chưa có tài khoản?{' '}
                                <Link className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors ml-1" to="/register">
                                    Đăng ký ngay
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>

                <footer className="w-full mt-4 text-center text-[11px] text-slate-400">
                    © EventPass. Tất cả quyền được bảo lưu.
                </footer>
            </main>
        </div>
    );
}