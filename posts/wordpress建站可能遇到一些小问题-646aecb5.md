---
title: "wordpress建站可能遇到一些小问题"
date: 2018-04-23T16:13:48+08:00
updated: 2018-04-23T16:13:48+08:00
author: "兰州小红鸡"
tags:
  - 博客建站
  - 教程
summary: "想总结下最近自己搭博客时遇到的一些问题 当时上网搜了好久，可把自己累坏了 1 wordpress更新或者更新主题和插件时，显示没有权限访问上机目录 可能是你的站点文件夹所有组为ro…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/646aecb5.html
  categories: "后端"
---

**想总结下最近自己搭博客时遇到的一些问题** **当时上网搜了好久，可把自己累坏了**

**1  wordpress更新或者更新主题和插件时，显示没有权限访问上机目录**

可能是你的站点文件夹所有组为root

一般大家的站点组为www

所以用Xshell或其他工具连接服务器

找到站点文件夹，修改所有组，后面的wordpressk看自己的所在文件夹，有时候可能需要写绝对路径

`chown  -R  wordpress`

网上很多都说修改为777，但是这样很危险，不建议使用

\*\* 2 不小心在后台修改了ip地址导致页面无法访问\*\*

浏览器上打开你的phpmyadmin  ([http://你的ip/phpmyadmin](http://xn--ip-0p3cm89l/phpmyadmin))

在你的wordpress数据库里面的wp\_options这个表里面，将第一行数据的地址修改回来就可以了

如果你的数据库也无法访问，这个我遇到过

需要你连接自己的服务器

用命令行打开数据库，用mysql操作命令修改刚刚说的那个表的地址

mysql> UPDATE wp\_options SET option\_value=‘你的地址’ WHERE option\_id=1;

具体数据库的操作可以参考[http://www.runoob.com/mysql/mysql-update-query.html](http://www.runoob.com/mysql/mysql-update-query.html)

**3 表情包不能输入在评论框里的问题**

后台主题设置/自定义/关闭ajax

暂时想到这几个，有想到再想
