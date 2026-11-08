/**
 * 站点可能部署在 GitHub Pages 的子路径下（如 /passatlas/），
 * 因此所有站内链接必须经过 url()，永远不要写死以 / 开头的绝对路径。
 */
const base = import.meta.env.BASE_URL;

export function url(path = '/'): string {
  const clean = path.replace(/^\/+/, '');
  return `${base}${clean}`;
}

export function isActive(currentPath: string, href: string): boolean {
  const target = url(href);
  if (target === base) return currentPath === base;
  return currentPath === target || currentPath.startsWith(target);
}
