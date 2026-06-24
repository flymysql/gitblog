// ============================================================================
// 公共配置 —— 可在后台 /admin/settings.html 在线编辑
// 这里都是公开信息，不要把 token 等密钥放进来
// ============================================================================

export const VERSION = '20260624150000';

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
    logo: "/assets/%E7%BA%B8%E9%A3%9E%E6%9C%BA.svg",
    favicon: "/assets/%E7%BA%B8%E9%A3%9E%E6%9C%BA.svg",
    avatar: "https://gitpull.cn/assets/uploads/2026/05/touxiang.webp",
    description: "桃李春风一杯酒，江湖夜雨十年灯。",
    url: "https://gitpull.cn",
    locale: "zh-CN",
    nav: [
      {
        name: "首页",
        href: "./"
      },
      {
        name: "归档",
        href: "archives.html"
      },
      {
        name: "系列",
        href: "series.html"
      },
      {
        name: "工具",
        href: "tools/"
      },
      {
        name: "随笔",
        href: "notes.html"
      },
      {
        name: "关于",
        href: "post/about/"
      },
      {
        name: "小助手",
        href: "https://yuanqi.tencent.com/webim/#/chat/RhQLBj?appid=2068988279428657408"
      }
    ],
    social: {
      github: "https://github.com/flymysql",
      twitter: "",
      email: "flyphp@outlook.com",
      rss: "rss.xml"
    }
  },
  cloudbase: {
    enabled: true,
    envId: "gitbolg-d7gmnsrw46e011706",
    region: "ap-shanghai",
    functionName: "gitblog-comments",
    accessMode: "embed",
    httpUrl: "",
    embedBaseUrl: "https://gitbolg-d7gmnsrw46e011706-1256429518.tcloudbaseapp.com",
    embedPage: "comments-embed.html",
    /** 嵌入页静态资源版本；更新 cloudbase/static 后递增，并重新 hosting deploy */
    embedAssetVersion: "20260616160000",
    placeholderNick: "访客",
    moderation: false,
    maxLength: 5000,
    allowImage: true,
    pageSize: 50,
    notesTerm: "gitblog-notes-feed"
  },
  analytics: {
    enabled: false,
    snippet: ""
  },
  seo: {
    baiduSiteVerification: "",
    googleSiteVerification: "",
    bingSiteVerification: "",
    indexNow: {
      enabled: true,
      key: "4cd0a29d6359468ca640b007fb224b3d",
      pushOnBuild: true
    },
    baiduPush: {
      enabled: true,
      site: "gitpull.cn",
      token: "4IZFcuY6POlfl96M"
    }
  },
  pageviews: {
    enabled: true,
    showHomeStats: true,
    showPostViews: true,
    showFooterStats: true,
    saobby: {
      site: {
        img: "https://w.saobby.com/w/ivywp8ie",
        dashboard: "https://www.saobby.com/webcounter_dashboard?access_token=59nv7dkv",
        label: "人来过"
      },
      extra: []
    },
    vercount: {
      scriptSrc: "",
      label: "阅读"
    }
  },
  auth: {
    githubDeviceFlow: {
      clientId: "3410e5b91d4202af507e",
      scope: "repo read:user"
    }
  },
  paths: {
    posts: "posts",
    index: "data/posts.json",
    uploads: "assets/uploads"
  },
  upload: {
    preferWebp: true,
    webpQuality: 0.85,
    maxWidth: 1920
  },
  theme: {
    default: "auto",
    preset: "jianshu",
    allowReaderPresetSwitch: true,
    tokens: {},
    customCss: ""
  },
  share: {
    enabled: false,
    showInPosts: true,
    showInPages: false,
    qrcodeOfPage: true
  },
  donate: {
    enabled: false,
    title: "如果这篇文章对你有帮助，欢迎请我喝杯咖啡 ☕️",
    wechat: "",
    alipay: "",
    paypal: ""
  },
  decor: {
    enabled: true,
    pcCornerImage: "assets/uploads/2026/06/pc-corner-mascot.webp"
  }
};
