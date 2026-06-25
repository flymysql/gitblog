// ============================================================================
// 后台管理密钥（与评论管理 COMMENT_ADMIN_SECRET 相同，存于本站 localStorage）
// ============================================================================

import { getAdminTopPages } from './cloudbase-pv.js';

export const ADMIN_SECRET_KEY = 'gitblog-comment-admin-secret-v1';

export function getStoredAdminSecret() {
  try {
    return String(localStorage.getItem(ADMIN_SECRET_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveAdminSecret(secret) {
  try {
    localStorage.setItem(ADMIN_SECRET_KEY, String(secret || '').trim());
  } catch { /* ignore */ }
}

export function clearAdminSecret() {
  try {
    localStorage.removeItem(ADMIN_SECRET_KEY);
  } catch { /* ignore */ }
}

export async function verifyAdminSecret(secret) {
  const s = String(secret || '').trim();
  if (!s) throw new Error('请输入管理密钥');
  await getAdminTopPages(s, 1);
  saveAdminSecret(s);
}
