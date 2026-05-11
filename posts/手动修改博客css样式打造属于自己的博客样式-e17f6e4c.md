---
title: "手动修改博客css样式，打造属于自己的博客样式"
date: 2018-10-29T06:39:31+08:00
updated: 2018-11-04T06:39:31+08:00
author: "兰州小红鸡"
tags:
  - "教程"
  - "博客"
summary: "这两天花了点时间修改了下自己的next主题的博客 样式表放在了GitHub上喜欢的话可以直接使用 $1 使用方法 直接下载$1，然后复制到自己主题的themes\\\\next\\\\so…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/e17f6e4c.html
  categories: "博客"
---

**这两天花了点时间修改了下自己的next主题的博客**

样式表放在了GitHub上喜欢的话可以直接使用  
[  
next博客主题样式修改  
](https://github.com/flymysql/hexo-theme-next-flyme)

使用方法

-   直接下载[样式表](https://github.com/flymysql/hexo-theme-next-flyme)，然后复制到自己主题的themes\\next\\source\\css\_custom目录下的custom.styl文件

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">&lt;link rel=<span class="string">"stylesheet"</span> type=<span class="string">"text/css"</span> href=<span class="string">"https://picture-1256429518.cos.ap-chengdu.myqcloud.com/blog/custom.css"</span>&gt;</span><br></pre></td></tr></tbody></table>

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-01.png)

### [¶](#自己动手修改的方法)自己动手修改的方法

> 小白教程，大佬见笑。需要一点点css基础，可以上菜鸟教程现学

**准备**

1.  chrome浏览器或者其他带检查功能的浏览器
2.  如果你是用的hexo博客的next主题，那么自定义样式表就在themes\\next\\source\\css\_custom目录下的custom.styl文件中
3.  如果是其他类型的博客，先百度自定义样式表在哪里

**查找样式名称**

现在我们开始自己动手修改样式

先用浏览器打开自己博客页面，找到自己要修改的样式的地方，比如我要修改这个文章标题样式

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-02.png)

然后鼠标右键，点击检查

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-03.png)

深色的那一行就是标题所在的html语句

鼠标移动到那一行，点击，这时右侧出现css样式表

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-04.png)

**选择样式名称，复制**

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-05.png)

然后回到themes\\next\\source\\css\_custom目录下的custom.styl文件中，开始自己写样式

**例如**

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br></pre></td><td class="code"><pre><span class="line">.posts-expand .post-title-link{</span><br><span class="line">	/*</span><br><span class="line">     你的自定义样式</span><br><span class="line">	*/</span><br><span class="line">}</span><br></pre></td></tr></tbody></table>

**showtime**

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-06.png)

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-07.png)

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-08.png)

![兰州小红鸡](assets/uploads/2026/05/手动修改博客css样式打造属于自己的博客样式-e17f6e4c-09.png)

> 当然前提是你使用的是nexo主题，并且我使用的是next里的mist子主题，其他主题可能不兼容
