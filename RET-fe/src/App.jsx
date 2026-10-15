import AppRoutes from './routes/AppRoutes'

export default function App() {
  return (
    <main>
        {/* Nếu có Navbar/Header dùng chung toàn trang thì đặt ở đây */}
        <AppRoutes />
        {/* Nếu có Footer dùng chung thì đặt ở đây */}
    </main>
  )
}