---
title: "在阿里云服务器一键搭建web服务器+wordprss安装"
date: 2018-04-21T22:14:55+08:00
updated: 2018-04-21T22:14:55+08:00
author: "兰州小红鸡"
tags:
  - 博客建站
summary: "¶前期准备 1. 在校学生可以在阿里买一轻量级云服务器，大概一百多一年，玩一玩还是蛮划算的。 2. 推荐使用CentOs镜像系统。 3. 4. 然后再买一个域名（几块钱到几十块钱不…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/d438625.html
  categories: "后端"
---

### [¶](#前期准备)前期准备

1.  在校学生可以在阿里买一轻量级云服务器，大概一百多一年，玩一玩还是蛮划算的。
    
2.  推荐使用CentOs镜像系统。
    
3.  ![](https://img-blog.csdn.net/20180121162621711?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvbGk0MjAyNDg4Nzg=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/Center)
    
4.  然后再买一个域名（几块钱到几十块钱不等），解析完就去备案（因为备案会花几天时间，所以先拿去备案，网站做好了，备案差不多也好了），阿里云上面备案还是蛮方便的，我第二个域名备案只用了3天。
    

5.  域名解析：阿里云后台买一个免费的CA证书，藏得比较隐蔽，需要好好找一找。 Symantec 免费型单个域名，一次只能解析一个域名，如果需要多个就多买几个，反正免费。
    
6.  下载Xshell，用于远程连接你的云主机，其实直接在阿里云控制台通过ssh连接也是可以的，如果你不介意每天打开浏览器，还要一遍一遍登陆的话。
    
7.  下载FileZilla，用于连接云主机并传文件，不想下载的话可以用FTP传输
    

### [¶](#环境配置)环境配置

> 我之前搭服务器是给自己的微信小程序做服务端，手动搭的环境，也挺快的，不过，后来做想做web端的服务器发现，阿里云有一键安装搭建web环境！！！我可耻地用了，作为小白用的也是理直气壮。这里是连接：[https://market.aliyun.com/products/56014009/cmgj000262.html?spm=a2c4g.11186623.2.5.9Cpi1Y](https://market.aliyun.com/products/56014009/cmgj000262.html?spm=a2c4g.11186623.2.5.9Cpi1Y)

购买下载后（2块钱）就很轻松了，按照说明文档一步一步来，这里是一步安装说明文档：[https://oss.aliyuncs.com/netmarket/969e338d-f6b4-4729-ba32-351f7246642f.pdf?spm=5176.2020520132.101.7.SPR6Jw&file=969e338d-f6b4-4729-ba32-351f7246642f.pdf](https://oss.aliyuncs.com/netmarket/969e338d-f6b4-4729-ba32-351f7246642f.pdf?spm=5176.2020520132.101.7.SPR6Jw&file=969e338d-f6b4-4729-ba32-351f7246642f.pdf)

一步一步跟着提示走就好了。 需要注意的几个点：用FileZilla或FTP将一键安装程序上传到云服务器的root文件夹，然后在Shell连接好云服务器，进入root，进入安装程序的文件夹，运行。过程大概20分钟，不要掉线。 安装完，浏览器中输入自己的域名或者ip，进入phpmyadmin的安装界面。

### [¶](#安装wordpress)安装wordpress

_其实之前想自己写html页面，也在网上找了模板，修修改改，但是感觉写服务端是个漫长的过程，计划着用node.js写服务端的业务，后来看到wordpress，就想先用着，node.js慢慢来写。_

官网下载wordpress: [https://cn.wordpress.org/?spm=a2c4g.11186623.2.4.Qi2gWK](https://cn.wordpress.org/?spm=a2c4g.11186623.2.4.Qi2gWK)

将下好的包解压完，把包（wordpress）拉到文件夹/alidata/www/下，将/alidata/www/phpwind里面的phpmyadmin复制到wordpress文件夹中。(命令行：`mv /alidata/www/phpwind/phpmyadmin /alidata/www/wordpress`)

在/alidata/server/httpd/conf/vhosts目录中找到phpwind.conf文件,用vim打开或者FileZilla，打开，修改内容(下面字体加粗部分，原本是phpwind，改成wordpress。 改完保存，重启nginx   (命令行：/etc/init.d/nginx restart)

1.  `<DirectoryMatch "/alidata/www/websiteTest/(attachment|html|data)">`
2.  `<Files ~ ".php">`
3.  `Order allow,deny`
4.  `Deny from all`
5.  `</Files>`
6.  `</DirectoryMatch>`
7.  `<VirtualHost *:80>`
8.  `DocumentRoot /alidata/www/_**wordpress**_`
9.  `ServerName localhost`
10.  `ServerAlias localhost`
11.  `<Directory "/alidata/www/_**wordpress**_">`
12.  `Options Indexes FollowSymLinks`
13.  `AllowOverride all`
14.  `Order allow,deny`
15.  `Allow from all`
16.  `</Directory>`
17.  `ErrorLog "/alidata/log/httpd/_**wordpress**_-error.log"`
18.  `CustomLog "/alidata/log/httpd/_**wordpress**_.log" common`
19.  `</VirtualHost>`

### [¶](#ssl证书配置)ssl证书配置

阿里云购买免费的CA证书，添加解析 ![](https://img-blog.csdn.net/20180121155141490?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvbGk0MjAyNDg4Nzg=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/Center) 下载证书，看你用的是什么服务器，教程里使用的是nginx，所以你下载nginx的证书就好了

在/etc/nginx/conf.d里面新建一个wordpress.conf，写入以下内容

```sql
 server { listen 80; server name 你的域名;
 rewrite ^(.*)$ https://$server name$1 permanent;
 }
 server { listen 443; server name 你的域名;
  ssl on;
  ssl certificate /etc/nginx/cert/214579180610128.crt;
  ssl certificate key /etc/nginx/cert/14579180610128.key;
  ssl session timeout 5m;
  ssl protocols TLSv1 TLSv1.1 TLSv1.2;
  ssl ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA:ECDHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA;
  ssl session cache shared:SSL:50m;
  ssl prefer server_ciphers on;
  location ~ \.php$ {
      root /alidata/www/wordpress;
   }
}
```

保存后重启nginx,浏览器中访问自己的域名。

第一次写教程，可能漏了很多东西，贴上教程合集：[https://help.aliyun.com/document\_detail/44543.html?spm=a2c4g.11186623.6.743.AjJVnF](https://help.aliyun.com/document_detail/44543.html?spm=a2c4g.11186623.6.743.AjJVnF)
