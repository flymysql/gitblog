// ============================================================================
// 公共配置 —— 可在后台 /admin/settings.html 在线编辑
// 这里都是公开信息，不要把 token 等密钥放进来
// ============================================================================

export const VERSION = '20260511144209';

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
    logo: "",
    favicon: "../assets/uploads/2026/05/1778481325586-x3zzx9-blog.svg",
    avatar: "https://avatars.githubusercontent.com/u/37113068?s=400&u=cf2b8a258ad1de5e9a23e3c72da6ca04e058dd46&v=4",
    description: "一个用 GitHub Pages 托管、可在线编辑的极简博客",
    url: "https://flymysql.github.io/gitblog",
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
        name: "关于",
        href: "post.html?slug=about"
      }
    ],
    social: {
      github: "https://github.com/flymysql",
      twitter: "",
      email: "",
      rss: "rss.xml"
    }
  },
  giscus: {
    enabled: true,
    repo: "flymysql/gitblog",
    repoId: "R_kgDOSZ6GIQ",
    category: "Announcements",
    categoryId: "DIC_kwDOSZ6GIc4C8wdV",
    mapping: "pathname",
    strict: "0",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "top",
    lang: "zh-CN"
  },
  paths: {
    posts: "posts",
    index: "data/posts.json",
    uploads: "assets/uploads"
  },
  theme: {
    default: "auto"
  }
};
