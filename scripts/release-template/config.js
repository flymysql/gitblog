// ============================================================================
// 公共配置 —— 可在后台 /admin/settings.html 在线编辑
// 这里都是公开信息，不要把 token 等密钥放进来
// ============================================================================

export const VERSION = '20260512172500';

export const CONFIG = {
  repo: {
    // ⚠ 改成你自己的：你的 GitHub 用户名 / 仓库名 / 默认分支
    owner: "YOUR_USERNAME",
    name: "YOUR_REPO",
    branch: "main"
  },
  // ⚠ 限制只允许哪些 GitHub 用户登录后台（即使别人有 PAT 也进不来）
  authorizedUsers: ["YOUR_USERNAME"],
  site: {
    title: "我的博客",
    subtitle: "记录想法与代码",
    author: "Your Name",
    logo: "",
    favicon: "",
    avatar: "https://avatars.githubusercontent.com/u/0?v=4",
    description: "一个用 GitHub Pages 搭的小博客。",
    // ⚠ 改成你的 Pages 站点地址，末尾不要 /
    url: "https://YOUR_USERNAME.github.io/YOUR_REPO",
    locale: "zh-CN",
    nav: [
      { name: "首页", href: "./" },
      { name: "标签", href: "tags.html" },
      { name: "归档", href: "archives.html" },
      { name: "工具", href: "tools.html" },
      { name: "关于", href: "post.html?slug=about" }
    ],
    social: {
      github: "",
      twitter: "",
      email: "",
      rss: "rss.xml"
    }
  },
  // 评论：默认关闭，需要的话去 https://giscus.app 拿到 repoId / categoryId 再启用
  giscus: {
    enabled: false,
    repo: "",
    repoId: "",
    category: "Announcements",
    categoryId: "",
    // ⚠ 推荐 specific（每篇文章按 slug 独立绑定一条 Discussion）
    // 不要用 pathname / url，否则所有文章会共用同一条评论流
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
    // busuanzi（不蒜子，零配置）/ saobby（saobby.com 计数器，需注册）/ none
    provider: "busuanzi",
    // busuanzi 模式下首页文章列表的逐篇阅读量来源
    articleProvider: "page-views-api",
    showHomeStats: true,
    showPostViews: true,
    showFooterStats: true,
    showListPostViews: true,
    // saobby 计数器：在 https://www.saobby.com/create_webcounter 创建，
    // 把生成的图片 URL 和控制面板（dashboard）URL 粘进来即可
    saobby: {
      site: {
        img: "",          // 站点级计数器图片 URL（首页 / footer 展示）
        dashboard: "",    // 站点计数器控制面板完整 URL（含 key），后台「访问数据」会嵌入
        label: "总访问"    // 前缀文字，例如改成「访客数」「累计访问」
      },
      article: {
        img: "",          // 文章页计数器（每篇文章共用一张图，统计全站文章总阅读）
        dashboard: "",
        label: "阅读"
      },
      extra: []           // [{ name, img, dashboard }] 额外计数器，仅在后台「访问数据」展示
    }
  },
  auth: {
    githubDeviceFlow: {
      // 可选：如果想用 GitHub Device Flow 登录而非 PAT，填一个 OAuth App 的 clientId
      clientId: "",
      scope: "repo read:user"
    }
  },
  paths: {
    posts: "posts",
    index: "data/posts.json",
    uploads: "assets/uploads"
  },
  upload: {
    preferWebp: true,     // 自动把上传的 PNG/JPEG 转成 WebP，省 30%~70%
    webpQuality: 0.85,
    maxWidth: 1920        // 超过此宽度自动缩放
  },
  theme: {
    default: "auto",      // auto / light / dark
    preset: "jianshu",    // jianshu / github / solarized / monokai
    allowReaderPresetSwitch: true,
    tokens: {},
    customCss: ""
  },
  // 文章末尾的「分享 / 打赏 / 二维码」卡片，默认关闭
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
