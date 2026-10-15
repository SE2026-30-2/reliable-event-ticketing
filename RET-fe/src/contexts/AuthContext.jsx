import { createContext, useContext, useState } from 'react'
import { setAuthToken } from '../services/axiosClient'

// 1. Khởi tạo Context
const AuthContext = createContext(null)

// 2. AuthProvider wrapper
export function AuthProvider({ children }) {
    // Khởi tạo lazy state từ localStorage để tránh cascading render và mất token khi F5
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user')
        const token = localStorage.getItem('access_token')

        if (storedUser && token) {
            try {
                setAuthToken(token)
                return JSON.parse(storedUser)
            } catch (error) {
                console.error('Lỗi khi đọc thông tin user từ localStorage:', error)
                localStorage.removeItem('user')
                localStorage.removeItem('access_token')
                setAuthToken(null)
            }
        }
        return null
    })

    // Hàm xử lý Lưu thông tin Đăng nhập
    const login = (userData, token) => {
        setUser(userData)
        setAuthToken(token)
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('access_token', token)
    }

    // Hàm xử lý Đăng xuất
    const logout = () => {
        setUser(null)
        setAuthToken(null)
        localStorage.removeItem('user')
        localStorage.removeItem('access_token')
    }

    const value = {
        user,
        isAuthenticated: !!user,
        loading: false,
        login,
        logout,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

// 3. Custom Hook để lấy Context dễ dàng ở các component khác
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth phải được sử dụng bên trong AuthProvider')
    }
    return context
}