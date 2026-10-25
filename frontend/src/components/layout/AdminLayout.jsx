import { Link, NavLink } from 'react-router-dom';
import Header from './Header';
import { Icon } from '../../pages/EventManagementPage/managementUi';
import '../../pages/EventManagementPage/event-management.css';
import './admin-layout.css';

const sections = [
  { path: 'users', label: 'Quản trị người dùng', icon: 'users' },
  { path: 'devices', label: 'Quản trị thiết bị', icon: 'device' },
  { path: 'payments', label: 'Quản trị giao dịch', icon: 'money' },
];

export default function AdminLayout({ children, preview = false, className = '' }) {
  return <div className={`admin-console ${className}`}>
    <Header />
    <div className="event-management admin-console-body"><div className="admin-console-layout">
      <aside className="admin-console-sidebar">
        <div className="admin-console-title"><span><Icon name="overview" /></span><div><h2>Quản trị hệ thống</h2><p>Không gian quản trị</p></div></div>
        <nav aria-label="Các mục quản trị hệ thống">{sections.map(({ path, label, icon }) => <NavLink key={path} to={`/admin/${path}${preview ? '/preview' : ''}`}><Icon name={icon} /><span>{label}</span><span className="admin-console-arrow" aria-hidden="true">›</span></NavLink>)}</nav>
        <Link className="admin-console-about" to="/#features">Về chúng tôi <span aria-hidden="true">↗</span></Link>
      </aside>
      <main className="admin-console-main">{children}</main>
    </div></div>
  </div>;
}
