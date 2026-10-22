import { Link } from "react-router-dom";

export default function EventCard({ event }) {
    // Helper format ngày tháng
    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const eventId = event.eventId || event.id;

    return (
        <article className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
            {/* Banner Ảnh */}
            <Link to={`/events/${eventId}`} className="relative aspect-video w-full overflow-hidden bg-slate-100 block">
                <img
                    alt={event.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={
                        event.bannerUrl ||
                        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200"
                    }
                />
                <span className="absolute top-3 left-3 bg-[#4353ff] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm uppercase">
          {event.status || "Sự kiện"}
        </span>
            </Link>

            {/* Thông tin sự kiện */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                    <Link to={`/events/${eventId}`}>
                        <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-[#4353ff] transition-colors">
                            {event.name}
                        </h3>
                    </Link>
                    <div className="space-y-1.5 text-xs text-slate-500">
                        <div className="flex items-center space-x-2">
                            <svg
                                className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                />
                            </svg>
                            <span className="line-clamp-1">
                {event.venue || "Chưa cập nhật địa điểm"}
              </span>
                        </div>
                        {event.startsAt && (
                            <div className="flex items-center space-x-2">
                                <svg
                                    className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                    />
                                </svg>
                                <span>{formatDate(event.startsAt)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Nút tác vụ bên dưới */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-xs text-slate-400 block">Trạng thái</span>
                        <span className="text-[#4353ff] font-extrabold text-sm sm:text-base">
              {event.status === "PUBLISHED"
                  ? "Đang mở bán"
                  : event.status || "Sắp diễn ra"}
            </span>
                    </div>
                    <Link
                        to={`/events/${eventId}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#4353ff] border border-indigo-200 rounded-lg hover:bg-[#4353ff] hover:text-white transition-all"
                    >
                        <span>Xem chi tiết</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}
