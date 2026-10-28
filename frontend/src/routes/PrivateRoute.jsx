import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { hasRole } from '../utils/permissions';

export default function PrivateRoute({ children, roles = [] }) {
    const { user, isAuthenticated, loading } = useAuth();
    const location = useLocation();

    // Đang load trạng thái từ localStorage thì hiển thị màn hình chờ (tránh bị redirect nhầm)
    if (loading) {
        return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
    }

    // Nếu chưa đăng nhập, đá về trang /login
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
    }

    if (roles.length && !roles.some((role) => hasRole(user, role))) {
        return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
            <h1 className="text-2xl font-bold">Không có quyền truy cập</h1>
            <p>Tài khoản của bạn không có quyền sử dụng chức năng này.</p>
            <Link to="/home" className="text-indigo-600 underline">Về trang chủ</Link>
        </div>;
    }

    // Chỉ mount trang con sau khi kiểm tra đăng nhập và vai trò.
    return children;
}
