// ============================================================================
// 公共配置 —— 修改这里以适配你自己的部署
// 这里都是公开的（前端会读取），不要把 token 等密钥放进来
// ============================================================================

export const CONFIG = {
  // 你的 GitHub 仓库（也是 GitHub Pages 部署的仓库）
  repo: {
    owner: 'your-username',
    name: 'blog',
    branch: 'main',
  },

  // 允许进入后台的 GitHub 账号白名单（lowercase）
  // 真正的写权限由 GitHub 仓库本身的 collaborator 设置控制，
  // 这里只是前端 UI 的额外校验
  authorizedUsers: ['your-username'],

  // 站点信息
  site: {
    title: '我的博客',
    subtitle: '记录想法与代码',
    author: '你的名字',
    avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    description: '一个用 GitHub Pages 托管、可在线编辑的简书风格博客',
  },

  // 仓库内的文件路径约定
  paths: {
    posts: 'posts',
    index: 'data/posts.json',
    uploads: 'assets/uploads',
  },
};
