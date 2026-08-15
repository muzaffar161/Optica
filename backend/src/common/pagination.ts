export function pageParams(page?: string, pageSize?: string, fallbackSize = 50) {
  const parsedPage = Number.parseInt(page || '1', 10);
  const parsedSize = Number.parseInt(pageSize || String(fallbackSize), 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const take = Number.isFinite(parsedSize)
    ? Math.min(100, Math.max(1, parsedSize))
    : fallbackSize;
  return { page: safePage, take, skip: (safePage - 1) * take };
}
