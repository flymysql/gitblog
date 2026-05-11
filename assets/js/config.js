// ============================================================================
// 公共配置 —— 修改这里以适配你自己的部署
// 这里都是公开的（前端会读取），不要把 token 等密钥放进来
// ============================================================================

// 用于缓存破坏，更新代码时改这里（或保持不变让浏览器自行刷新）
export const VERSION = '20260513';

export const CONFIG = {
  // 你的 GitHub 仓库（也是 GitHub Pages 部署的仓库）
  repo: {
    owner: 'flymysql',
    name: 'gitblog',
    branch: 'main',
  },

  // 允许进入后台的 GitHub 账号白名单（lowercase）
  authorizedUsers: ['flymysql'],

  // 站点信息
  site: {
    title: '春日野鬼',
    subtitle: '记录想法与代码',
    author: '小红鸡',
    logo: '',
    favicon: '',
    avatar: 'https://avatars.githubusercontent.com/u/37113068?s=400&u=cf2b8a258ad1de5e9a23e3c72da6ca04e058dd46&v=4',
    description: '一个用 GitHub Pages 托管、可在线编辑的极简博客',
    // 站点根 URL（用于 OG / sitemap / rss 等绝对地址；末尾不要 /）
    url: 'https://flymysql.github.io/gitblog',
    locale: 'zh-CN',

    // 顶部导航
    nav: [
      { name: '首页', href: './' },
      { name: '标签', href: 'tags.html' },
      { name: '归档', href: 'archives.html' },
      { name: '关于', href: 'post.html?slug=about' },
    ],

    // 社交 / 联系方式（留空不显示）
    social: {
      github: 'https://github.com/flymysql',
      twitter: '',
      email: '',
      rss: 'rss.xml',
    },
  },

  // giscus 评论（不需要可以把 enabled 设 false）
  // 在 https://giscus.app 配置后填这里
  giscus: {
    enabled: false,
    repo: 'flymysql/gitblog',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    mapping: 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'top',
    lang: 'zh-CN',
  },

  // 仓库内的文件路径约定
  paths: {
    posts: 'posts',
    index: 'data/posts.json',
    uploads: 'assets/uploads',
  },

  // 主题
  theme: {
    default: 'auto', // 'light' | 'dark' | 'auto'
  },
};
