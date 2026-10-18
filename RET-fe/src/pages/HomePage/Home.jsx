import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { eventService } from "../../services/eventService";

export default function Home() {
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // Từ khóa gửi tới API
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Gọi API mỗi khi từ khóa tìm kiếm thay đổi
  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        // Gọi API GET /api/event?q={searchTerm}
        const data = await eventService.getEvents(searchTerm);

        // Hỗ trợ cả trường hợp response dạng Page<T> ({ content: [...] }) hoặc Mảng trực tiếp
        const eventList = data?.content || (Array.isArray(data) ? data : []);
        setEvents(eventList);
      } catch (err) {
        console.error("Lỗi khi tải danh sách sự kiện:", err);
        setError("Không thể tải danh sách sự kiện. Vui lòng thử lại sau.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [searchTerm]);

  // Xử lý Submit Form Tìm kiếm
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchTerm(searchQuery.trim());
  };

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

  return (
    <div className="bg-[#f8fafc] text-slate-800 font-sans antialiased min-h-screen flex flex-col justify-between">
      {/* Thanh Header dùng chung */}
      <Header />

      {/* BEGIN: MainContent */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 flex-1 w-full">
        {/* BEGIN: HeroSection */}
        <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#eef4ff] via-[#f4f6fe] to-[#e9edff] border border-indigo-50/70 p-8 sm:p-12 lg:p-14 shadow-sm">
          <div className="absolute left-8 bottom-1/3 opacity-70 text-[#4353ff]">
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
              <path d="M12 0l2.5 8.5L23 11l-8.5 2.5L12 22l-2.5-8.5L1 11l8.5-2.5z"></path>
            </svg>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Hero Text & Search Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center space-x-2 text-xs uppercase tracking-widest font-bold text-slate-500">
                <span>Khám phá</span>
                <span className="text-slate-300">•</span>
                <span>Trải nghiệm</span>
                <span className="text-slate-300">•</span>
                <span>Kết nối</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-900 leading-[1.25] tracking-tight">
                Những sự kiện <span className="text-[#3b49df]">tuyệt vời</span>
                <br />
                đang chờ bạn!
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-xl font-normal leading-relaxed">
                Từ âm nhạc, thể thao, hội thảo đến các sự kiện giải trí, đừng bỏ
                lỡ những khoảnh khắc đáng nhớ nhất!
              </p>

              {/* Hero Search Bar - Tích hợp Tìm kiếm API */}
              <div className="pt-2">
                <form
                  onSubmit={handleSearchSubmit}
                  className="bg-white rounded-full p-2 pl-5 shadow-lg shadow-indigo-100/50 border border-slate-200/80 flex items-center justify-between max-w-xl transition-all focus-within:ring-2 focus-within:ring-[#4353ff] focus-within:border-transparent"
                >
                  <div className="flex items-center flex-1 space-x-3 overflow-hidden pr-2">
                    <svg
                      className="w-5 h-5 text-slate-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                    <input
                      className="w-full border-none focus:ring-0 text-sm text-slate-700 placeholder-slate-400 p-0 font-normal outline-none"
                      placeholder="Tìm kiếm sự kiện theo tên hoặc địa điểm..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button
                    className="bg-[#4353ff] hover:bg-[#3745dc] text-white px-6 py-3 rounded-full text-sm font-semibold flex items-center space-x-2 transition-all flex-shrink-0 shadow-md shadow-indigo-200"
                    type="submit"
                  >
                    <span>Tìm kiếm</span>
                    <svg
                      className="w-4 h-4 stroke-[2.5]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </button>
                </form>
              </div>
            </div>

            {/* Hero Graphic Column */}
            <div className="lg:col-span-5 relative flex justify-center items-center">
              <div className="absolute -right-2 top-4 transform rotate-12 text-[#4353ff] font-['Caveat'] text-2xl select-none z-20 hidden sm:block">
                <span className="block font-bold">Good Vibes</span>
                <span className="block -mt-1 font-bold">
                  Only <span className="text-xl">♡</span>
                </span>
              </div>
              <div className="relative w-full max-w-[460px] aspect-[4/3] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white/80 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <img
                  alt="Live Music Concert Atmosphere"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuANU5o4pvjY7REhFHVbsnNXEg6t_QAr5q21mIWvHqzPruUeW0jnR3Iw5AM7oKBa_WsB31v6olTUW_oQuBlZt0u4kNym0S4HGfJs4r4-a1ay6brU25cEnDqftHGiO3sdjCRx-3Hhe49I-gldQXcVLlCn-NjjcV64l2seA_jZ0cRlk2pKC4jKbBt-7IfbAzeFsmorAfQXSw7I6S501kUAnXHTz9QGgo4hhHI5T6pORg-cBxVvZpa2ZOEzsQ"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#201047]/60 via-transparent to-transparent"></div>
              </div>
            </div>
          </div>
        </section>
        {/* END: HeroSection */}

        {/* BEGIN: EventCategoriesAndFilters */}
        <section className="space-y-6" id="events">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-1.5 h-6 bg-[#4353ff] rounded-full"></div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {searchTerm
                  ? `Kết quả tìm kiếm cho: "${searchTerm}"`
                  : "Danh mục sự kiện"}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 overflow-x-auto pb-2 scrollbar-none text-sm font-semibold">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full shadow-sm transition-all flex-shrink-0 ${selectedCategory === "ALL" ? "bg-[#4353ff] text-white shadow-indigo-200" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80"}`}
              type="button"
            >
              <span>Tất cả</span>
            </button>
            <button
              onClick={() => setSelectedCategory("MUSIC")}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full transition-all flex-shrink-0 ${selectedCategory === "MUSIC" ? "bg-[#4353ff] text-white shadow-indigo-200" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80"}`}
              type="button"
            >
              <span>Âm nhạc</span>
            </button>
            <button
              onClick={() => setSelectedCategory("SPORTS")}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full transition-all flex-shrink-0 ${selectedCategory === "SPORTS" ? "bg-[#4353ff] text-white shadow-indigo-200" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80"}`}
              type="button"
            >
              <span>Thể thao</span>
            </button>
            <button
              onClick={() => setSelectedCategory("SEMINAR")}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full transition-all flex-shrink-0 ${selectedCategory === "SEMINAR" ? "bg-[#4353ff] text-white shadow-indigo-200" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80"}`}
              type="button"
            >
              <span>Hội thảo</span>
            </button>
          </div>
        </section>
        {/* END: EventCategoriesAndFilters */}

        {/* BEGIN: EventCardGrid (Danh sách sự kiện động từ API) */}
        <section className="pb-12">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-indigo-600 font-semibold text-base animate-pulse">
                Đang tải danh sách sự kiện...
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center text-sm font-medium">
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
              <p className="text-slate-500 font-medium">
                Không tìm thấy sự kiện nào phù hợp.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {events.map((event) => (
                <article
                  key={event.eventId || event.id}
                  className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col group"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                    <img
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={
                        event.bannerUrl ||
                        "https://lh3.googleusercontent.com/aida-public/AB6AXuDwc0JUgR-x1oxEL15a60Lz1K8WGSxXn5h5tyWp5H53u4412jaVpVp2KBQwliCd982ahMMA2RCaGGM2IA0kB3Uqtpw7ouCULDWrAvXugebQYLlU55L44kjfF3yMFNkCYK9jpooX26HdmjsPr9c2zinai66S5x-ey1enXrdL9pmAJuYLH2haqhf6MbWltpFzozIGNxjJiSLsx5KNt-RkPuI1vKAsWAgzhjTLDxkMnnbEfa0ePItPorCjNg"
                      }
                    />
                    <span className="absolute top-3 left-3 bg-[#4353ff] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm uppercase">
                      {event.status || "Sự kiện"}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2.5">
                      <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-[#4353ff] transition-colors">
                        {event.name}
                      </h3>
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
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block">
                          Trạng thái
                        </span>
                        <span className="text-[#4353ff] font-extrabold text-sm sm:text-base">
                          {event.status === "PUBLISHED"
                            ? "Đang mở bán"
                            : event.status || "Sắp diễn ra"}
                        </span>
                      </div>
                      <Link
                        to={`/events/${event.eventId || event.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#4353ff] border border-indigo-200 rounded-lg hover:bg-[#4353ff] hover:text-white transition-all"
                      >
                        <span>Xem chi tiết</span>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        {/* END: EventCardGrid */}
      </main>
      {/* END: MainContent */}

      {/* Chân Footer dùng chung */}
      <Footer />
    </div>
  );
}
