import { Routes, Route } from 'react-router-dom'
import LandingPage from '../pages/LandingPage'
import Login from '../pages/LoginPage/Login'
import Register from '../pages/RegisterPage/Register';

// Import thêm các trang khác sau này ở đây

export default function AppRoutes() {
    return (
        <Routes>
            {/* Route chính / */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
        </Routes>
    )
}