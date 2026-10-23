import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.roles?.includes("ADMIN");

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Helper kiểm tra active tab
  const isActive = (path) => location.pathname === path;

  return (
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-20 py-3 flex flex-wrap gap-y-3 items-center justify-between">
          {/* Brand Logo & Navigation */}
          <div className="flex items-center space-x-12">
            <Link to="/home" className="flex items-center space-x-2.5 group">
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
              <Link to="/checkin" className={`relative py-2 transition-colors ${isActive('/checkin') ? 'text-[#4353ff]' : 'text-slate-600 hover:text-slate-900'}`}>Soát vé</Link>
              {/* Trang chủ - Ai cũng thấy */}
              <Link
                  to="/home"
                  className={`relative py-2 transition-colors ${
                      isActive("/home") ? "text-[#4353ff]" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Trang chủ
                {isActive("/home") && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4353ff] rounded-full"></span>
                )}
              </Link>

              {/* Quản lý sự kiện - Ai cũng thấy hoặc dùng chung cho cả User/Admin */}
              <Link
                  to="/manage"
                  className={`relative py-2 transition-colors ${
                      isActive("/manage") ? "text-[#4353ff]" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Quản lý sự kiện
                {isActive("/manage") && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4353ff] rounded-full"></span>
                )}
              </Link>

              {/* Chỉ ADMIN mới thấy Quản lý người dùng */}
              {isAdmin && (
                  <Link
                      to="/admin/users"
                      className={`relative py-2 transition-colors ${
                          isActive("/admin/users") ? "text-[#4353ff]" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Quản lý người dùng
                    {isActive("/admin/users") && (
                        <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4353ff] rounded-full"></span>
                    )}
                  </Link>
              )}

              {/* Lịch sử đặt vé - Thường dành cho User mua vé */}
              <Link
                  to="/history"
                  className={`relative py-2 transition-colors ${
                      isActive("/history") ? "text-[#4353ff]" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Lịch sử đặt vé
                {isActive("/history") && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4353ff] rounded-full"></span>
                )}
              </Link>
            </nav>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            <button
                aria-label="Tìm kiếm"
                className="p-2 text-slate-500 hover:text-slate-800 transition-colors rounded-full hover:bg-slate-100"
                type="button"
            >
              <svg className="w-5 h-5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>

            {/* Tab Profile */}
            <Link
                to="/profile"
                className="flex items-center space-x-2 py-1.5 px-3 rounded-full hover:bg-slate-100 transition-colors border border-slate-200/80"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-[#4353ff] flex items-center justify-center font-bold text-xs">
                {user?.fullName
                    ? user.fullName.charAt(0).toUpperCase()
                    : user?.email
                        ? user.email.charAt(0).toUpperCase()
                        : "U"}
              </div>
              <span className="text-sm font-semibold text-slate-700 max-w-[120px] truncate">
              {user?.fullName || user?.email || "Tài khoản"}
            </span>
            </Link>

            {/* Nút Đăng xuất */}
            <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-full transition-all"
                type="button"
            >
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>
  );
}
