export const categories = [
  ['MUSIC', 'Âm nhạc'], ['SPORTS', 'Thể thao'], ['SEMINAR', 'Hội thảo'],
  ['ARTS', 'Nghệ thuật & điện ảnh'], ['COMMUNITY', 'Cộng đồng'], ['OTHER', 'Khác'],
];
export const categoryLabel = (value) => categories.find(([id]) => id === value)?.[1] || 'Chưa phân loại';
export const searchText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
export function salesSchedule(form, endsAt) {
  if (!form.salesStartAt && !form.salesEndAt) return {};
  const start = Date.parse(form.salesStartAt), end = Date.parse(form.salesEndAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > Date.parse(endsAt)) {
    throw new Error('Nhập đủ lịch mở bán: giờ đóng bán phải sau giờ mở bán và không sau giờ kết thúc sự kiện.');
  }
  return { salesStartAt: new Date(start).toISOString(), salesEndAt: new Date(end).toISOString() };
}
