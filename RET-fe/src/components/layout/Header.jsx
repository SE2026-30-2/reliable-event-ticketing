import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Header() {
    const { isAuthenticated } = useAuth();
    return (
        <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                {/* Brand Logo & Main Navigation Links */}
                <div className="flex items-center space-x-12">
                    <Link to="/" className="flex items-center space-x-2.5 group">
                        <div className="w-9 h-9 rounded-xl bg-[#4353ff] flex items-center justify-center text-white shadow-md shadow-indigo-200 transform -rotate-12 group-hover:rotate-0 transition-transform">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5zM6 6v1.27a4.49 4.49 0 0 1 0 7.46V18h12v-3.27a4.49 4.49 0 0 1 0-7.46V6H6z"></path>
                            </svg>
                        </div>
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Event<span className="text-[#4353ff]">Hub</span>
            </span>
                    </Link>

                    <nav className="hidden md:flex items-center space-x-8 text-[15px] font-semibold">
                        <Link to="/" className="text-[#4353ff] relative py-2">
                            Trang chủ
                            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4353ff] rounded-full"></span>
                        </Link>
                        <a className="text-slate-600 hover:text-slate-900 transition-colors py-2" href="#events">Sự kiện</a>
                        <a className="text-slate-600 hover:text-slate-900 transition-colors py-2" href="#about">Về chúng tôi</a>
                    </nav>
                </div>

                {/* User Action Controls */}
                <div className="flex items-center space-x-5">
                    <button aria-label="Tìm kiếm" className="p-2 text-slate-500 hover:text-slate-800 transition-colors rounded-full hover:bg-slate-100" type="button">
                        <svg className="w-5 h-5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                    </button>

                    <Link className="text-[15px] font-semibold text-slate-700 hover:text-slate-900 px-2 py-1" to={isAuthenticated ? '/manage' : '/login'}>
                        {isAuthenticated ? 'Quản lý sự kiện' : 'Đăng nhập'}
                    </Link>

                    <Link className="px-5 py-2.5 bg-[#4353ff] hover:bg-[#3443e0] text-white text-[15px] font-semibold rounded-full shadow-sm hover:shadow-indigo-100 transition-all text-center" to="/register">
                        Đăng ký
                    </Link>
                </div>
            </div>
        </header>
    );
}
