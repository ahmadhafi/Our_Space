export function getMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `/uploads/${path}`;
}
