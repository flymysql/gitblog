'use strict';

const crypto = require('crypto');

const PV_COLLECTION = 'gitblog_pageviews';
const SITE_COLLECTION = 'gitblog_site_stats';
const PV_RATE_COLLECTION = 'gitblog_pv_rates';
const SITE_DOC_ID = 'site';
const PV_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PV_PATH_MAX = 240;

function normalizePvPath(raw) {
  let p = String(raw || '').trim();
  if (!p) return '/';
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch { /* ignore */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p.slice(0, PV_PATH_MAX) || '/';
}

function pathDocId(path) {
  return `pv_${crypto.createHash('sha256').update(path).digest('hex').slice(0, 24)}`;
}

function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function verifyAdminSecret(event, verifyAdminSecretFn) {
  return typeof verifyAdminSecretFn === 'function' && verifyAdminSecretFn(event);
}

async function ensurePvCollections(db) {
  for (const name of [PV_COLLECTION, SITE_COLLECTION, PV_RATE_COLLECTION]) {
    try { await db.createCollection(name); } catch { /* exists */ }
  }
}

async function getSiteStats(db) {
  const got = await db.collection(SITE_COLLECTION).doc(SITE_DOC_ID).get().catch(() => null);
  const row = got?.data?.[0] || got?.data;
  return {
    pv: Number(row?.pv) || 0,
    uv: Number(row?.uv) || 0,
    updatedAt: Number(row?.updatedAt) || 0,
  };
}

async function getPagePv(db, path) {
  const norm = normalizePvPath(path);
  const got = await db.collection(PV_COLLECTION).doc(pathDocId(norm)).get().catch(() => null);
  const row = got?.data?.[0] || got?.data;
  return {
    path: norm,
    pv: Number(row?.pv) || 0,
    slug: String(row?.slug || '').trim(),
    title: String(row?.title || '').trim(),
    updatedAt: Number(row?.updatedAt) || 0,
  };
}

async function shouldCountHit(db, ipHash, path) {
  if (!ipHash) return true;
  const now = Date.now();
  const id = `${ipHash}_${pathDocId(path)}_${dayKey(now)}`;
  const ref = db.collection(PV_RATE_COLLECTION).doc(id);
  const got = await ref.get().catch(() => null);
  const row = got?.data?.[0] || got?.data;
  if (row?.hitAt && now - row.hitAt < PV_RATE_WINDOW_MS) return false;
  await ref.set({ hitAt: now, path, ipHash }).catch(() => null);
  return true;
}

async function incrementPagePv(db, path, { slug = '', title = '', countUv = false } = {}) {
  const norm = normalizePvPath(path);
  const id = pathDocId(norm);
  const now = Date.now();
  const _ = db.command;
  const ref = db.collection(PV_COLLECTION).doc(id);
  const got = await ref.get().catch(() => null);
  const exists = !!(got?.data?.[0] || got?.data);

  if (exists) {
    await ref.update({
      pv: _.inc(1),
      lastAt: now,
      ...(slug ? { slug } : {}),
      ...(title ? { title } : {}),
    });
  } else {
    await ref.set({
      path: norm,
      slug: String(slug || '').trim(),
      title: String(title || '').trim(),
      pv: 1,
      createdAt: now,
      lastAt: now,
    });
  }

  const siteRef = db.collection(SITE_COLLECTION).doc(SITE_DOC_ID);
  const siteGot = await siteRef.get().catch(() => null);
  const siteExists = !!(siteGot?.data?.[0] || siteGot?.data);
  if (siteExists) {
    await siteRef.update({
      pv: _.inc(1),
      ...(countUv ? { uv: _.inc(1) } : {}),
      updatedAt: now,
    });
  } else {
    await siteRef.set({ pv: 1, uv: countUv ? 1 : 0, updatedAt: now });
  }

  const page = await getPagePv(db, norm);
  const site = await getSiteStats(db);
  return { path: norm, pv: page.pv, sitePv: site.pv, siteUv: site.uv, counted: true };
}

function createPvHandlers({ db, hashIp, jsonOk, jsonErr, verifyAdminSecret }) {
  async function handlePvHit(event, context) {
    const path = normalizePvPath(event.path || event.pagePath || event.url);
    if (!path) return jsonErr('缺少 path');
    const ip = context?.requestContext?.sourceIp || '';
    const ipHash = hashIp(ip);
    const count = await shouldCountHit(db, ipHash, path);
    if (!count) {
      const page = await getPagePv(db, path);
      const site = await getSiteStats(db);
      return jsonOk({
        path,
        pv: page.pv,
        sitePv: site.pv,
        siteUv: site.uv,
        counted: false,
        deduped: true,
      });
    }
    let countUv = false;
    if (ipHash) {
      const uvId = `uv_${ipHash}`;
      const uvGot = await db.collection(PV_RATE_COLLECTION).doc(uvId).get().catch(() => null);
      const uvRow = uvGot?.data?.[0] || uvGot?.data;
      if (!uvRow?.uvMarked) {
        countUv = true;
        await db.collection(PV_RATE_COLLECTION).doc(uvId).set({
          ipHash, uvMarked: true, markedAt: Date.now(),
        }).catch(() => null);
      }
    }
    return jsonOk(await incrementPagePv(db, path, {
      slug: event.slug,
      title: event.title,
      countUv,
    }));
  }

  async function handlePvGet(event) {
    const path = normalizePvPath(event.path || event.pagePath || event.url);
    if (!path) return jsonErr('缺少 path');
    const page = await getPagePv(db, path);
    const site = await getSiteStats(db);
    return jsonOk({ path, pv: page.pv, sitePv: site.pv, siteUv: site.uv });
  }

  async function handlePvSite() {
    const site = await getSiteStats(db);
    return jsonOk({ sitePv: site.pv, siteUv: site.uv });
  }

  async function handlePvAdminTop(event) {
    if (!verifyAdminSecret(event, verifyAdminSecret)) return jsonErr('无权限', 403);
    const limit = Math.min(Math.max(Number(event.limit) || 20, 1), 100);
    const res = await db.collection(PV_COLLECTION).orderBy('pv', 'desc').limit(limit).get();
    const rows = (res?.data || []).map(r => ({
      path: r.path,
      slug: r.slug || '',
      title: r.title || '',
      pv: Number(r.pv) || 0,
      lastAt: Number(r.lastAt) || 0,
      source: r.importedFrom || '',
    }));
    const site = await getSiteStats(db);
    return jsonOk({ site, top: rows });
  }

  async function handlePvImport(event) {
    if (!verifyAdminSecret(event, verifyAdminSecret)) return jsonErr('无权限', 403);
    const pages = Array.isArray(event.pages) ? event.pages : [];
    const siteInput = event.site || {};
    let importedPages = 0;
    let skippedPages = 0;
    const now = Date.now();

    if (siteInput.pv != null || siteInput.uv != null) {
      const siteRef = db.collection(SITE_COLLECTION).doc(SITE_DOC_ID);
      const cur = await getSiteStats(db);
      const nextPv = Math.max(cur.pv, Number(siteInput.pv) || 0);
      const nextUv = Math.max(cur.uv, Number(siteInput.uv) || 0);
      await siteRef.set({
        pv: nextPv,
        uv: nextUv,
        updatedAt: now,
        importedFrom: String(siteInput.source || event.source || 'import').slice(0, 40),
      });
    }

    for (const item of pages) {
      const path = normalizePvPath(item.path || item.url);
      const pv = Number(item.pv);
      if (!path || !Number.isFinite(pv) || pv < 0) {
        skippedPages += 1;
        continue;
      }
      const id = pathDocId(path);
      const ref = db.collection(PV_COLLECTION).doc(id);
      const got = await ref.get().catch(() => null);
      const row = got?.data?.[0] || got?.data;
      const nextPv = Math.max(Number(row?.pv) || 0, pv);
      const payload = {
        path,
        pv: nextPv,
        slug: String(item.slug || row?.slug || '').trim(),
        title: String(item.title || row?.title || '').trim(),
        lastAt: now,
        importedFrom: String(item.source || event.source || 'import').slice(0, 40),
      };
      if (row) await ref.update(payload);
      else await ref.set({ ...payload, createdAt: now });
      importedPages += 1;
    }

    const site = await getSiteStats(db);
    return jsonOk({ importedPages, skippedPages, site });
  }

  return {
    ensurePvCollections,
    handlePvHit,
    handlePvGet,
    handlePvSite,
    handlePvAdminTop,
    handlePvImport,
    normalizePvPath,
  };
}

module.exports = { createPvHandlers, normalizePvPath };
