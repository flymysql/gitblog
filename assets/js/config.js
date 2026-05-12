// ============================================================================
// 公共配置 —— 可在后台 /admin/settings.html 在线编辑
// 这里都是公开信息，不要把 token 等密钥放进来
// ============================================================================

export const VERSION = '20260512132200';

export const CONFIG = {
  repo: {
    owner: "flymysql",
    name: "gitblog",
    branch: "main"
  },
  authorizedUsers: ["flymysql"],
  site: {
    title: "小红鸡",
    subtitle: "记录想法与代码",
    author: "Jimmy",
    logo: "https://gitpull.cn/assets/%E7%BA%B8%E9%A3%9E%E6%9C%BA.svg",
    favicon: "https://gitpull.cn/assets/%E7%BA%B8%E9%A3%9E%E6%9C%BA.svg",
    avatar: "https://avatars.githubusercontent.com/u/37113068?s=400&u=cf2b8a258ad1de5e9a23e3c72da6ca04e058dd46&v=4",
    description: "桃李春风一杯酒，江湖夜雨十年灯。",
    url: "https://gitpull.cn",
    locale: "zh-CN",
    nav: [
      {
        name: "首页",
        href: "./"
      },
      {
        name: "标签",
        href: "tags.html"
      },
      {
        name: "归档",
        href: "archives.html"
      },
      {
        name: "随笔",
        href: "notes.html"
      },
      {
        name: "关于",
        href: "post.html?slug=about"
      }
    ],
    social: {
      github: "https://github.com/flymysql",
      twitter: "",
      email: "flyphp@outlook.com",
      rss: "rss.xml"
    }
  },
  giscus: {
    enabled: true,
    repo: "flymysql/gitblog",
    repoId: "R_kgDOSZ6GIQ",
    category: "Announcements",
    categoryId: "DIC_kwDOSZ6GIc4C8wdV",
    mapping: "specific",
    strict: "0",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "top",
    lang: "zh-CN"
  },
  analytics: {
    enabled: false,
    snippet: ""
  },
  pageviews: {
    enabled: true,
    provider: "busuanzi",
    articleProvider: "page-views-api",
    showHomeStats: true,
    showPostViews: true,
    showFooterStats: true
  },
  auth: {
    githubDeviceFlow: {
      clientId: "",
      scope: "repo read:user"
    }
  },
  paths: {
    posts: "posts",
    index: "data/posts.json",
    uploads: "assets/uploads"
  },
  // 图片上传策略：默认把 PNG / JPEG 转 WebP 体积省 30%~70%
  // GIF（含动图）、SVG、HEIC 等不会被转
  upload: {
    preferWebp: true,
    webpQuality: 0.85,
    maxWidth: 1920    // 超过这个宽度会缩放（避免 5MB 大图）
  },
  theme: {
    default: "auto",
    preset: "jianshu",
    allowReaderPresetSwitch: true,
    tokens: {},
    customCss: ""
  },
  // 文章末尾的「分享 / 打赏 / 二维码」卡片
  // 默认关掉，需要时去 admin/settings 把 enabled 勾上即可
  share: {
    enabled: false,
    showInPosts: true,
    showInPages: false,
    qrcodeOfPage: true
  },
  donate: {
    enabled: false,
    title: "如果这篇文章对你有帮助，欢迎请我喝杯咖啡 ☕️",
    wechat: "",           // 微信收款码图片 URL
    alipay: "",           // 支付宝收款码图片 URL
    paypal: ""            // PayPal 链接（如 https://paypal.me/xxx）
  }
};
