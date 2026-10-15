import { Routes, Route } from 'react-router-dom'
import LandingPage from '../pages/LandingPage'

// Import thêm các trang khác sau này ở đây

export default function AppRoutes() {
    return (
        <Routes>
            {/* Route chính / */}
            <Route path="/" element={<LandingPage />} />

            {/* Các route khác ví dụ sau này: */}
            {/* <Route path="/login" element={<LoginPage />} /> */}
            {/* <Route path="*" element={<NotFoundPage />} /> */}
        </Routes>
    )
}