// ============================================================================
// 公共配置 —— 可在后台 /admin/settings.html 在线编辑
// 这里都是公开信息，不要把 token 等密钥放进来
// ============================================================================

export const VERSION = '20260512120000';

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
    provider: "busuanzi",   // busuanzi | none
    articleProvider: "page-views-api",
    showHomeStats: true,
    showPostViews: true,
    showFooterStats: true
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
  theme: {
    default: "auto",      // auto / light / dark
    preset: "jianshu",    // jianshu / github / solarized / monokai
    allowReaderPresetSwitch: true,
    tokens: {},
    customCss: ""
  }
};
