---
title: "服务端搭建ssr教程"
date: 2018-10-25T21:32:17+08:00
updated: 2018-11-05T21:32:17+08:00
author: "兰州小红鸡"
tags:
  - "教程"
  - ssr
summary: "教程很简单，整个教程分三步： 第一步：购买VPS服务器 第二步：一键部署VPS服务器 第三步：一键加速VPS服务器 （谷歌BBR加速；对速度要求不高的话，此步骤可省略） ¶第一步：…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/651cfd47.html
  categories: "教程"
---

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-01.png)

**教程很简单，整个教程分三步：**

> 第一步：购买VPS服务器  
> 第二步：一键部署VPS服务器  
> 第三步：一键加速VPS服务器 （谷歌BBR加速；对速度要求不高的话，此步骤可省略）

## [¶](#第一步：购买vps服务器)第一步：购买VPS服务器

VPS服务器需要选择国外的，首选国际知名的vultr，速度不错、稳定且性价比高。

[vultr官网](https://www.vultr.com/?ref=7446652)

**点击进入官网**vultr注册地址：**[www.vultr.com](https://www.vultr.com/?ref=7446652)**（全球15个服务器位置可选，KVM框架。推荐：美国西海岸等靠近大陆的服务器，不推荐日本服务器，因为近段时间日本服务器开不出好IP.）

虽然是英文界面，但是现在的浏览器都有网页翻译功能，鼠标点击右键，选择网页翻译即可翻译成中文。

注册并邮件激活账号，充值后即可购买服务器。充值方式是paypal或支付宝(2017年8月30日Vutrl支持支付宝付款了，最低充值10美元即70元左右）

> 2.5美元/月的服务器配置信息：单核 512M内存 20G SSD硬盘 100M带宽 500G流量/月(现在2.5美元的单核服务器已经没有ipv4地址了)  
> 3.5美元/月的服务器配置信息：单核 512M内存 20G SSD硬盘 100M带宽 500G流量/月(有ipv4地址) **(推荐)**  
> 5美元/月的服务器配置信息：单核 1G内存 25G SSD硬盘 100M带宽 1000G流量/月  
> 10美元/月的服务器配置信息：单核 2G内存 40G SSD硬盘 100M带宽 2000G流量/月

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-02.webp)

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-03.webp)

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-04.webp)

购买vps服务器时，服务器地址优先选择：美国西海岸等靠近大陆的服务器，不推荐日本服务器，因为近段时间日本服务器开不出好IP。系统推荐选择CentOS 6.X64位的系统（系统版本不要选的太高，不要选centos7！centos7默认的防火墙可能会干扰ssr的正常连接！）。完成购买后，找到系统的密码记下来，部署服务器时需要用到。如图：

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-05.png)

默认是centos7系统，点击图中的CentOS几个字，会弹出centos6，然后选中它！vps操作系统不要选centos7，因为选它很可能会影响ssr的正常连接。

因为vultr实际上是折算成小时来计费的，所以如果你部署的服务器实测后不理想，你可以把它删掉，重新换个地区的服务器来部署，很方便。

## [¶](#第二步：部署vps服务器)第二步：部署VPS服务器

购买服务器后，需要部署一下。链接到你的服务器，可以使用linux下直接ssh链接，windows下可以在vultr官网有个view consle可以直接连到服务器，或者可以下载git bash或者其他带有ssh的命令行工具

连接国外ip即服务器时，软件会先后提醒你输入用户名和密码，用户名linux系统默认都是root，密码是购买服务器后的cent系统的密码。

链接成功后，就可以输入代码部署成ss了。

用下面这个脚本搭建

CentOS/Debian/Ubuntu ShadowsocksR单/多端口一键管理脚本：

主用下载地址：


```sql
$ yum -y install wget

$ wget -N --no-check-certificate https://softs.fun/Bash/ssr.sh && chmod +x ssr.sh && bash ssr.sh
```


或者备用下载地址：


```sql
$ yum -y install wget

$ wget -N --no-check-certificate https://raw.githubusercontent.com/ToyoDAdoubi/doubi/master/ssr.sh && chmod +x ssr.sh && bash ssr.sh
```


复制上面的主用下载地址的两句代码到VPS服务器里，然后按回车：

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-06.webp)

如上图出现管理界面后，输入数字1来安装SSR服务端。如果输入1后不能进入下一步，那么请退出xshell，重新连接vps服务器，然后输入快捷管理命令bash [ssr.sh](http://ssr.sh) 再尝试。

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-07.webp)

根据上图提示，依次输入自己想设置的端口和密码 (密码建议用复杂点的字母组合，图中的密码只是作为演示用)，回车键用于确认

![兰州小红鸡](assets/uploads/2026/05/服务端搭建ssr教程-651cfd47-08.webp)

如上图，选择想设置的加密方式，比如10，按回车键确认

接下来是选择协议插件,没什么特别要求就随便了，不过协议名字和混淆插件名字要记住，等本地客户端配置时需要用到

选择并确认后，会出现上图的界面，提示你是否选择兼容原版，这里的原版指的是SS客户端，可以根据需求进行选择，原则上不推荐使用SS客户端，演示选择n

之后进行混淆插件的设置，如下面

进行混淆插件的设置后，会依次提示你对设备数、单线程限速和端口总限速进行设置，默认值是不进行限制，个人使用的话，选择默认即可，即直接敲回车键。

之后代码就正式自动部署了，提示你下载文件，输入：y

耐心等待一会，出现下面的界面即部署完成：

![](https://upload-images.jianshu.io/upload_images/8512409-6ddb0d6be0e2dcf0.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/464/format/webp)  
根据上图就可以看到自己设置的SSR账号信息，包括IP、端口、密码、加密方式、协议插件、混淆插件。如果之后想修改账号信息，直接输入快捷管理命令：bash [ssr.sh](http://ssr.sh) 进入管理界面，选择相应的数字来进行一键修改。例如：

-   bash [ssr.sh](http://ssr.sh)

## [¶](#第三步：一键加速vps服务器)第三步：一键加速VPS服务器

可以不安装！似乎会影响ssr的连接（如果安装加速后，ssr客户端不能用，按上面第二步将ssr重新安装）

**或者可以不安装vps加速**

加速教程为谷歌BBR加速教程，谷歌BBR加速和破解版锐速加速教程，两者只能成功装一个，都仅支持KVM框架的vps服务器，vultr的服务器都是KVM框架。如果你购买的不是vultr的服务器，那么你需要搞清楚你买的vps服务器是否是KVM框架的，很重要。

按照第二步的步骤，重新连接服务器ip，登录成功后，在命令栏里粘贴以下代码：

【谷歌BBR加速教程】


```sql
yum -y install wget

wget --no-check-certificate https://github.com/teddysun/across/raw/master/bbr.sh

chmod +x bbr.sh

./bbr.sh
```


把上面整个代码复制后粘贴进去，不动的时候按回车，然后耐心等待，最后重启vps服务器即可。该方法是开机自动启动，部署一次就可以了。

如图：

![](https://upload-images.jianshu.io/upload_images/8512409-9cfac5c14f526b20.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/402/format/webp)

出现上面这个图按回车

image  
最后输入y重启服务器或者手动输入代码：reboot

软件资源：

windows： [SSR客户端](https://link.jianshu.com/?t=https%3A%2F%2Fnofile.io%2Ff%2F6Jm7WJCyOVv%2FShadowsocksR-4.7.0-win.7z)

安卓 ： [SSR客户端](https://link.jianshu.com/?t=https%3A%2F%2Fnofile.io%2Ff%2FGRWw7PbADrc%231c6c32f969e7f5d9)

ios： 直接搜索ShadowRocket，美区的ios账号似乎可以免费下载，国内收费，12人民币（我是买了）

参考链接：  
[https://www.jianshu.com/p/0259fedd7652](https://www.jianshu.com/p/0259fedd7652)  
[https://github.com/Alvin9999/new-pac/wiki/自建ss服务器教程](https://github.com/Alvin9999/new-pac/wiki/%E8%87%AA%E5%BB%BAss%E6%9C%8D%E5%8A%A1%E5%99%A8%E6%95%99%E7%A8%8B)
