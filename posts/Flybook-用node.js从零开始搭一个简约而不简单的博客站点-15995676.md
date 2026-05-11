---
title: "Flybook-用node.js从零开始搭一个简约而不简单的博客站点"
date: 2018-01-01T00:00:00+08:00
updated: 2022-03-11T22:50:00+08:00
author: "兰州小红鸡"
tags:
  - "杂七杂八"
summary: "前言：玩了快一年博客了，一直用的第三方框架，比如WordPress，typecho，hexo等。其中hexo用的最久，期间把nex主题改得乱七八糟。上周看完node的文档后，决定自…"
cover: assets/uploads/2026/05/Flybook-用node.js从零开始搭一个简约而不简单的博客站点-15995676-01.png
origin:
  from: cnblogs
  url: https://www.cnblogs.com/gitpull/p/15995676.html
  id: 15995676
  cnblogsDate: "2022-03-11 22:50"
  originalYear: 2018
---

> 前言：玩了快一年博客了，一直用的第三方框架，比如WordPress，typecho，hexo等。其中hexo用的最久，期间把nex主题改得乱七八糟。上周看完node的文档后，决定自己用node搭一个博客web应用。历时一周，完成初步版本，本博客整体UI风模仿简书。

项目地址：[https://github.com/flymysql/flybook](https://github.com/flymysql/flybook)

2019-08-17更新：添加站点数据库安装页面

访问你的站点域名+install，比如https://yuming.com/install 登陆账号即可安装

2019-05-25更新：完成大部分任务

-   网站骨架
-   首页页面渲染
-   文章详情页渲染
-   归档页面渲染
-   前台登录验证的实现
-   前台编写文章
-   前台修改与删除文章
-   后台文章
-   自定义页面
-   ajax渲染标签
-   各个页面css独立
-   写文章页面图片上传
-   ajax上传文件
-   点赞功能
-   文章阅读数量刷新
-   谷歌广告集成
-   文章搜索功能
-   集成image-view灯箱插件
-   集成highlight代码高亮
-   单独标签页
-   关于我
-   博客相册
-   把文章单标签模式换成一篇文章多标签的模式
-   自定义页面的渲染模板和文章渲染模板分离开
-   更好的文章编辑器
-   各个设备的自适应
-   图片懒加载
-   开启http2协议
-   搜索文章
-   sitemap站点地图
-   文章的toc目录插件
-   添加百度主动推送
-   添加站点统计与文章统计
-   添加邮件订阅
-   添加rss生成
-   添加文章与主页侧边栏广告位
-   添加喜欢按钮
-   添加游客投稿功能
-   独立的评论系统

### 站点概览

手机上的页面效果

![image](assets/uploads/2026/05/Flybook-用node.js从零开始搭一个简约而不简单的博客站点-15995676-01.png)

![image](assets/uploads/2026/05/Flybook-用node.js从零开始搭一个简约而不简单的博客站点-15995676-02.png)

电脑上的页面效果

![image](assets/uploads/2026/05/Flybook-用node.js从零开始搭一个简约而不简单的博客站点-15995676-03.png)

### 技术栈

node  
express库  
pug  
mysql  
服务器端的配置  
博客骨架  
网站骨架如下

```
├── app.js
├── bin	// 入口文件
├── config.js	// 站点配置
├── controllers	// 路由控制器
├── package.json
├── public	// 静态文件
│ ├── images
│ ├── javascripts
│ └── stylesheets
├── routes	// 路由
├── server	// 数据库操作
├── sessions	// 登录验证
├── until	// 工具函数
└── views	// 主题
```

其实就是在express初始化的网站骨架下对自己需要的部件进行添加。

页面响应  
首先要确定页面中应显示哪些信息，然后定义适当的 URL 来返回这些资源。随后应创建路由（URL 处理器）和视图（模板）来显示这些页面。

下图展示了 HTTP 请求/响应处理的主数据流和需要实现的行为。图中除视图（View）和路由（Route）外，还展示了控制器（Controller），它们是实际的请求处理函数，与路由请求代码是分开的。

模型已经创建，现在要创建的主要是：

路由：把需要支持的请求（以及请求 URL 中包含的任何信息）转发到适当的控制器函数。  
控制器：从模型中获取请求的数据，创建一个 HTML 页面显示出数据，并将页面返回给用户，以便在浏览器中查看。  
视图（模板）：供控制器用来渲染数据。  
![image](assets/uploads/2026/05/Flybook-用node.js从零开始搭一个简约而不简单的博客站点-15995676-04.png)

### 博客安装

安装

```
git clone https://github.com/flymysql/flybook.git
```

进入项目文件夹文件夹后安装生产环境

```
npm install
```

或者使用cnpm安装

```
cnpm install
```

运行使用pm2进程守护

```
npm run pmstart
```

如果要停止项目

```
npm run pmstop
```

如果要重启项目

```
npm run pmrestart
```

启动项目后访问服务器地址的3000端口便可以看到页面

更新升级  
由于博客还在开发阶段，每天都会有大量更新和改动  
所以写了个升级脚步，用于本地更新

```
npm run update
```

更新之后可以重启站点

```
npm run pmrestart
```

### 配置域名

1.  使用nginx反向代理
2.  安装nginx，安装方法自行百度
3.  配置nginx配置文件

配置Nginx，使得访问域名时候转到http://localhost:3000处理请求，配置文件如下，记得把域名改成自己的:

```
server {
listen 80;
server_name flycode.co;
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
error_page 500 502 503 504 /50x.html;
        location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

配置后重启Nginx

```
service nginx restart。
```

当然，还有个最简单的方法是让应用监听80端口，前提是你的服务器没有其他网站在运行。修改端口在项目的/bin/www文件下

### 主题自定义

博客的主题文件放在view文件夹下，通过修改view文件夹下面的pug模板可以轻松地修改博客主题。css文件放在public/stylesheets文件夹下，修改主题时请认准相应模板的css文件（博客页面的css文件是独立的，比如index页面有index.css，而post页面有对应的post.css）

### 自定义服务的的页面渲染

当然也可以对自己修改页面的渲染代码，看半天node的文档基本上就会改了。页面渲染的代码在/server/mysql文件夹下，不同的渲染文件对应不同的页面渲染（大部分渲染函数都在post.js文件里）
