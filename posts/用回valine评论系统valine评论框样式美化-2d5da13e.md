---
title: "用回valine评论系统,valine评论框样式美化"
date: 2018-11-01T08:52:05+08:00
updated: 2018-11-01T08:52:05+08:00
author: "兰州小红鸡"
tags:
  - "教程"
  - "博客"
summary: "我感觉我一个处女座的就不应该搞前端，太吹毛求疵追求完美了，哪里有一点点觉得不漂亮就想改 博客的评论系统用过好几家（虽然都没有人评论 比如gitalk，来必力 之前用的来必力，加载慢…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/2d5da13e.html
  categories: "教程"
---

> 我感觉我一个处女座的就不应该搞前端，太吹毛求疵追求完美了，哪里有一点点觉得不漂亮就想改

博客的评论系统用过好几家（虽然都没有人评论  
比如gitalk，来必力  
之前用的来必力，加载慢的问题是解决了，但是总觉得登陆的反应也很慢  
想来想去还是觉得valine好用

1.  免登陆，使用方便，直接填了昵称和邮箱就可以评论
2.  有回复邮件提醒功能！很好用

不过之前没用valine的原因时它评论框样式感觉不好看  
所以这次我用回valine，首先改了样式

![兰州小红鸡](assets/uploads/2026/05/用回valine评论系统valine评论框样式美化-2d5da13e-01.png)

**好像也没太大变化，不过就是看着顺眼了**

## [¶](#使用valine)使用valine

**这个没什么好说的，next主题在自带的，配置很简单，网上搜一下就有**

## [¶](#添加样式表)添加样式表

在themes\\next\\source\\css\\custom目录下的custom.styl文件中添加如下


```sql

/*valine 评论系统样式*/

div#comments.comments.v{
  margin-top: 0px !important;
  margin-left: 0px !important;
  margin-right: 0px !important;
}

div.vheader.item2{
  border-bottom: 1px solid #5f5f5f;
  height: 35px !important;
}

.v .vwrap .vheader.item2 .vinput{
  height: 30px !important;
  border: 0px !important;
  width: 25% !important;
  margin: 0px !important;
}

input.vnick.vinput{
  border-right: 2px solid #a4d8fa !important;
}

div.vcontrol{
  padding-top: 0px !important;
}

div#comments.comments.v{
  border: 0px;
}

.v .vwrap{
  border: 2px solid black !important;
  height: 210px !important;
  border-radius: 6px !important;
  overflow: visible !important;
  counter-reset: avater;
}

.v .vwrap .vedit .vemojis{
  width: 600px !important;
  background-color: #fff !important;
  border-radius: 5px !important;
}

.v .vwrap .vedit .vpreview {
  width: 600px !important;
  background-color: #fff !important;
  border-radius: 5px !important;
}

.v .vbtn{
  background-color: #5f5f5f !important;
  color: #fff !important;
}

.v .vwrap .vedit .vctrl{
  text-align: left !important;
}

.v .vwrap .vedit .vctrl span{
  background-color: #7f7f7f !important;
  color: #fff !important;
  border-radius: 3px !important;
  padding: 3px !important;
}

.v .vwrap .vedit .vctrl{
  padding: 0px !important;
  margin: 0px !important;
}

div.vedit{
  height: 120px;
}

.v .veditor{
  min-height: 70px !important;
  height: 70px !important;
}

.v .vlist .vcard {
  border: 1px dashed #49b1f5 !important;
}

.v .vlist .vcard .vhead .vsys{
  display: none !important;
  background-color: #fff !important;
}

.v .vlist .vcard .vh .vmeta .vat{
  background-color: #7f7f7f !important;
  color: #fff !important;
  border-radius: 3px !important;
  padding-left: 10px !important;
  padding-right: 10px !important;
}

.v .vlist .vcard .vhead:before{

    display: block;
    float: left;
    width: 50px;
    height: 50px;
    line-height: 50px;
    margin: 0 12px 0 0;
    color: #fff;
    font-size: 15px;
    font-weight: bold;
    font-style: normal;
    background-color: #55aacf;
    border-radius: 50%;
    text-align: center;

    content: counter(avater)'楼';
    counter-increment: avater;
}

.v .vlist .vcard .vquote{
  margin-left: 80px;
}

.v .vlist .vcard .vquote{
  counter-reset: avaters;
}

.v .vlist .vcard .vquote  .vhead:before{
    display: block;
    float: left;
    width: 38px;
    height: 38px;
    line-height: 38px;
    margin: 0 12px 0 0;
    color: #fff;
    font-size: 15px;
    font-weight: bold;
    font-style: normal;
    background-color: #fff;
    border: 3px solid #60a1e5;
    color: #60a1e5;
    border-radius: 50%;
    text-align: center;

    content: counter(avaters);
    counter-increment: avaters;
}

.v .vlist .vcard  p{
  margin-bottom: 0px !important;
  color: #666;
  text-align: left;
  letter-spacing: 3px;
  line-height: 25.59375px;
}
.v .vlist .vcard .vquote a.at{
  float: left;
  margin-right: 13px;
  color: #567843;
  text-decoration: none;
}

.v .vlist .vcard .vquote .vcontent{
  font-size: 15px;
  font-weight: 200;
}

.v .vlist .vcard .vcontent{
  margin-top: 58px !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  padding-top: 0px !important;
}

.v .vlist .vcard .vhead .vnick{
  font-size: 17px !important;
  font-weight: 600 !important;
}

.v .vlist .vcard{
  padding-top: 8px !important;
}

.v .vlist .vcard .vhead{
  float: left !important;
}

.v .vlist .vcard .vh .vmeta{
  float: right !important;
}

.v .vlist .vcard .vcontent.expand:after{
  content: "点击查看全部" !important;
  font-weight: 400 !important;
}

/**/
```


更新文件

-   hexo clean
-   hexo d -g

ok!
