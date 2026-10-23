import { Routes, Route } from "react-router-dom";
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
const Checkin = lazy(() => import("../pages/CheckinPage/Checkin"));
const AdminUsers = lazy(() => import("../pages/AdminUsersPage/AdminUsers"));

// Import thêm các trang khác sau này ở đây

export default function AppRoutes() {
  return (
    <Routes>
      {/* Route chính / */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/events/:eventId" element={<EventDetail />} />
      <Route path="/event/:eventId" element={<EventDetail />} />
      <Route path="/checkin" element={<Suspense fallback={<p role="status">Đang mở màn soát vé…</p>}><Checkin /></Suspense>} />
      <Route path="/admin/users" element={<PrivateRoute><Suspense fallback={<p role="status">Đang mở quản trị người dùng…</p>}><AdminUsers /></Suspense></PrivateRoute>} />
      {import.meta.env.DEV && <Route path="/admin/users/preview" element={<Suspense fallback={<p role="status">Đang mở bản xem thử…</p>}><AdminUsers preview /></Suspense>} />}
      <Route
        path="/manage"
        element={
          <PrivateRoute>
            <ManageEvents />
          </PrivateRoute>
        }
      />
      {import.meta.env.DEV && (
        <Route path="/manage/preview" element={<ManageEvents preview />} />
      )}
      <Route path="/manage/events/:eventId" element={<PrivateRoute><EventManagement /></PrivateRoute>} />
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
        <Route path="/event/:id" element={<EventDetail />} />
        <Route
            path="/checkout/:id"
            element={
                <PrivateRoute>
                    <Checkout />
                </PrivateRoute>
            }
        />
    </Routes>
  );
}
