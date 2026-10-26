import { Link, useLocation } from "react-router-dom";
import { useState } from 'react';
import { useAuth } from "../../contexts/useAuth";
import { canManageEvents, hasRole } from "../../utils/permissions";
import { userService } from '../../services/userService';

export default function Header({ onSearch }) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();

  const isAdmin = hasRole(user, 'ADMIN');
  const canManage = canManageEvents(user);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await userService.logout(); }
    catch { /* Local sign-out must still finish when the server is unavailable. */ }
    finally {
      logout();
      // A document navigation prevents protected-route redirects racing sign-out.
      window.location.replace('/');
    }
  };

  // Helper kiểm tra active tab
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const navigation = [
    { path: '/home', label: 'Trang chủ' },
    { path: '/checkin', label: 'Soát vé' },
    ...(canManage ? [{ path: '/manage', label: 'Quản lý sự kiện' }] : []),
    ...(isAdmin ? [{ path: '/admin', label: 'Quản trị hệ thống' }] : []),
    ...(user ? [{ path: '/history', label: 'Lịch sử đặt vé' }] : []),
  ];
  const renderNavigation = () => navigation.map(({ path, label }) => (
    <Link key={path} to={path} aria-current={isActive(path) ? 'page' : undefined}
      className={`relative py-2 transition-colors ${isActive(path) ? 'text-[#4353ff]' : 'text-slate-600 hover:text-slate-900'}`}>
      {label}
      {isActive(path) && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4353ff] rounded-full" />}
    </Link>
  ));

  return (
      <header className="font-sans text-base leading-normal bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-20 py-3 flex flex-wrap md:flex-nowrap gap-x-4 gap-y-3 items-center justify-between">
          {/* Brand Logo & Navigation */}
          <div className="flex min-w-0 md:flex-1 flex-wrap md:flex-nowrap items-center gap-x-6 gap-y-3">
            <Link to="/home" className="flex shrink-0 items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[#4353ff] flex items-center justify-center text-white shadow-md shadow-indigo-200 transform -rotate-12 group-hover:rotate-0 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5zM6 6v1.27a4.49 4.49 0 0 1 0 7.46V18h12v-3.27a4.49 4.49 0 0 1 0-7.46V6H6z"></path>
                </svg>
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Event<span className="text-[#4353ff]">Hub</span>
            </span>
            </Link>

            <nav aria-label="Điều hướng chính" className="hidden md:flex min-w-0 items-center gap-x-3 xl:gap-x-5 overflow-x-auto whitespace-nowrap text-sm xl:text-[15px] font-semibold [&>a]:shrink-0">
              {renderNavigation()}
            </nav>
          </div>

          {/* Controls */}
          <div className="flex shrink-0 items-center gap-2 xl:gap-4">
            <button
                aria-label="Tìm kiếm"
                onClick={onSearch}
                className="p-2 text-slate-500 hover:text-slate-800 transition-colors rounded-full hover:bg-slate-100"
                type="button"
            >
              <svg className="w-5 h-5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>

            {/* Tab Profile */}
            {user ? <><Link
                to="/profile"
                className="flex items-center space-x-2 py-1.5 px-3 rounded-full hover:bg-slate-100 transition-colors border border-slate-200/80"
            >
              <div className="w-7 h-7 shrink-0 rounded-full bg-indigo-100 text-[#4353ff] flex items-center justify-center font-bold text-xs">
                {user?.fullName
                    ? user.fullName.charAt(0).toUpperCase()
                    : user?.email
                        ? user.email.charAt(0).toUpperCase()
                        : "U"}
              </div>
              <span className="text-sm font-semibold text-slate-700 max-w-[80px] xl:max-w-[120px] truncate">
              {user?.fullName || user?.email || "Tài khoản"}
            </span>
            </Link>

            {/* Nút Đăng xuất */}
            <button
                onClick={handleLogout}
                disabled={signingOut}
                className="inline-flex shrink-0 items-center whitespace-nowrap space-x-1.5 px-3 xl:px-4 py-2 text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-full transition-all"
                type="button"
            >
              <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Đăng xuất</span>
            </button></> : <><Link to="/login" className="text-sm font-semibold text-indigo-600">Đăng nhập</Link><Link to="/register" className="text-sm font-semibold text-indigo-600">Đăng ký</Link></>}
          </div>
          <nav aria-label="Điều hướng trên điện thoại" className="flex w-full items-center gap-5 overflow-x-auto whitespace-nowrap text-sm font-semibold md:hidden [&>a]:shrink-0">
            {renderNavigation()}
          </nav>
        </div>
      </header>
  );
}
