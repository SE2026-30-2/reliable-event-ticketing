import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Gọi API đăng nhập thông qua authService
            const data = await authService.login({ email, password });

            // Hỗ trợ linh hoạt các kiểu response từ backend: { token, user }, { accessToken, user }, ...
            const token = data?.token || data?.accessToken || data?.access_token;
            const userData = data?.user || { email };

            login(userData, token);

            // Đăng nhập thành công, chuyển hướng về trang chủ
            navigate('/');
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

                        {/* Artistic Concert Image with Splash Mask & Doodles */}
                        <div className="relative w-full max-w-lg mx-auto lg:mx-0 pt-2 pb-6">
                            <div className="absolute -top-3 right-24 sm:right-32 text-indigo-500 w-8 h-8 pointer-events-none transform rotate-12">
                                <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
                                    <path d="M2 18h20L19 7l-4.5 4.5L12 5l-2.5 6.5L5 7 2 18z"></path>
                                </svg>
                            </div>

                            <div className="absolute top-2 left-10 text-indigo-600 pointer-events-none">
                                <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z"></path>
                                </svg>
                            </div>

                            <div className="absolute top-1/2 -left-2 text-indigo-300 pointer-events-none transform -rotate-12">
                                <svg className="w-8 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5">
                                    <path d="M2 18L10 6L18 16L24 4"></path>
                                </svg>
                            </div>

                            <div className="absolute -bottom-2 -left-2 sm:left-1 z-20 text-indigo-600 font-['Caveat'] text-2xl sm:text-3xl leading-tight transform -rotate-12 pointer-events-none select-none">
                                Good<br />Vibes<br />Only <span className="text-lg align-top">♡</span>
                            </div>

                            <div className="absolute bottom-6 right-16 text-indigo-500 pointer-events-none">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z"></path>
                                </svg>
                            </div>

                            {/* Splash Masked Concert Image Container */}
                            <div
                                className="relative mx-auto w-[90%] sm:w-[460px] h-[230px] sm:h-[260px] overflow-hidden shadow-2xl bg-indigo-950"
                                style={{
                                    clipPath: 'polygon(8% 18%, 15% 12%, 25% 15%, 33% 8%, 44% 14%, 55% 6%, 70% 12%, 82% 7%, 94% 20%, 91% 32%, 98% 44%, 93% 58%, 97% 72%, 89% 82%, 76% 88%, 68% 96%, 52% 89%, 41% 94%, 32% 87%, 21% 95%, 12% 88%, 5% 76%, 9% 62%, 2% 48%, 7% 33%)',
                                    borderRadius: '42% 58% 65% 35% / 45% 42% 58% 55%'
                                }}
                            >
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
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" strokeLinecap="round" strokeLinejoin="round"></path>
                                            </svg>
                                        </div>
                                        <input
                                            className="block w-full pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                            id="email"
                                            name="email"
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
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round"></path>
                                            </svg>
                                        </div>
                                        <input
                                            className="block w-full pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Nhập mật khẩu"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input defaultChecked className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500/30" type="checkbox" />
                                        <span className="text-xs sm:text-[13px] font-medium text-slate-700">Lưu đăng nhập</span>
                                    </label>
                                    <a className="text-xs sm:text-[13px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors" href="#">
                                        Quên mật khẩu?
                                    </a>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-3 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                                >
                                    <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                        <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                    <span>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</span>
                                </button>
                            </form>

                            <div className="relative my-6 text-center">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-100"></div>
                                </div>
                                <span className="relative px-3 bg-white text-[11px] font-medium text-slate-400">
                  Hoặc đăng nhập với
                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button className="flex items-center justify-center gap-2.5 py-2.5 px-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-xs sm:text-sm font-semibold text-slate-700" type="button">
                                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                        <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4"></path>
                                        <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" fill="#34A853"></path>
                                        <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" fill="#FBBC05"></path>
                                        <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z" fill="#EA4335"></path>
                                    </svg>
                                    <span>Google</span>
                                </button>
                                <button className="flex items-center justify-center gap-2.5 py-2.5 px-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-xs sm:text-sm font-semibold text-slate-700" type="button">
                                    <svg className="w-4 h-4 fill-slate-900 shrink-0" viewBox="0 0 24 24">
                                        <path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd"></path>
                                    </svg>
                                    <span>GitHub</span>
                                </button>
                            </div>

                            <div className="mt-8 text-center text-xs sm:text-[13px] text-slate-500">
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