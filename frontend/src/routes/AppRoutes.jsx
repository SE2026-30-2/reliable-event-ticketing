import { Link, Navigate, Routes, Route } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import Login from "../pages/LoginPage/Login";
import Register from "../pages/RegisterPage/Register";
import Home from "../pages/HomePage/Home";
import PrivateRoute from "./PrivateRoute";
import Profile from "../pages/ProfilePage/Profile";
import ManageEvents from "../pages/ManageEventsPage/ManageEvents";
import EventManagement from "../pages/EventManagementPage/EventManagement";
import EventDetail from "../pages/EventDetailPage/EventDetail";
import Checkout from "../pages/CheckoutPage/Checkout";
import { lazy, Suspense } from "react";
import PaymentGateway from "../pages/PaymentPage/PaymentGateway";
import PaymentResult from "../pages/PaymentPage/PaymentResult";
import MyTickets from "../pages/MyTicketsPage/MyTickets";


const Checkin = lazy(() => import("../pages/CheckinPage/Checkin"));
const AdminUsers = lazy(() => import("../pages/AdminUsersPage/AdminUsers"));
const AdminDevices = lazy(() => import("../pages/AdminDevicesPage/AdminDevices"));
const AdminPayments = lazy(() => import("../pages/AdminPaymentsPage/AdminPayments"));

// Import thêm các trang khác sau này ở đây

export default function AppRoutes() {
  return (
    <Routes>
      {/* Route chính / */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/event/:eventId" element={<EventDetail />} />
      <Route path="/checkin" element={<Suspense fallback={<p role="status">Đang mở màn soát vé…</p>}><Checkin /></Suspense>} />
      <Route path="/admin" element={<PrivateRoute roles={['ADMIN']}><Navigate to="/admin/users" replace /></PrivateRoute>} />
      <Route path="/admin/users" element={<PrivateRoute roles={['ADMIN']}><Suspense fallback={<p role="status">Đang mở quản trị người dùng…</p>}><AdminUsers /></Suspense></PrivateRoute>} />
      <Route path="/admin/devices" element={<PrivateRoute roles={['ADMIN']}><Suspense fallback={<p role="status">Đang mở quản trị thiết bị…</p>}><AdminDevices /></Suspense></PrivateRoute>} />
      <Route path="/admin/payments" element={<PrivateRoute roles={['ADMIN']}><Suspense fallback={<p role="status">Đang mở quản trị thanh toán…</p>}><AdminPayments /></Suspense></PrivateRoute>} />
      {import.meta.env.DEV && <Route path="/admin/payments/preview" element={<Suspense fallback={<p role="status">Đang mở bản xem thử…</p>}><AdminPayments preview /></Suspense>} />}
      {import.meta.env.DEV && <Route path="/admin/devices/preview" element={<Suspense fallback={<p role="status">Đang mở bản xem thử…</p>}><AdminDevices preview /></Suspense>} />}
      {import.meta.env.DEV && <Route path="/admin/users/preview" element={<Suspense fallback={<p role="status">Đang mở bản xem thử…</p>}><AdminUsers preview /></Suspense>} />}
      <Route
        path="/manage"
        element={
          <PrivateRoute roles={['ADMIN', 'ORGANIZER']}>
            <ManageEvents />
          </PrivateRoute>
        }
      />
      {import.meta.env.DEV && (
        <Route path="/manage/preview" element={<ManageEvents preview />} />
      )}
      <Route path="/manage/events/:eventId" element={<PrivateRoute roles={['ADMIN', 'ORGANIZER']}><EventManagement /></PrivateRoute>} />
      {import.meta.env.DEV && <Route path="/manage/preview/events/:eventId" element={<EventManagement preview />} />}
      <Route
        path="/home"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
        <Route
            path="/checkout/:id"
            element={
                <PrivateRoute>
                    <Checkout />
                </PrivateRoute>
            }
        />
        <Route
            path="/payment-gateway"
            element={
                <PrivateRoute>
                    <PaymentGateway />
                </PrivateRoute>
            }
        />

        <Route path="/payment-result" element={<PaymentResult />} />
        <Route path="/my-tickets" element={<MyTickets />} />

        <Route path="*" element={<div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"><h1 className="text-2xl font-bold">Không tìm thấy trang</h1><p>Đường dẫn này không tồn tại hoặc chức năng chưa được hỗ trợ.</p><Link to="/home" className="text-indigo-600 underline">Về trang chủ</Link></div>} />
    </Routes>
  );
}
