#!/usr/bin/env node
/** 生成 9 个独立工具页 HTML */
import { writeFileSync } from 'node:fs';
import { toolPageHtml } from './tool-page-shell.mjs';

const V = '20260622180000';

const PAGES = [
  {
    file: 'tool-age.html',
    title: '年龄计算器',
    description: '输入生日，计算年龄、总天数、总小时与距下次生日的天数。',
    eyebrow: 'Age Calculator',
    h1: '年龄计算器',
    lead: '输入生日，看看你已经在这个星球上待了多久。',
    script: 'tool-age.js',
    commentsHint: '算出来的数字准不准？来晒晒你的年龄～',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-form">
          <label>出生日期 <input type="date" id="ageBirth" max="9999-12-31"></label>
          <label>出生时间（可选） <input type="time" id="ageTime" step="1"></label>
        </div>
        <div class="tool-kit-toolbar">
          <button type="button" class="tool-kit-btn is-ghost" id="ageShare" hidden>生成分享图</button>
        </div>
        <div class="tool-kit-stats" id="ageResult">
          <p class="tool-kit-placeholder">请选择出生日期</p>
        </div>
      </section>`,
  },
  {
    file: 'tool-fortune.html',
    title: '今日运势',
    description: '娱乐向今日签文，同一日期与昵称结果固定，图一乐，请勿当真。',
    eyebrow: 'Daily Fortune',
    h1: '今日运势',
    lead: '娱乐向，图一乐。同一日期 + 昵称会得到相同结果。',
    script: 'tool-fortune.js',
    commentsHint: '今日签文如何？来聊两句～',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-form tool-kit-form-inline">
          <label>昵称（可选） <input type="text" id="fortuneName" placeholder="留空也行" maxlength="20"></label>
          <button type="button" class="tool-kit-btn" id="fortuneBtn">再抽一次</button>
          <button type="button" class="tool-kit-btn is-ghost" id="fortuneShare">生成分享图</button>
        </div>
        <article class="fortune-card" id="fortuneResult" hidden>
          <div class="fortune-grade" id="fortuneGrade"></div>
          <p class="fortune-text" id="fortuneText"></p>
          <dl class="fortune-meta">
            <div><dt>宜</dt><dd id="fortuneGood"></dd></div>
            <div><dt>忌</dt><dd id="fortuneBad"></dd></div>
            <div><dt>幸运色</dt><dd id="fortuneColor"></dd></div>
            <div><dt>幸运数字</dt><dd id="fortuneNum"></dd></div>
          </dl>
          <p class="tool-kit-hint">仅供娱乐，请勿当真。</p>
        </article>
      </section>`,
  },
  {
    file: 'tool-json.html',
    title: 'JSON 格式化',
    description: '在线 JSON 格式化、压缩、校验与复制，浏览器本地处理。',
    eyebrow: 'JSON Formatter',
    h1: 'JSON 格式化',
    lead: '粘贴 JSON，格式化、压缩或校验语法。',
    script: 'tool-json.js',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-toolbar">
          <button type="button" class="tool-kit-btn" id="jsonFormat">格式化</button>
          <button type="button" class="tool-kit-btn is-ghost" id="jsonMinify">压缩</button>
          <button type="button" class="tool-kit-btn is-ghost" id="jsonClear">清空</button>
          <button type="button" class="tool-kit-btn is-ghost" id="jsonCopy">复制</button>
        </div>
        <textarea class="tool-kit-textarea" id="jsonInput" rows="14" placeholder='{"hello": "world"}' spellcheck="false"></textarea>
        <p class="tool-kit-status" id="jsonStatus"></p>
      </section>`,
  },
  {
    file: 'tool-codec.html',
    title: 'Base64 / URL 编解码',
    description: 'Base64 与 URL 编码、解码，支持交换输入输出，浏览器本地处理。',
    eyebrow: 'Encode / Decode',
    h1: 'Base64 / URL 编解码',
    lead: 'Base64 与 URL 互转，数据仅在浏览器内处理。',
    script: 'tool-codec.js',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-subtabs">
          <button type="button" class="tool-kit-subtab is-active" data-codec="base64">Base64</button>
          <button type="button" class="tool-kit-subtab" data-codec="url">URL</button>
        </div>
        <div class="tool-kit-toolbar">
          <button type="button" class="tool-kit-btn" id="codecEncode">编码</button>
          <button type="button" class="tool-kit-btn is-ghost" id="codecDecode">解码</button>
          <button type="button" class="tool-kit-btn is-ghost" id="codecSwap">交换</button>
          <button type="button" class="tool-kit-btn is-ghost" id="codecCopy">复制结果</button>
        </div>
        <label class="tool-kit-label">输入</label>
        <textarea class="tool-kit-textarea" id="codecIn" rows="5" spellcheck="false"></textarea>
        <label class="tool-kit-label">输出</label>
        <textarea class="tool-kit-textarea" id="codecOut" rows="5" readonly spellcheck="false"></textarea>
        <p class="tool-kit-status" id="codecStatus"></p>
      </section>`,
  },
  {
    file: 'tool-timestamp.html',
    title: '时间戳转换',
    description: 'Unix 时间戳（秒/毫秒）与本地日期时间互转，支持一键取当前时间。',
    eyebrow: 'Timestamp',
    h1: '时间戳转换',
    lead: 'Unix 秒/毫秒与本地时间互转。',
    script: 'tool-timestamp.js',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-form tool-kit-form-inline">
          <button type="button" class="tool-kit-btn" id="tsNow">当前时间</button>
        </div>
        <div class="tool-kit-grid-2">
          <div>
            <label class="tool-kit-label">Unix 时间戳</label>
            <div class="tool-kit-input-row">
              <input type="text" id="tsUnix" placeholder="1719000000 或毫秒">
              <select id="tsUnit" aria-label="单位">
                <option value="auto">自动</option>
                <option value="s">秒</option>
                <option value="ms">毫秒</option>
              </select>
            </div>
            <button type="button" class="tool-kit-btn is-block" id="tsToDate">→ 转为日期</button>
          </div>
          <div>
            <label class="tool-kit-label">日期时间</label>
            <input type="datetime-local" id="tsDate" step="1">
            <button type="button" class="tool-kit-btn is-block" id="tsToUnix">→ 转为时间戳</button>
          </div>
        </div>
        <div class="tool-kit-output" id="tsResult"></div>
      </section>`,
  },
  {
    file: 'tool-regex.html',
    title: '正则测试',
    description: '在线正则表达式测试，实时高亮匹配并列出所有 match。',
    eyebrow: 'Regex Tester',
    h1: '正则测试',
    lead: '输入 pattern 与测试文本，实时查看匹配结果。',
    script: 'tool-regex.js',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-form tool-kit-form-inline">
          <label class="tool-kit-regex-pattern">/<input type="text" id="regexPattern" placeholder="pattern" spellcheck="false">/
            <input type="text" id="regexFlags" value="g" maxlength="6" class="tool-kit-flags" aria-label="flags">
          </label>
        </div>
        <label class="tool-kit-label">测试文本</label>
        <textarea class="tool-kit-textarea" id="regexText" rows="8" spellcheck="false"></textarea>
        <div class="tool-kit-output" id="regexPreview"></div>
        <div class="tool-kit-output" id="regexMatches"></div>
      </section>`,
  },
  {
    file: 'tool-qrcode.html',
    title: '二维码生成',
    description: '文本或链接一键生成二维码 PNG，支持下载。',
    eyebrow: 'QR Code',
    h1: '二维码生成',
    lead: '输入文本或链接，生成可下载的 PNG 二维码。',
    script: 'tool-qrcode.js',
    body: `
      <section class="tool-kit-panel is-active">
        <label class="tool-kit-label">内容（文本或链接）</label>
        <textarea class="tool-kit-textarea" id="qrText" rows="3" placeholder="https://gitpull.cn/"></textarea>
        <div class="tool-kit-form tool-kit-form-inline">
          <label>尺寸 <input type="range" id="qrSize" min="128" max="512" step="16" value="256"> <span id="qrSizeVal">256</span> px</label>
          <button type="button" class="tool-kit-btn" id="qrGen">生成</button>
          <a class="tool-kit-btn is-ghost" id="qrDownload" download="qrcode.png" hidden>下载 PNG</a>
        </div>
        <div class="tool-kit-qr-wrap">
          <canvas id="qrCanvas" width="256" height="256"></canvas>
        </div>
        <p class="tool-kit-status" id="qrStatus"></p>
      </section>`,
  },
  {
    file: 'tool-image.html',
    title: '图片压缩 / WebP 转换',
    description: '浏览器本地压缩图片，输出 WebP、JPEG 或 PNG，可调质量与最大宽度。',
    eyebrow: 'Image Compress',
    h1: '图片压缩 / WebP 转换',
    lead: '在浏览器本地处理，图片不会上传到服务器。',
    script: 'tool-image.js',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-form">
          <label>选择图片 <input type="file" id="imgFile" accept="image/*"></label>
          <label>输出格式
            <select id="imgFormat">
              <option value="image/webp">WebP</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
            </select>
          </label>
          <label>质量 <input type="range" id="imgQuality" min="0.1" max="1" step="0.05" value="0.82"> <span id="imgQualityVal">82%</span></label>
          <label>最大宽度（px，0 为原尺寸） <input type="number" id="imgMaxW" min="0" max="8192" value="1920"></label>
        </div>
        <div class="tool-kit-toolbar">
          <button type="button" class="tool-kit-btn" id="imgConvert">转换</button>
          <a class="tool-kit-btn is-ghost" id="imgDownload" download="output.webp" hidden>下载</a>
        </div>
        <div class="tool-kit-img-compare" id="imgCompare" hidden>
          <figure><figcaption>原图</figcaption><img id="imgOrigPreview" alt="原图预览"></figure>
          <figure><figcaption>输出 <span id="imgSizeInfo"></span></figcaption><img id="imgOutPreview" alt="输出预览"></figure>
        </div>
        <p class="tool-kit-status" id="imgStatus"></p>
      </section>`,
  },
  {
    file: 'tool-network.html',
    title: '网络与浏览器信息',
    description: '查看公网 IP、运营商、城市与浏览器、屏幕、UA 等信息。',
    eyebrow: 'Network Info',
    h1: '网络与浏览器信息',
    lead: 'IP 与运营商需联网查询；浏览器信息来自本机，不会上传。',
    script: 'tool-network.js',
    body: `
      <section class="tool-kit-panel is-active">
        <div class="tool-kit-toolbar">
          <button type="button" class="tool-kit-btn" id="netRefresh">刷新</button>
          <button type="button" class="tool-kit-btn is-ghost" id="netCopy">复制全部</button>
        </div>
        <dl class="tool-kit-kv" id="netClient"></dl>
        <h3 class="tool-kit-subtitle">公网 IP</h3>
        <dl class="tool-kit-kv" id="netIp">
          <p class="tool-kit-placeholder">加载中…</p>
        </dl>
      </section>`,
  },
];

for (const p of PAGES) {
  writeFileSync(p.file, toolPageHtml({ ...p, description: p.description }).replace(/v=20260622140000/g, `v=${V}`));
  console.log('wrote', p.file);
}

// 旧合集页 → 工具索引
writeFileSync('tool-kit.html', `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=tools.html">
  <link rel="canonical" href="tools.html">
  <title>跳转中…</title>
  <script>location.replace('tools.html');</script>
</head>
<body><p>正在跳转到 <a href="tools.html">工具箱</a>…</p></body>
</html>
`);

export const TOOL_HTML_FILES = PAGES.map(p => p.file);
