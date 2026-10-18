import { useState, useEffect } from 'react';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');
        if (storedUser && token) {
            try {
                return JSON.parse(storedUser);
            } catch {
                localStorage.removeItem('user');
                localStorage.removeItem('access_token');
            }
        }
        return null;
    });

    const login = (userData, accessToken, refreshToken) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        if (accessToken) localStorage.setItem('access_token', accessToken);
        if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    };

    // Tự động đồng bộ state về null khi interceptor phát hiện 401 từ API được bảo vệ
    useEffect(() => {
        const handleUnauthorized = () => logout();
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const value = {
        user,
        isAuthenticated: !!user,
        loading: false,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
