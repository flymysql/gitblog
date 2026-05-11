---
title: "Windows下的终端折腾——弃坑msys2，开始用wsl"
date: 2018-12-14T10:50:18+08:00
updated: 2018-12-14T10:50:18+08:00
author: "兰州小红鸡"
tags:
  - "教程"
summary: "之前用了半年Linux，后来因为平常一些软件需要，只能在Windows下玩，就换回Windows了。 但还是万分想念Linux，然而Windows下的终端一直用的不爽，就一直在尝试…"
cover: assets/uploads/2026/05/Windows下的终端折腾——弃坑msys2开始用wsl-d6b124c4-03.gif
origin:
  from: hexo
  url: https://flymysql.github.io/post/d6b124c4.html
  categories: "教程"
---

之前用了半年Linux，后来因为平常一些软件需要，只能在Windows下玩，就换回Windows了。  
但还是万分想念Linux，然而Windows下的终端一直用的不爽，就一直在尝试其他终端。

**msys体验**

用了一段时间的msys，感觉也还行吧，最头疼的是中文乱码的事，该试的都试了，还是会有一些指令中文乱码。  
然后还有一些其他的小毛病，用久了，启动也很慢，昨天实在受不了，开始寻找新的终端替代

## [¶](#windows下的linux子系统)Windows下的Linux子系统

其实我也没搞清Linux子系统和wsl什么关系，不过二者打开之后，是相同的终端，感觉应该是同一个东西

**先设置开发者模式**

![](https://upload-images.jianshu.io/upload_images/1836534-05d8e85c3ba54a60.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/799/format/webp)

**然后再开启Linux子系统功能**

![](https://upload-images.jianshu.io/upload_images/1836534-780f6423bd5160f2.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/935/format/webp)

**重启电脑**

然后在Windows的应用商店搜索ubuntu或debian进行安装  
就可以用啦！

或者可以进行如下步骤

1.  命令行运行 lxrun /install /y 开始安装。  
    安装速度取决于网络情况，下载的文件在 %localappdata%\\lxss 目录下 lxss.tar.gz (181M)，解压后大概500M, rootfs 目录即为子系统根目录。
2.  命令行运行 bash 进入Ubuntu
3.  默认使用的 root 帐号登录，通过指令 passwd 设置密码。  
    注：本文脚本均在root帐号下操作，因此建议使用root帐号

**如何卸载？**  
通过命令行运行 lxrun /uninstall /full 轻松卸载子系统

> 通过上面的步骤，已经启用了win10自带的linux子系统(WSL)，感觉逼格提升了不少。当然，怎么能满足于此呢，接下来就要做一些环境的配置和进一步的挖掘。

下面先秀一下我的wsl界面

![兰州小红鸡](assets/uploads/2026/05/Windows下的终端折腾——弃坑msys2开始用wsl-d6b124c4-03.gif)

## [¶](#更换数据源)更换数据源

参考文章  
[  
更换apt数据源  
](https://blog.csdn.net/sunnyliqian/article/details/50179915)

在Ubuntu或Debian下我们可以通过 apt-get 命令 很方便的安装/卸载软件，由于默认的软件包仓库是位于国外的，安装软件的时候就可能遇到各种网络问题或者下载到的一些资源不完整，因此就需要切换数据源为国内的镜像站点来改善。


```sql
# 1.备份原来的数据源配置文件
cp /etc/apt/sources.list /etc/apt/sources.list_backup
# 2.编辑数据源配置文件
vi /etc/apt/sources.list
```


在这里我使用的是阿里云的数据源：


```sql
deb http://mirrors.aliyun.com/ubuntu/ trusty main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ trusty-security main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ trusty-updates main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ trusty-proposed main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ trusty-backports main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ trusty main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-security main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-updates main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-proposed main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-backports main restricted universe multiverse
```


-   更新配置


```sql
apt-get update
```


注：14986版之后更新了内核，第三方的镜像站可能找不到软件包资源，需要切换回官方的源。经测试中科大的源可用


```sql
deb https://mirrors.ustc.edu.cn/ubuntu/ xenial main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ xenial-updates main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ xenial-backports main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ xenial-security main restricted universe multiverse
```


## [¶](#与vscode搭配使用)与vscode搭配使用

将vscode的终端换成wsl，真是赏心悦目呢

![兰州小红鸡](assets/uploads/2026/05/Windows下的终端折腾——弃坑msys2开始用wsl-d6b124c4-04.png)

在设置里面将


```sql
"terminal.integrated.shell.windows": "C:\WINDOWS\System32\cmd.exe"
```


中的`cmd.exe`换成`wsl.exe`就好啦


```sql
"terminal.integrated.shell.windows": "C:\WINDOWS\System32\wsl.exe"
```


**vscode真香**

😀
