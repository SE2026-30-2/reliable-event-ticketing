/**
 * Component Loading chung cho toàn bộ dự án EventPass.
 * - LoadingSpinner: spinner xoay nhỏ gọn dùng trong button, form, card
 * - LoadingOverlay: màn hình / overlay loading đẹp mắt kèm backdrop blur và thông điệp trạng thái
 */

export function LoadingSpinner({ size = 'md', color = 'current', className = '' }) {
  const sizeClasses = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }[size] || 'w-6 h-6';

  const colorClasses = {
    current: 'text-current',
    white: 'text-white',
    indigo: 'text-indigo-600',
    rose: 'text-rose-600',
    slate: 'text-slate-600',
  }[color] || color;

  return (
    <svg
      className={`animate-spin ${sizeClasses} ${colorClasses} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label="Đang tải"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function LoadingOverlay({
  message = 'Đang xử lý...',
  subtext = 'Vui lòng đợi trong giây lát...',
  fullScreen = true,
  className = '',
}) {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4'
    : 'absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 rounded-2xl';

  return (
    <div
      className={`${containerClass} transition-opacity duration-200 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center max-w-sm w-full mx-4 transform transition-transform">
        {/* Animated Brand Pulse / Spinner Ring */}
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
              <svg className="w-4 h-4 transform -rotate-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.5 7.05h-15a2.25 2.25 0 00-2.25 2.25v1.2a1.5 1.5 0 010 3v1.2a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-1.2a1.5 1.5 0 010-3v-1.2a2.25 2.25 0 00-2.25-2.25zm-6 8.2h-3v-1.5h3v1.5zm0-3.2h-3v-1.5h3v1.5zm0-3.2h-3v-1.5h3v1.5z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Message Header */}
        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
          {message}
        </h3>

        {/* Subtext */}
        {subtext && (
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoadingOverlay;
