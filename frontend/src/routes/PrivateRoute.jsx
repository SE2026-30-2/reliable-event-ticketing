import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

export default function PrivateRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    // Đang load trạng thái từ localStorage thì hiển thị màn hình chờ (tránh bị redirect nhầm)
    if (loading) {
        return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
    }

    // Nếu chưa đăng nhập, đá về trang /login
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
    }

    // Nếu đã đăng nhập, cho phép vào trang con
    return children;
}
