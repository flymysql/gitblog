---
title: "hexo建站笔记之彩色标签云"
date: 2018-11-07T20:08:34+08:00
updated: 2018-11-07T20:08:34+08:00
author: "兰州小红鸡"
tags:
  - 教程
  - 前端
  - 博客建站
summary: "方法比较简单，加个js脚本就好了，至于加载哪里都无所谓了，就放在标签云的页面。 就加在标签的那个页面好了。 1. 打开themes\\\\next\\\\layout\\\\page.swig…"
cover: assets/uploads/2026/05/hexo建站笔记之彩色标签云-d6caa003-01.png
origin:
  from: hexo
  url: https://flymysql.github.io/post/d6caa003.html
  categories: "教程"
---

方法比较简单，加个js脚本就好了，至于加载哪里都无所谓了，就放在标签云的页面。  
就加在标签的那个页面好了。

1.  打开themes\\next\\layout\\page.swig
2.  找到


```sql
{% if page.type === "tags" %}
```


3.  将下面这段代码


```sql
<div class="tag-cloud">

   <!-- <div class="tag-cloud-title">
       {{ _p('counter.tag_cloud', site.tags.length) }}
   </div> -->
   <div class="tag-cloud-tags" id="tags">
     {{ tagcloud({min_font: 16, max_font: 16, amount: 300, color: true, start_color: '#fff', end_color: '#fff'}) }}
   </div>
 </div>
```


换成这段代码


```sql
<div class="tag-cloud">
  <!-- <div class="tag-cloud-title">
      {{ _p('counter.tag_cloud', site.tags.length) }}
  </div> -->
  <div class="tag-cloud-tags" id="tags">
    {{ tagcloud({min_font: 16, max_font: 16, amount: 300, color: true, start_color: '#fff', end_color: '#fff'}) }}
  </div>
</div>
<br>

<script type="text/javascript">
   var alltags=document.getElementById('tags');
   var tags=alltags.getElementsByTagName('a');

   for (var i = tags.length - 1; i >= 0; i--) {
     var r=Math.floor(Math.random()*75+130);
     var g=Math.floor(Math.random()*75+100);
     var b=Math.floor(Math.random()*75+80);
     tags[i].style.background = "rgb("+r+","+g+","+b+")";
   }
</script>

<style type="text/css">
    div#posts.posts-expand .tag-cloud a{
   background-color: #f5f7f1;
   border-radius: 6px;
   padding-left: 10px;
   padding-right: 10px;
   margin-top: 18px;

 }

 .tag-cloud a{
   background-color: #f5f7f1;
   border-radius: 4px;
   padding-right: 5px;
   padding-left: 5px;
   margin-right: 5px;
   margin-left: 0px;
   margin-top: 8px;
   margin-bottom: 0px;

 }

 .tag-cloud a:before{
      content: "📜";
 }

 .tag-cloud-tags{
   text-align: left;
   counter-reset: tags;
 }
</style>
```


然后就好啦！  
可能需要清理缓存

1.  hexo clean
2.  hexo d -g

**下面是展示**

标签云放在主页

![兰州小红鸡](assets/uploads/2026/05/hexo建站笔记之彩色标签云-d6caa003-01.png)

标签云页面

![兰州小红鸡](assets/uploads/2026/05/hexo建站笔记之彩色标签云-d6caa003-02.png)
