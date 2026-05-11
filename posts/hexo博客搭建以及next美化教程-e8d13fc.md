---
title: "hexo博客搭建以及next美化教程"
date: 2018-10-10T08:41:50+08:00
updated: 2018-11-07T08:41:50+08:00
author: "兰州小红鸡"
tags:
  - "教程"
  - "博客"
summary: "$1前言 本文虽然是非常详细的小白教程 但是也需要一点点的姿势，额，知识储量 $1知识储量 了解css和html，会写一点html基础语句 用过GitHub，知道建仓库过程以及在命…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/e8d13fc.html
  categories: "教程"
---

![兰州小红鸡](assets/uploads/2026/05/hexo博客搭建以及next美化教程-e8d13fc-01.png)

## [¶](#前言)前言

本文虽然是非常详细的小白教程  
但是也需要一点点的姿势，额，知识储量

### [¶](#知识储量)知识储量

-   了解css和html，会写一点html基础语句
-   用过GitHub，知道建仓库过程以及在命令行推送的一些git基础语句
-   会灵活地使用搜索引擎（最重要）

### [¶](#关于hexo)关于hexo

> Hexo是一款基于Node.js的静态博客框架，依赖少易于安装使用，可以方便的生成静态网页托管在GitHub和Heroku上，是搭建博客的首选框架  
> Hexo同时也是GitHub上的开源项目，参见：hexojs/hexo 如果想要更加全面的了解Hexo，可以到其官网 了解更多的细节，因为Hexo的创建者是台湾人，对中文的支持很友好，可以选择中文进行查看

hexo 主题很多 可以在下面选择自己的喜欢的一款：

[知乎：有哪些好看的hexo主题](https://www.zhihu.com/question/24422335) [hexo官网](https://hexo.io/themes/)

### [¶](#关于next主题)关于next主题

所有主题中，Next 主题简。配置些许不同，参照配置后先本地预览，看是否达到预期效果，再上传github哦。

现在越来越多的人喜欢利用Github搭建静态网站，原因不外乎简单省钱。  
我之前有在阿里云买过云主机，学生机一年120还是很便宜的，用wordpress搭建的博客。也是很方便的  
但是由于后来微信小程序也不做了，服务器就没怎么用，一直闲着。  
最近看到用github page做博客的文章，便想把之前的博客搬过来。

## [¶](#准备工作)准备工作

-   下载node.js并安装，默认会安装npm。[(官网下载安装）](http://www.runoob.com/nodejs/nodejs-install-setup.html)
-   下载安装git[（官网下载安装）](http://www.runoob.com/git/git-install-setup.html)
-   下载安装hexo。方法：打开cmd 运行`npm install -g hexo`（可能要翻墙）

## [¶](#本地搭建hexo静态博客)本地搭建hexo静态博客

-   新建一个文件夹，如MyBlog
-   进入该文件夹内，右击运行git，输入：hexo init（生成hexo模板，可能要翻墙）
-   生成完模板
-   最后运行：hexo server （可跳过）（运行程序，访问本地localhost:4000可以看到博客已经搭建成功，）
-   本地端一般直接推送到GitHub，不用开hexo server查看（我是这样的）

## [¶](#将博客与github关联)将博客与Github关联

-   在Github上创建名字为XXX.github.io的项目，XXX为自己的github用户名。
-   打开本地的MyBlog文件夹项目内的\_config.yml配置文件，将其中的type设置为git

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line">deploy:</span><br><span class="line">  type: git</span><br><span class="line">  repository: https:<span class="comment">//github.com/yourname/yourname.github.io.git</span></span><br><span class="line">  branch: master</span><br></pre></td></tr></tbody></table>

**记得替换上面的yourname**  
本教程提到的yourname都是指你的github账号id

-   运行：npm install hexo-deployer-git –save
-   运行：hexo g（本地生成静态文件）
-   运行：hexo d（将本地静态文件推送至Github）

此时，打开浏览器，访问`http://yourname.github.io`

## [¶](#绑定域名)绑定域名

博客已经搭建好，也能通过github的域名访问，但总归还是用自己的域名比较舒服。因为我们需要设置将自己的域名绑定到github这个博客项目上。

1.  域名提供商设置

> 添加2条A记录：  
> $ @—>192.30.252.154  
> $ @—>192.30.252.153  
> $ 添加一条CNAME记录：  
> $ CNAME—>[yourname.github.io](http://yourname.github.io)

2.  博客添加CNAME文件
    
    配置完域名解析后，进入博客目录，在source目录下新建CNAME文件，写入域名，如：thief.one
    
3.  运行：hexo g
    
4.  运行：hexo d
    

(也可以直接: `hexo d -g`)

## [¶](#next主题安装)next主题安装

访问[主题列表](http://www.zhihu.com/question/24422335)，获取主题代码。

进入themes目录，进入以下操作：

下载主题 (以next主题为例)

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">git clone https:<span class="comment">//github.com/iissnan/hexo-theme-next.git（主题的地址）</span></span><br></pre></td></tr></tbody></table>

打开站点\_\_config.yml文件，将themes修改为next（下载到的主题文件夹的名字）

-   hexo g
-   hexo d

关于hexo-next主题下的一些个性化配置，参考：[Next主题配置](http://theme-next.iissnan.com/)

## [¶](#更新博客内容)更新博客内容

至此博客已经搭建完毕，域名也已经正常解析，那么剩下的问题就是更新内容了。

### [¶](#更新文章)更新文章

1.  在MyBlog目录下执行：`hexo new` “我的第一篇文章”，会在`source\_posts`文件夹内生成一个.md文件。
2.  编辑该文件（遵循Markdown规则）
3.  修改起始字段

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br></pre></td><td class="code"><pre><span class="line">title 文章的标题</span><br><span class="line">date 创建日期 （文件的创建日期 ）</span><br><span class="line">updated 修改日期 （ 文件的修改日期）</span><br><span class="line">comments 是否开启评论 true</span><br><span class="line">tags 标签</span><br><span class="line">categories 分类</span><br><span class="line">permalink url中的名字（文件名）</span><br><span class="line">编写正文内容（MakeDown）</span><br><span class="line">hexo clean 删除本地静态文件（Public目录），可不执行。</span><br><span class="line">hexo g 生成本地静态文件（Public目录）</span><br><span class="line">hexo deploy 将本地静态文件推送至github（hexo d）</span><br></pre></td></tr></tbody></table>

4.  编写正文内容（MakeDown）
5.  hexo clean 删除本地静态文件（Public目录），可不执行。
6.  hexo g 生成本地静态文件（Public目录）
7.  hexo deploy 将本地静态文件推送至github（hexo d）

### [¶](#添加菜单)添加菜单

进入theme目录，编辑\_config\_yml文件，找到menu:字段，在该字段下添加一个字段。  
NexT主题菜单设置，用于设置博客上方导航栏，在主题配置文件中修改。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line">menu:</span><br><span class="line">  home: /                       #主页</span><br><span class="line">  categories: /categories	      #分类页（需手动创建）</span><br><span class="line">  #about: /about 			        	#关于页面（需手动创建）</span><br><span class="line">  archives: /archives		       	#归档页</span><br><span class="line">  tags: /tags				           	#标签页（需手动创建）</span><br><span class="line">  #commonweal: /404.html        #公益 404 （需手动创建）</span><br></pre></td></tr></tbody></table>

-   只是在menu选项中设置还不能让标签页面、分类页面生效，需要我们手动创建 \*

### [¶](#标签页面)标签页面

1.  运行以下命令

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo <span class="keyword">new</span> page <span class="string">"tags"</span></span><br></pre></td></tr></tbody></table>

同时，在/source目录下会生成一个tags文件夹，里面包含一个index.md文件

2.  修改/source/tags目录下的index.md文件

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line">title: tags</span><br><span class="line">date: <span class="number">2015</span>-<span class="number">09</span>-<span class="number">29</span> <span class="number">14</span>:<span class="number">37</span>:<span class="number">02</span></span><br><span class="line">type: <span class="string">"tags"</span></span><br><span class="line">---</span><br></pre></td></tr></tbody></table>

3.  修改主题配置文件  
    去掉tags的注释

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line">menu:</span><br><span class="line">  home: /                       #主页</span><br><span class="line">  categories: /categories	    	#分类页（需手动创建）</span><br><span class="line">  #about: /about			         	#关于页面（需手动创建）</span><br><span class="line">  archives: /archives	      		#归档页</span><br><span class="line">  tags: /tags				           	#标签页（需手动创建）</span><br><span class="line">  #commonweal: /404.html        #公益 404 （需手动创建）</span><br></pre></td></tr></tbody></table>

### [¶](#分类页面)分类页面

1.  运行以下命令

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">hexo <span class="keyword">new</span> page <span class="string">"categories"</span></span><br></pre></td></tr></tbody></table>

同时，在/source目录下会生成一个categories文件夹，里面包含一个index.md文件

2.  修改/source/categories目录下的index.md文件

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line">title: categories</span><br><span class="line">date: <span class="number">2015</span>-<span class="number">09</span>-<span class="number">29</span> <span class="number">14</span>:<span class="number">47</span>:<span class="number">21</span></span><br><span class="line">type: <span class="string">"categories"</span></span><br><span class="line">---</span><br></pre></td></tr></tbody></table>

3.  修改主题配置文件  
    去掉categories的注释

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line">menu:</span><br><span class="line">  home: /                       #主页</span><br><span class="line">  categories: /categories	    	#分类页（需手动创建）</span><br><span class="line">  #about: /about			         	#关于页面（需手动创建）</span><br><span class="line">  archives: /archives		       	#归档页</span><br><span class="line">  tags: /tags				           	#标签页（需手动创建）</span><br><span class="line">  #commonweal: /404.html        #公益 404 （需手动创建）</span><br></pre></td></tr></tbody></table>

## [¶](#主题美化)主题美化

### [¶](#侧边栏头像设置)侧边栏头像设置

编辑站点配置文件，增加avatar字段

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line"># 头像</span><br><span class="line">avatar: /images/avatar.png</span><br></pre></td></tr></tbody></table>

头像图片须放置在主题的/source/images/目录下

### [¶](#文章中添加居中模块)文章中添加居中模块

文章Markdown中填写如下：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">&lt;blockquote class="blockquote-center"&gt;优秀的人，不是不合群，而是他们合群的人里面没有你&lt;/blockquote&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#在文章底部增加版权信息)在文章底部增加版权信息

在目录 next/layout/\_macro/下添加 my-copyright.swig：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br><span class="line">25</span><br><span class="line">26</span><br><span class="line">27</span><br><span class="line">28</span><br><span class="line">29</span><br><span class="line">30</span><br><span class="line">31</span><br></pre></td><td class="code"><pre><span class="line">{% <span class="keyword">if</span> page.copyright %}</span><br><span class="line">&lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"my_post_copyright"</span>&gt;</span><br><span class="line">  &lt;script src="//cdn.bootcss.com/clipboard.js/1.5.10/clipboard.min.js"&gt;&lt;/script&gt;</span><br><span class="line">  &lt;!-- JS库 sweetalert 可修改路径 --&gt;</span><br><span class="line">  &lt;script type="text/javascript" src="http://jslibs.wuxubj.cn/sweetalert_mini/jquery-1.7.1.min.js"&gt;&lt;/script&gt;</span><br><span class="line">  &lt;script src="http://jslibs.wuxubj.cn/sweetalert_mini/sweetalert.min.js"&gt;&lt;/script&gt;</span><br><span class="line">  &lt;link rel=<span class="string">"stylesheet"</span> type=<span class="string">"text/css"</span> href=<span class="string">"http://jslibs.wuxubj.cn/sweetalert_mini/sweetalert.mini.css"</span>&gt;</span><br><span class="line">  &lt;p&gt;&lt;span&gt;本文标题:&lt;/span&gt;&lt;a href="{{ url_for(page.path) }}&gt;{{ page.title }}/a&gt;&lt;/p&gt;</span><br><span class="line">  &lt;p&gt;&lt;span&gt;文章作者:&lt;/span&gt;&lt;a href="/" title="访问 {{ theme.author }}的个人博客"&gt;{{ theme.author }}/a&gt;&lt;/p&gt;</span><br><span class="line">  &lt;p&gt;&lt;span&gt;发布时间:&lt;/span&gt;{{ page.date.format("YYYY年MM月DD日 - HH:MM") }}/p&gt;</span><br><span class="line">  &lt;p&gt;&lt;span&gt;最后更新:&lt;/span&gt;{{ page.updated.format("YYYY年MM月DD日 - HH:MM") }}/p&gt;</span><br><span class="line">  &lt;p&gt;&lt;span&gt;原始链接:&lt;/span&gt;&lt;a href="{{ url_for(page.path) }} title="{{ page.title }}&gt;{{ page.permalink }}/a&gt;</span><br><span class="line">    &lt;span <span class="class"><span class="keyword">class</span></span>=<span class="string">"copy-path"</span>  title=<span class="string">"点击复制文章链接"</span>&gt;&lt;i <span class="class"><span class="keyword">class</span></span>=<span class="string">"fa fa-clipboard"</span> data-clipboard-text=<span class="string">"{{ page.permalink }}  aria-label="</span>复制成功！<span class="string">"&gt;&lt;/i&gt;&lt;/span&gt;</span></span><br><span class="line"><span class="string">  &lt;/p&gt;</span></span><br><span class="line"><span class="string">  &lt;p&gt;&lt;span&gt;许可协议:&lt;/span&gt;&lt;i class="</span>fa fa-creative-commons<span class="string">"&gt;&lt;/i&gt; &lt;a rel="</span>license<span class="string">" href="</span>https:<span class="comment">//creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" title="Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)"&gt;署名-非商业性使用-禁止演绎 4.0 国际&lt;/a&gt; 转载请保留原文链接及作者。&lt;/p&gt;  </span></span><br><span class="line">&lt;/div&gt;</span><br><span class="line">&lt;script&gt; </span><br><span class="line">    var clipboard = <span class="keyword">new</span> Clipboard(<span class="string">'.fa-clipboard'</span>);</span><br><span class="line">    clipboard.on(<span class="string">'success'</span>, $(function(){</span><br><span class="line">      $(<span class="string">".fa-clipboard"</span>).click(function(){</span><br><span class="line">        swal({   </span><br><span class="line">          title: <span class="string">""</span>,   </span><br><span class="line">          text: <span class="string">'复制成功'</span>,   </span><br><span class="line">          html: <span class="keyword">false</span>,</span><br><span class="line">          timer: <span class="number">500</span>,   </span><br><span class="line">          showConfirmButton: <span class="keyword">false</span></span><br><span class="line">        });</span><br><span class="line">      });</span><br><span class="line">    }));  </span><br><span class="line">&lt;/script&gt;</span><br><span class="line">{% endif %}</span><br></pre></td></tr></tbody></table>

在目录next/source/css/\_common/components/post/下添加my-post-copyright.styl：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br><span class="line">25</span><br><span class="line">26</span><br><span class="line">27</span><br><span class="line">28</span><br><span class="line">29</span><br><span class="line">30</span><br><span class="line">31</span><br><span class="line">32</span><br><span class="line">33</span><br><span class="line">34</span><br><span class="line">35</span><br><span class="line">36</span><br><span class="line">37</span><br><span class="line">38</span><br><span class="line">39</span><br><span class="line">40</span><br><span class="line">41</span><br><span class="line">42</span><br><span class="line">43</span><br><span class="line">44</span><br><span class="line">45</span><br></pre></td><td class="code"><pre><span class="line">.my_post_copyright {</span><br><span class="line">  width: <span class="number">85</span>%;</span><br><span class="line">  max-width: <span class="number">45</span>em;</span><br><span class="line">  margin: <span class="number">2.8</span>em auto <span class="number">0</span>;</span><br><span class="line">  padding: <span class="number">0.5</span>em <span class="number">1.0</span>em;</span><br><span class="line">  border: 1px solid #d3d3d3;</span><br><span class="line">  font-size: <span class="number">0.93</span>rem;</span><br><span class="line">  line-height: <span class="number">1.6</span>em;</span><br><span class="line">  word-<span class="keyword">break</span>: <span class="keyword">break</span>-all;</span><br><span class="line">  background: rgba(<span class="number">255</span>,<span class="number">255</span>,<span class="number">255</span>,<span class="number">0.4</span>);</span><br><span class="line">}</span><br><span class="line">.my_post_copyright p{margin:<span class="number">0</span>;}</span><br><span class="line">.my_post_copyright span {</span><br><span class="line">  display: inline-block;</span><br><span class="line">  width: <span class="number">5.2</span>em;</span><br><span class="line">  color: #b5b5b5;</span><br><span class="line">  font-weight: bold;</span><br><span class="line">}</span><br><span class="line">.my_post_copyright .raw {</span><br><span class="line">  margin-left: <span class="number">1</span>em;</span><br><span class="line">  width: <span class="number">5</span>em;</span><br><span class="line">}</span><br><span class="line">.my_post_copyright a {</span><br><span class="line">  color: #808080;</span><br><span class="line">  border-bottom:<span class="number">0</span>;</span><br><span class="line">}</span><br><span class="line">.my_post_copyright a:hover {</span><br><span class="line">  color: #a3d2a3;</span><br><span class="line">  text-decoration: underline;</span><br><span class="line">}</span><br><span class="line">.my_post_copyright:hover .fa-clipboard {</span><br><span class="line">  color: #000;</span><br><span class="line">}</span><br><span class="line">.my_post_copyright .post-url:hover {</span><br><span class="line">  font-weight: normal;</span><br><span class="line">}</span><br><span class="line">.my_post_copyright .copy-path {</span><br><span class="line">  margin-left: <span class="number">1</span>em;</span><br><span class="line">  width: <span class="number">1</span>em;</span><br><span class="line">  +mobile(){display:none;}</span><br><span class="line">}</span><br><span class="line">.my_post_copyright .copy-path:hover {</span><br><span class="line">  color: #808080;</span><br><span class="line">  cursor: pointer;</span><br><span class="line">}</span><br></pre></td></tr></tbody></table>

修改next/layout/\_macro/post.swig，在代码

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br></pre></td><td class="code"><pre><span class="line">&lt;div&gt;</span><br><span class="line">      {% <span class="keyword">if</span> not is_index %}</span><br><span class="line">        {% include <span class="string">'wechat-subscriber.swig'</span> %}</span><br><span class="line">      {% endif %}</span><br><span class="line">&lt;/div&gt;</span><br></pre></td></tr></tbody></table>

之前添加增加如下代码：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br></pre></td><td class="code"><pre><span class="line">&lt;div&gt;</span><br><span class="line">      {% <span class="keyword">if</span> not is_index %}</span><br><span class="line">        {% include <span class="string">'my-copyright.swig'</span> %}</span><br><span class="line">      {% endif %}</span><br><span class="line">&lt;/div&gt;</span><br></pre></td></tr></tbody></table>

修改next/source/css/\_common/components/post/post.styl文件，在最后一行增加代码：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line"><span class="meta">@import</span> <span class="string">"my-post-copyright"</span></span><br></pre></td></tr></tbody></table>

如果要在该博文下面增加版权信息的显示，需要在 Markdown 中增加copyright: true的设置，类似：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line">---</span><br><span class="line">title: </span><br><span class="line">date: </span><br><span class="line">tags: </span><br><span class="line">categories: </span><br><span class="line">copyright: <span class="keyword">true</span></span><br><span class="line">---</span><br></pre></td></tr></tbody></table>

### [¶](#自定义hexo-new生成md文件的选项)自定义hexo new生成md文件的选项

在/scaffolds/post.md文件中添加：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br></pre></td><td class="code"><pre><span class="line">---</span><br><span class="line">title: {{ title }}date: {{ date }}tags:</span><br><span class="line">categories: </span><br><span class="line">copyright: <span class="keyword">true</span></span><br><span class="line">permalink: <span class="number">01</span></span><br><span class="line">top: <span class="number">0</span></span><br><span class="line">password:</span><br><span class="line">---</span><br></pre></td></tr></tbody></table>

### [¶](#隐藏网页底部powered-by-hexo-强力驱动)隐藏网页底部powered By Hexo / 强力驱动

打开themes/next/layout/\_partials/footer.swig,使用””隐藏之间的代码即可，或者直接删除。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br></pre></td><td class="code"><pre><span class="line">&lt;!--</span><br><span class="line">&lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"powered-by"</span>&gt;</span><br><span class="line">  {{ __('footer.powered', '&lt;a class="theme-link" rel="external nofollow" href="https://hexo.io"&gt;Hexo&lt;/a&gt;') }}&lt;/div&gt;</span><br><span class="line">&lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"theme-info"</span>&gt;</span><br><span class="line">  {{ __(<span class="string">'footer.theme'</span>) }}-</span><br><span class="line">  &lt;a <span class="class"><span class="keyword">class</span></span>=<span class="string">"theme-link"</span> rel=<span class="string">"external nofollow"</span> href=<span class="string">"https://github.com/iissnan/hexo-theme-next"</span>&gt;</span><br><span class="line">    NexT.{{ theme.scheme }}  &lt;/a&gt;</span><br><span class="line">&lt;/div&gt;</span><br><span class="line">--&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#文章加密访问)文章加密访问

打开themes->next->layout->\_partials->head.swig文件,在meta标签后面插入这样一段代码：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br></pre></td><td class="code"><pre><span class="line">&lt;script&gt;</span><br><span class="line">    (function(){</span><br><span class="line">        <span class="keyword">if</span>(<span class="string">'{{ page.password }}){</span></span><br><span class="line"><span class="string">            if (prompt('</span>请输入文章密码<span class="string">') !== '</span>{{ page.password }}){</span><br><span class="line">                alert(<span class="string">'密码错误！'</span>);</span><br><span class="line">                history.back();</span><br><span class="line">            }</span><br><span class="line">        }</span><br><span class="line">    })();</span><br><span class="line">&lt;/script&gt;</span><br></pre></td></tr></tbody></table>

然后文章中添加：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">password: nmask</span><br></pre></td></tr></tbody></table>

如果password后面为空，则表示不用密码。

### [¶](#文章置顶)文章置顶

修改 hero-generator-index 插件，把文件：node\_modules/hexo-generator-index/lib/generator.js 内的代码替换为：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br><span class="line">25</span><br><span class="line">26</span><br><span class="line">27</span><br><span class="line">28</span><br></pre></td><td class="code"><pre><span class="line"><span class="string">'use strict'</span>;</span><br><span class="line">var pagination = require(<span class="string">'hexo-pagination'</span>);</span><br><span class="line"><span class="keyword">module</span>.<span class="keyword">exports</span> = function(locals){</span><br><span class="line">  var config = <span class="keyword">this</span>.config;</span><br><span class="line">  var posts = locals.posts;</span><br><span class="line">    posts.data = posts.data.sort(function(a, b) {</span><br><span class="line">        <span class="keyword">if</span>(a.top &amp;&amp; b.top) { <span class="comment">// 两篇文章top都有定义</span></span><br><span class="line">            <span class="keyword">if</span>(a.top == b.top) <span class="keyword">return</span> b.date - a.date; <span class="comment">// 若top值一样则按照文章日期降序排</span></span><br><span class="line">            <span class="keyword">else</span> <span class="keyword">return</span> b.top - a.top; <span class="comment">// 否则按照top值降序排</span></span><br><span class="line">        }</span><br><span class="line">        <span class="keyword">else</span> <span class="keyword">if</span>(a.top &amp;&amp; !b.top) { <span class="comment">// 以下是只有一篇文章top有定义，那么将有top的排在前面（这里用异或操作居然不行233）</span></span><br><span class="line">            <span class="keyword">return</span> -<span class="number">1</span>;</span><br><span class="line">        }</span><br><span class="line">        <span class="keyword">else</span> <span class="keyword">if</span>(!a.top &amp;&amp; b.top) {</span><br><span class="line">            <span class="keyword">return</span> <span class="number">1</span>;</span><br><span class="line">        }</span><br><span class="line">        <span class="keyword">else</span> <span class="keyword">return</span> b.date - a.date; <span class="comment">// 都没定义按照文章日期降序排</span></span><br><span class="line">    });</span><br><span class="line">  var paginationDir = config.pagination_dir || <span class="string">'page'</span>;</span><br><span class="line">  <span class="keyword">return</span> pagination(<span class="string">''</span>, posts, {</span><br><span class="line">    perPage: config.index_generator.per_page,</span><br><span class="line">    layout: [<span class="string">'index'</span>, <span class="string">'archive'</span>],</span><br><span class="line">    format: paginationDir + <span class="string">'/%d/'</span>,</span><br><span class="line">    data: {</span><br><span class="line">      __index: <span class="keyword">true</span></span><br><span class="line">    }</span><br><span class="line">  });</span><br><span class="line">};</span><br></pre></td></tr></tbody></table>

在文章中添加 top 值，数值越大文章越靠前，如:

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br></pre></td><td class="code"><pre><span class="line">---</span><br><span class="line">......</span><br><span class="line">copyright: <span class="keyword">true</span></span><br><span class="line">top: <span class="number">100</span></span><br><span class="line">---</span><br></pre></td></tr></tbody></table>

默认不设置则为0，数值相同时按时间排序。

### [¶](#添加顶部加载条)添加顶部加载条

打开/themes/next/layout/\_partials/head.swig文件，在maximum-scale=1”/>后添加如下代码:

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">&lt;script src="//cdn.bootcss.com/pace/1.0.2/pace.min.js"&gt;&lt;/script&gt;</span><br><span class="line">&lt;link href=<span class="string">"//cdn.bootcss.com/pace/1.0.2/themes/pink/pace-theme-flash.css"</span> rel=<span class="string">"stylesheet"</span>&gt;</span><br></pre></td></tr></tbody></table>

但是，默认的是粉色的，要改变颜色可以在/themes/next/layout/\_partials/head.swig文件中添加如下代码（接在刚才link的后面）

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br></pre></td><td class="code"><pre><span class="line">&lt;style&gt;</span><br><span class="line">    .pace .pace-progress {</span><br><span class="line">        background: #1E92FB; /*进度条颜色*/</span><br><span class="line">        height: <span class="number">3</span>px;</span><br><span class="line">    }</span><br><span class="line">    .pace .pace-progress-inner {</span><br><span class="line">         box-shadow: 0 0 10px #1E92FB, 0 0 5px     #1E92FB; /*阴影颜色*/</span><br><span class="line">    }</span><br><span class="line">    .pace .pace-activity {</span><br><span class="line">        border-top-color: #1E92FB;    /*上边框颜色*/</span><br><span class="line">        border-left-color: #1E92FB;    /*左边框颜色*/</span><br><span class="line">    }</span><br><span class="line">&lt;/style&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#添加文章热度)添加文章热度

next主题集成leanCloud，打开/themes/next/layout/\_macro/post.swig  
在”leancloud-visitors-count”>标签后面添加℃。  
然后打开，/themes/next/languages/zh-Hans.yml，将visitors内容改为热度即可。

### [¶](#主页文章添加阴影效果)主页文章添加阴影效果

打开\\themes\\next\\source\\css\_custom\\custom.styl,向里面加入：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br></pre></td><td class="code"><pre><span class="line"><span class="comment">// 主页文章添加阴影效果</span></span><br><span class="line"> .post {</span><br><span class="line">   margin-top: <span class="number">60</span>px;</span><br><span class="line">   margin-bottom: <span class="number">60</span>px;</span><br><span class="line">   padding: <span class="number">25</span>px;</span><br><span class="line">   -webkit-box-shadow: <span class="number">0</span> <span class="number">0</span> <span class="number">5</span><span class="function">px <span class="title">rgba</span><span class="params">(<span class="number">202</span>, <span class="number">203</span>, <span class="number">203</span>, <span class="number">.5</span>)</span></span>;</span><br><span class="line">   -moz-box-shadow: <span class="number">0</span> <span class="number">0</span> <span class="number">5</span><span class="function">px <span class="title">rgba</span><span class="params">(<span class="number">202</span>, <span class="number">203</span>, <span class="number">204</span>, <span class="number">.5</span>)</span></span>;</span><br><span class="line">  }</span><br></pre></td></tr></tbody></table>

### [¶](#修改文章底部的那个带-号的标签)修改文章底部的那个带#号的标签

修改模板/themes/next/layout/\_macro/post.swig，搜索 rel=”tag”>#，将 # 换成 🏷

### [¶](#鼠标点击小红心的设置)鼠标点击小红心的设置

将 [love.js](https://github.com/Neveryu/Neveryu.github.io/blob/master/js/src/love.js) 文件添加到 \\themes\\next\\source\\js\\src 文件目录下。  
找到 \\themes\\next\\layout\_layout.swing 文件， 在文件的后面， 标签之前 添加以下代码：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">&lt;!-- 页面点击小红心 --&gt;</span><br><span class="line">&lt;script type="text/javascript" src="/js/src/love.js"&gt;&lt;/script&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#鼠标点击四级单词)鼠标点击四级单词

同上道理将[里面改的js文件下载](https://github.com/flymysql/CET4-Mouse-click-effects)  
文件添加到 \\themes\\next\\source\\js\\src 文件目录下。  
找到 \\themes\\next\\layout\_layout.swing 文件， 在文件的后面， 标签之前 添加以下代码：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">&lt;!-- 页面点击小红心 --&gt;</span><br><span class="line">&lt;script type="text/javascript" src="/js/src/cet4.js"&gt;&lt;/script&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#鼠标点击文明和谐)鼠标点击文明和谐

将上述的love.js(或者自己新建一个js文件也都可以)改成

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br><span class="line">25</span><br><span class="line">26</span><br><span class="line">27</span><br><span class="line">28</span><br><span class="line">29</span><br><span class="line">30</span><br></pre></td><td class="code"><pre><span class="line">&lt;script type=<span class="string">"text/javascript"</span>&gt;</span><br><span class="line"><span class="comment">/* 鼠标点击特效 */</span></span><br><span class="line">var a_idx = <span class="number">0</span>;</span><br><span class="line">jQuery(document).ready(function($) {</span><br><span class="line">    $(<span class="string">"body"</span>).click(function(e) {</span><br><span class="line">var a = <span class="keyword">new</span> Array(<span class="string">"富强"</span>, <span class="string">"民主"</span>, <span class="string">"文明"</span>, <span class="string">"和谐"</span>, <span class="string">"自由"</span>, <span class="string">"平等"</span>, <span class="string">"公正"</span> ,<span class="string">"法治"</span>, <span class="string">"爱国"</span>, <span class="string">"敬业"</span>, <span class="string">"诚信"</span>, <span class="string">"友善"</span>);</span><br><span class="line">var $i = $(<span class="string">"&lt;span/&gt;"</span>).text(a[a_idx]);</span><br><span class="line">        a_idx = (a_idx + <span class="number">1</span>) % a.length;</span><br><span class="line">var x = e.pageX,</span><br><span class="line">        y = e.pageY;</span><br><span class="line">        $i.css({</span><br><span class="line"><span class="string">"z-index"</span>: <span class="number">999999999999999999999999999999999999999999999999999999999999999999999</span>,</span><br><span class="line"><span class="string">"top"</span>: y - <span class="number">120</span>,</span><br><span class="line"><span class="string">"left"</span>: x,</span><br><span class="line"><span class="string">"position"</span>: <span class="string">"absolute"</span>,</span><br><span class="line"><span class="string">"font-weight"</span>: <span class="string">"bold"</span>,</span><br><span class="line"><span class="string">"color"</span>: <span class="string">"#ff6651"</span></span><br><span class="line">        });</span><br><span class="line">        $(<span class="string">"body"</span>).append($i);</span><br><span class="line">        $i.animate({</span><br><span class="line"><span class="string">"top"</span>: y - <span class="number">180</span>,</span><br><span class="line"><span class="string">"opacity"</span>: <span class="number">0</span></span><br><span class="line">        },</span><br><span class="line">        <span class="number">1500</span>,</span><br><span class="line">function() {</span><br><span class="line">            $i.remove();</span><br><span class="line">        });</span><br><span class="line">    });</span><br><span class="line">});</span><br><span class="line">&lt;/script&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#背景的设置)背景的设置

将 [particle.js](https://github.com/Neveryu/Neveryu.github.io/blob/master/js/src/particle.js) 文件添加到 \\themes\\next\\source\\js\\src 文件目录下。  
找到 \\themes\\next\\layout\_layout.swing 文件， 在文件的后面，标签之前 添加以下代码：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">&lt;!-- 背景动画 --&gt;</span><br><span class="line">&lt;script type="text/javascript" src="/js/src/particle.js"&gt;&lt;/script&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#搜索功能)搜索功能

安装 hexo-generator-searchdb，在站点的根目录下执行以下命令：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ npm install hexo-generator-searchdb --save</span><br></pre></td></tr></tbody></table>

编辑 站点配置文件，新增以下内容到任意位置：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br></pre></td><td class="code"><pre><span class="line">search:</span><br><span class="line">  path: search.xml</span><br><span class="line">  field: post</span><br><span class="line">  format: html</span><br><span class="line">  limit: <span class="number">10000</span></span><br></pre></td></tr></tbody></table>

### [¶](#添加来必力评论)添加来必力评论

多说已经宣布下线了，找了个来必力评论系统来替换，以下是替换的教程，教程内容来自：[https://blog.smoker.cc/web/add-comments-livere-for-hexo-theme-next.html](https://blog.smoker.cc/web/add-comments-livere-for-hexo-theme-next.html)

来必力评价  
优点：界面美观  
缺点：不支持数据导入，加载慢

首先在 \_config.yml 文件中添加如下配置：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">livere_uid: your uid</span><br></pre></td></tr></tbody></table>

其中 livere\_uid 即注册来必力获取到的 uid。  
在 layout/\_scripts/third-party/comments/ 目录中添加 livere.swig，文件内容如下：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br></pre></td><td class="code"><pre><span class="line">{% <span class="function"><span class="keyword">if</span> <span class="title">not</span> <span class="params">(theme.duoshuo and theme.duoshuo.shortname)</span> and not theme.duoshuo_shortname and not theme.disqus_shortname and not theme.hypercomments_id and not theme.gentie_productKey %}</span></span><br><span class="line"><span class="function">  </span>{% <span class="keyword">if</span> theme.livere_uid %}</span><br><span class="line">    &lt;script type=<span class="string">"text/javascript"</span>&gt;</span><br><span class="line">      (function(d, s) {</span><br><span class="line">        var j, e = d.getElementsByTagName(s)[<span class="number">0</span>];</span><br><span class="line">        <span class="keyword">if</span> (typeof LivereTower === <span class="string">'function'</span>) { <span class="keyword">return</span>; }</span><br><span class="line">        j = d.createElement(s);</span><br><span class="line">        j.src = <span class="string">'https://cdn-city.livere.com/js/embed.dist.js'</span>;</span><br><span class="line">        j.async = <span class="keyword">true</span>;</span><br><span class="line">        e.parentNode.insertBefore(j, e);</span><br><span class="line">      })(document, <span class="string">'script'</span>);</span><br><span class="line">    &lt;/script&gt;</span><br><span class="line">  {% endif %}</span><br><span class="line">{% endif %}</span><br></pre></td></tr></tbody></table>

优先使用其他评论插件，如果其他评论插件没有开启，且LiveRe评论插件配置开启了，则使用LiveRe。其中脚本代码为上一步管理页面中获取到的。在layout/\_scripts/third-party/comments.swig文件中追加：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">{% include <span class="string">'./comments/livere.swig'</span> %}</span><br></pre></td></tr></tbody></table>

引入 LiveRe 评论插件。  
最后，在 layout/\_partials/comments.swig 文件中条件最后追加LiveRe插件是否引用的判断逻辑：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line">{% elseif theme.livere_uid %}</span><br><span class="line">      &lt;div id="lv-container" data-id="city" data-uid="{{ theme.livere_uid }}"&gt;&lt;/div&gt;</span><br><span class="line">{% endif %}</span><br></pre></td></tr></tbody></table>

### [¶](#解决来必力评论系统加载慢的方法)解决来必力评论系统加载慢的方法

-   灵感：大家平常说的加载慢，其实是因为来必力这个框架它是等读者把滚动条拉到文末评论的位置的时候才开始加载。  
    如果是让他从我们点进文章的时候就开始加载，那么等读者看完文章，评论也早就加载完了（除非有人一进来就去底下看评论）

**所以只要我们在文章章加载后就去加载来必力评论系统，等看完文章，评论也早就加载完了，也不会察觉到它的加载**

#### [¶](#方法)方法

方法其实很简单，但是我实验了好久才找到这个，先说方法

我们打开\\yourhexo\\themes\\next\\layout\_partials\\comments.swig

找到来必力的评论模块

将这段代码

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line">&lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"comments"</span> id=<span class="string">"comments"</span>&gt;</span><br><span class="line">  &lt;div id="lv-container" data-id="city" data-uid="{{ theme.livere_uid }}"&gt;&lt;/div&gt;</span><br><span class="line">&lt;/div&gt;</span><br></pre></td></tr></tbody></table>

改成

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">&lt;iframe title="livere" src="https://was.livere.me/comment/city?id=city&amp;refer={{page.permalink}}&amp;uid={{theme.livere_uid}}&amp;site={{page.permalink}}&amp;title={{page.title}}" scrolling="" frameborder="0" id="lv-comment-399" style="min-width: 100%; width: 100px; min-height: 400px; overflow: auto; border: 0px; z-index: 124212; height: 500px;" &gt;&lt;/iframe&gt;</span><br></pre></td></tr></tbody></table>

**然后就ok啦**重新编译和提交博客内容，**不过需要先清除缓存**

博客根目录命令行打开

-   **hexo clean**
-   **hexo d -g**

**以上你就解决了来必力评论系统加载慢的问题**

#### [¶](#出现的问题)出现的问题

> 昨天发现用的iframe框架没法自适应高度，如果评论多了，只能在页面滚动展现

所以我有找了个方法，不过这个方法比较麻烦

**不推荐！**

喜欢折腾的朋友可以尝试

就是将上面说的\\yourhexo\\themes\\next\\layout\_partials\\comments.swig

将这段代码

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line">&lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"comments"</span> id=<span class="string">"comments"</span>&gt;</span><br><span class="line">  &lt;div id="lv-container" data-id="city" data-uid="{{ theme.livere_uid }}"&gt;&lt;/div&gt;</span><br><span class="line">&lt;/div&gt;</span><br></pre></td></tr></tbody></table>

换成

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br></pre></td><td class="code"><pre><span class="line"> &lt;div id=<span class="string">"container"</span> data-id=<span class="string">"city"</span> data-title=<span class="string">"{{page.title}}"</span> data-logo=<span class="string">""</span> data-desc=<span class="string">""</span> data-uid=<span class="string">"{{theme.livere_uid}}"</span> data-site=<span class="string">"{{page.permalink}}"</span> data-refer=<span class="string">"{{page.permalink}}"</span> data-redirectorigin=<span class="string">""</span> data-highlightseq=<span class="string">""</span> data-discuss=<span class="string">"false"</span> data-facebookpageid=<span class="string">""</span> data-facebookuploadurl=<span class="string">""</span>&gt;</span><br><span class="line">        &lt;script type=<span class="string">"text/javascript"</span>&gt;</span><br><span class="line">            (function(i,s,o,g,r,a,m){i[<span class="string">'GoogleAnalyticsObject'</span>]=r;i[r]=i[r]||function(){</span><br><span class="line">            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=<span class="number">1</span>*<span class="keyword">new</span> Date();a=s.createElement(o),</span><br><span class="line">            m=s.getElementsByTagName(o)[<span class="number">0</span>];a.async=<span class="number">1</span>;a.src=g;m.parentNode.insertBefore(a,m)</span><br><span class="line">            })(window,document,<span class="string">'script'</span>,<span class="string">'//www.google-analytics.com/analytics.js'</span>,<span class="string">'ga'</span>);</span><br><span class="line"></span><br><span class="line">            ga(<span class="string">'create'</span>, <span class="string">'UA-75302230-1'</span>, { sampleRate: <span class="number">1</span> });</span><br><span class="line">            ga(<span class="string">'send'</span>, <span class="string">'pageview'</span>);</span><br><span class="line">      &lt;/script&gt;</span><br><span class="line">    &lt;noscript&gt;Please enable JavaScript to view the LiveRe comments&lt;/a&gt;&lt;/noscript&gt;</span><br><span class="line"> &lt;/div&gt;</span><br><span class="line"></span><br><span class="line">&lt;link type=<span class="string">"text/css"</span> rel=<span class="string">"stylesheet"</span> href=<span class="string">"https://cdn-city.livere.com/css/comment.zero.css"</span>&gt;</span><br><span class="line">&lt;link type=<span class="string">"text/css"</span> rel=<span class="string">"stylesheet"</span> href=<span class="string">"https://cdn-city.livere.com/css/theme/realblack.zero.css"</span>&gt;</span><br><span class="line">&lt;script type="text/javascript" src="https://cdn-city.livere.com/js/lib.zero.js"&gt;&lt;/script&gt;</span><br><span class="line">&lt;script type="text/javascript" src="https://cdn-city.livere.com/js/comment.zero.zh-cn.dist.js"&gt;&lt;/script&gt;</span><br></pre></td></tr></tbody></table>

> 就是直接将框架里的代码复制出来，不用框架。  
> 但是这也会造成一个问题，没了框架的保护，来必力提供的外联样式表会与本地 css 样式冲突，导致本地的部分样式变形。

这就需要你自己动手去调整本地的样式！

所以会有前端基础的朋友可以试试

我是用chrome浏览器，控制台检查本地出错样式的name

然后在themes\\next\\source\\css\\\_custom\\custom.styl文件里自己写样式  
具体怎写就不细说了，可能不同主题博客也不一样  
看想不想折腾了

### [¶](#添加gitalk评论)添加gitalk评论

-   gitalk优点：稳定
-   gitalk缺点：只能GitHub登陆，对普通用户不友好

gitalk：一个基于 Github Issue 和 Preact 开发的评论插件  
详情Demo可见：[https://gitalk.github.io/](https://gitalk.github.io/)

#### [¶](#register-application)Register Application

在GitHub上注册新应用，链接：[https://github.com/settings/applications/new](https://github.com/settings/applications/new)

![兰州小红鸡](assets/uploads/2026/05/hexo博客搭建以及next美化教程-e8d13fc-02.png)

参数说明：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line">Application name： # 应用名称，随意</span><br><span class="line">Homepage URL： # 网站URL，如https://asdfv1929.github.io</span><br><span class="line">Application description # 描述，随意</span><br><span class="line">Authorization callback URL：# 网站URL，https://asdfv1929.github.io</span><br></pre></td></tr></tbody></table>

点击注册后，页面跳转如下，其中Client ID和Client Secret在后面的配置中需要用到，到时复制粘贴即可：

![兰州小红鸡](assets/uploads/2026/05/hexo博客搭建以及next美化教程-e8d13fc-03.png)

#### [¶](#gitalk-swig)gitalk.swig

新建/layout/\_third-party/comments/gitalk.swig文件，并添加内容：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br></pre></td><td class="code"><pre><span class="line">{% <span class="keyword">if</span> page.comments &amp;&amp; theme.gitalk.enable %}</span><br><span class="line">  &lt;link rel=<span class="string">"stylesheet"</span> href=<span class="string">"https://unpkg.com/gitalk/dist/gitalk.css"</span>&gt;</span><br><span class="line">  &lt;script src="https://unpkg.com/gitalk/dist/gitalk.min.js"&gt;&lt;/script&gt;</span><br><span class="line">   &lt;script type=<span class="string">"text/javascript"</span>&gt;</span><br><span class="line">        var gitalk = <span class="keyword">new</span> Gitalk({</span><br><span class="line">          clientID: <span class="string">'{{ theme.gitalk.ClientID }}'</span>,</span><br><span class="line">          clientSecret: <span class="string">'{{ theme.gitalk.ClientSecret }}'</span>,</span><br><span class="line">          repo: <span class="string">'{{ theme.gitalk.repo }}'</span>,</span><br><span class="line">          owner: <span class="string">'{{ theme.gitalk.githubID }}'</span>,</span><br><span class="line">          admin: [<span class="string">'{{ theme.gitalk.adminUser }}'</span>],</span><br><span class="line">          id: location.pathname,</span><br><span class="line">          distractionFreeMode: <span class="string">'{{ theme.gitalk.distractionFreeMode }}'</span></span><br><span class="line">        })</span><br><span class="line">        gitalk.render(<span class="string">'gitalk-container'</span>)           </span><br><span class="line">       &lt;/script&gt;</span><br><span class="line">{% endif %}</span><br></pre></td></tr></tbody></table>

#### [¶](#comments-swig)comments.swig

修改/layout/\_partials/comments.swig，添加内容如下，与前面的elseif同一级别上：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">{% elseif theme.gitalk.enable %}</span><br><span class="line"> &lt;div id="gitalk-container"&gt;&lt;/div&gt;</span><br></pre></td></tr></tbody></table>

#### [¶](#index-swig)index.swig

修改layout/\_third-party/comments/index.swig，在最后一行添加内容：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">{% include <span class="string">'gitalk.swig'</span> %}</span><br></pre></td></tr></tbody></table>

#### [¶](#config-yml)\_config.yml

在主题配置文件next/\_config.yml中添加如下内容：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br></pre></td><td class="code"><pre><span class="line">gitalk:</span><br><span class="line">  enable: <span class="keyword">true</span></span><br><span class="line">  githubID: github帐号  #    </span><br><span class="line">  repo: 仓库名称   # 名字，不是地址</span><br><span class="line">  ClientID: Client ID</span><br><span class="line">  ClientSecret: Client Secret</span><br><span class="line">  adminUser: github帐号 #指定可初始化评论账户</span><br><span class="line">  distractionFreeMode: <span class="keyword">true</span></span><br></pre></td></tr></tbody></table>

以上就是NexT中添加gitalk评论的配置，博客上传到GitHub上后，打开页面进入某一博客内容下，就可看到评论处。

部分问题解决方法，可参见：  
[https://liujunzhou.cn/2018/8/10/gitalk-error/#more](https://liujunzhou.cn/2018/8/10/gitalk-error/#more)

### [¶](#设置网页背景图片)设置网页背景图片

在themes\\next\\source\\css\_custom\\中添加

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line">body {</span><br><span class="line"> background-color: #fff; /*Default bg, similar to the background's base color*/</span><br><span class="line"> background-image:url(/images/bg.jpg);  <span class="comment">//你的背景图片地址</span></span><br><span class="line"> background-position: right bottom; <span class="comment">/*Positioning*/</span></span><br><span class="line"> background-attachment: fixed;</span><br><span class="line"> background-repeat: no-repeat; <span class="comment">/*Prevent showing multiple background images*/</span></span><br><span class="line">}</span><br></pre></td></tr></tbody></table>

将你的背景图片放在theme/next/source/images目录  
上面的css代码我只设置图片放在网页右下角，可以根据个人爱好设置

![](assets/uploads/2026/05/hexo博客搭建以及next美化教程-e8d13fc-04.png)

### [¶](#在主页添加标签云)在主页添加标签云

在目录themes\\next\\layout找到index.swig文件  
**在下面标记地方添加标记内容**

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br></pre></td><td class="code"><pre><span class="line">{% block content %}</span><br><span class="line"></span><br><span class="line"><span class="comment">//在这里添加下面内容</span></span><br><span class="line"></span><br><span class="line"> &lt;p style=<span class="string">"background-color: #000; color: #fff;font-weight: 800;font-size: 15px; width: 60px;text-align: center;"</span> &gt;</span><br><span class="line">	&lt;标签&gt;</span><br><span class="line">&lt;/p&gt;</span><br><span class="line"> &lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud"</span>&gt;</span><br><span class="line">            &lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud-tags"</span> align=<span class="string">"left"</span>&gt;</span><br><span class="line">              {{ tagcloud({min_font: 14, max_font: 14, amount: 300, color: true, start_color: '#888', end_color: '#888'}) }}            &lt;/div&gt;</span><br><span class="line">          &lt;/div&gt;</span><br><span class="line"></span><br><span class="line"><span class="comment">//上面内容</span></span><br><span class="line"></span><br><span class="line">  &lt;section id=<span class="string">"posts"</span> <span class="class"><span class="keyword">class</span></span>=<span class="string">"posts-expand"</span>&gt;</span><br><span class="line">    {% <span class="keyword">for</span> post in page.posts %}</span><br><span class="line">      {{ post_template.render(post, <span class="keyword">true</span>) }}    {% endfor %}</span><br><span class="line">  &lt;/section&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#设置字体)设置字体

注意： 此特性在版本 5.0.1 中引入，要使用此功能请确保所使用的 NexT 版本在此之后 为了解决 Google Fonts API 不稳定的问题，NexT 在 5.0.1 中引入此特性。

通过此特性，你可以指定所使用的字体库外链地址；与此同时，NexT 开放了 5 个特定范围的字体设定，他们是：

-   全局字体：定义的字体将在全站范围使用
    
-   标题字体：文章内标题的字体（h1, h2, h3, h4, h5, h6）
    
-   文章字体：文章所使用的字体
    
-   Logo字体：Logo 所使用的字体
    
-   代码字体： 代码块所使用的字体  
    各项所指定的字体将作为首选字体，当他们不可用时会自动 Fallback 到 NexT 设定的基础字体组：
    
-   非代码类字体：Fallback 到 “PingFang SC”, “Microsoft YaHei”, sans-serif
    
-   代码类字体： Fallback 到 consolas, Menlo, “PingFang SC”, “Microsoft YaHei”, monospace
    

另外，每一项都有一个额外的 external 属性，此属性用来控制是否使用外链字体库。 开放此属性方便你设定那些已经安装在系统中的字体，减少不必要的请求（请求大小）。

\*\*配置示例

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br><span class="line">25</span><br><span class="line">26</span><br><span class="line">27</span><br><span class="line">28</span><br><span class="line">29</span><br><span class="line">30</span><br><span class="line">31</span><br></pre></td><td class="code"><pre><span class="line">font:</span><br><span class="line">  enable: <span class="keyword">true</span></span><br><span class="line"></span><br><span class="line">  # 外链字体库地址，例如 //fonts.googleapis.com (默认值)</span><br><span class="line">  host:</span><br><span class="line"></span><br><span class="line">  # 全局字体，应用在 body 元素上</span><br><span class="line">  global:</span><br><span class="line">    external: <span class="keyword">true</span></span><br><span class="line">    family: Monda</span><br><span class="line"></span><br><span class="line">  # 标题字体 (h1, h2, h3, h4, h5, h6)</span><br><span class="line">  headings:</span><br><span class="line">    external: <span class="keyword">true</span></span><br><span class="line">    family: Roboto Slab</span><br><span class="line"></span><br><span class="line">  # 文章字体</span><br><span class="line">  posts:</span><br><span class="line">    external: <span class="keyword">true</span></span><br><span class="line">    family:</span><br><span class="line"></span><br><span class="line">  # Logo 字体</span><br><span class="line">  logo:</span><br><span class="line">    external: <span class="keyword">true</span></span><br><span class="line">    family: Lobster Two</span><br><span class="line">    size: <span class="number">24</span></span><br><span class="line"></span><br><span class="line">  # 代码字体，应用于 code 以及代码块</span><br><span class="line">  codes:</span><br><span class="line">    external: <span class="keyword">true</span></span><br><span class="line">    family: PT Mono</span><br></pre></td></tr></tbody></table>

### [¶](#设置代码高亮主题)设置代码高亮主题

NexT 使用 Tomorrow Theme 作为代码高亮，共有5款主题供你选择。 NexT 默认使用的是 白色的 normal 主题，可选的值有 normal，night， night blue， night bright， night eighties：

\*\*\*更改 highlight\_theme 字段，将其值设定成你所喜爱的高亮主题，例如：

高亮主题设置示例

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line"># Code Highlight theme</span><br><span class="line"># Available value: normal | night | night eighties | night blue | night bright</span><br><span class="line"># https://github.com/chriskempson/tomorrow-theme</span><br><span class="line">highlight_theme: normal</span><br></pre></td></tr></tbody></table>

### [¶](#侧边栏社交链接)侧边栏社交链接

侧栏社交链接的修改包含两个部分，第一是链接，第二是链接图标。 两者配置均在 主题配置文件 中。

1.  链接放置在 social 字段下，一行一个链接。其键值格式是 显示文本: 链接地址。

配置示例

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br></pre></td><td class="code"><pre><span class="line"># Social links</span><br><span class="line">social:</span><br><span class="line">  GitHub: https:<span class="comment">//github.com/your-user-name</span></span><br><span class="line">  Twitter: https:<span class="comment">//twitter.com/your-user-name</span></span><br><span class="line">  微博: http:<span class="comment">//weibo.com/your-user-name</span></span><br><span class="line">  豆瓣: http:<span class="comment">//douban.com/people/your-user-name</span></span><br><span class="line">  知乎: http:<span class="comment">//www.zhihu.com/people/your-user-name</span></span><br><span class="line">  # 等等</span><br></pre></td></tr></tbody></table>

2.  设定链接的图标，对应的字段是 social\_icons。其键值格式是 匹配键: Font Awesome 图标名称， 匹配键 与上一步所配置的链接的 显示文本 相同（大小写严格匹配），图标名称 是 Font Awesome 图标的名字（不必带 fa- 前缀）。 enable 选项用于控制是否显示图标，你可以设置成 false 来去掉图标。

配置示例

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br></pre></td><td class="code"><pre><span class="line"># Social Icons</span><br><span class="line">social_icons:</span><br><span class="line">  enable: <span class="keyword">true</span></span><br><span class="line">  # Icon Mappings</span><br><span class="line">  GitHub: github</span><br><span class="line">  Twitter: twitter</span><br><span class="line">  微博: weibo</span><br></pre></td></tr></tbody></table>

### [¶](#开启打赏功能)开启打赏功能

越来越多的平台（微信公众平台，新浪微博，简书，百度打赏等）支持打赏功能，付费阅读时代越来越近，特此增加了打赏功能，支持微信打赏和支付宝打赏。 只需要 主题配置文件 中填入 微信 和 支付宝 收款二维码图片地址 即可开启该功能。

打赏功能配置示例

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line">reward_comment: 坚持原创技术分享，您的支持将鼓励我继续创作！</span><br><span class="line">wechatpay: /path/to/wechat-reward-image</span><br><span class="line">alipay: /path/to/alipay-reward-image</span><br></pre></td></tr></tbody></table>

### [¶](#友情链接)友情链接

编辑 主题配置文件 添加：

友情链接配置示例

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br></pre></td><td class="code"><pre><span class="line"># title</span><br><span class="line">links_title: Links</span><br><span class="line">links:</span><br><span class="line">  MacTalk: http:<span class="comment">//macshuo.com/</span></span><br><span class="line">  Title: http:<span class="comment">//example.com/</span></span><br></pre></td></tr></tbody></table>

### [¶](#腾讯公益404页面)腾讯公益404页面

腾讯公益404页面，寻找丢失儿童，让大家一起关注此项公益事业！效果如下 [http://www.ixirong.com/404.html](http://www.ixirong.com/404.html)  
使用方法，新建 404.html 页面，放到主题的 source 目录下，内容如下：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br></pre></td><td class="code"><pre><span class="line">&lt;!DOCTYPE HTML&gt;</span><br><span class="line">&lt;html&gt;</span><br><span class="line">&lt;head&gt;</span><br><span class="line">  &lt;meta http-equiv=<span class="string">"content-type"</span> content=<span class="string">"text/html;charset=utf-8;"</span>/&gt;</span><br><span class="line">  &lt;meta http-equiv=<span class="string">"X-UA-Compatible"</span> content=<span class="string">"IE=edge,chrome=1"</span> /&gt;</span><br><span class="line">  &lt;meta name=<span class="string">"robots"</span> content=<span class="string">"all"</span> /&gt;</span><br><span class="line">  &lt;meta name=<span class="string">"robots"</span> content=<span class="string">"index,follow"</span>/&gt;</span><br><span class="line">  &lt;link rel=<span class="string">"stylesheet"</span> type=<span class="string">"text/css"</span> href=<span class="string">"https://qzone.qq.com/gy/404/style/404style.css"</span>&gt;</span><br><span class="line">&lt;/head&gt;</span><br><span class="line">&lt;body&gt;</span><br><span class="line">  &lt;script type=<span class="string">"text/plain"</span> src=<span class="string">"http://www.qq.com/404/search_children.js"</span></span><br><span class="line">          charset=<span class="string">"utf-8"</span> homePageUrl=<span class="string">"/"</span></span><br><span class="line">          homePageName=<span class="string">"回到我的主页"</span>&gt;</span><br><span class="line">  &lt;/script&gt;</span><br><span class="line">  &lt;script src="https://qzone.qq.com/gy/404/data.js" charset="utf-8"&gt;&lt;/script&gt;</span><br><span class="line">  &lt;script src="https://qzone.qq.com/gy/404/page.js" charset="utf-8"&gt;&lt;/script&gt;</span><br><span class="line">&lt;/body&gt;</span><br><span class="line">&lt;/html&gt;</span><br></pre></td></tr></tbody></table>

### [¶](#站点建立时间)站点建立时间

这个时间将在站点的底部显示，例如 © 2013 - 2015。 编辑 主题配置文件，新增字段 since。

配置示例

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">since: <span class="number">2013</span></span><br></pre></td></tr></tbody></table>

### [¶](#订阅微信公众号)订阅微信公众号

注意： 此特性在版本 5.0.1 中引入，要使用此功能请确保所使用的 NexT 版本在此之后  
在每篇文章的末尾显示微信公众号二维码，扫一扫，轻松订阅博客。

1.  在微信公众号平台下载您的二维码，并将它存放于博客source/uploads/目录下。
2.  然后编辑 主题配置文件，如下：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br></pre></td><td class="code"><pre><span class="line">配置示例</span><br><span class="line"># Wechat Subscriber</span><br><span class="line">wechat_subscriber:</span><br><span class="line">  enabled: <span class="keyword">true</span></span><br><span class="line">  qcode: /uploads/wechat-qcode.jpg</span><br><span class="line">  description: 欢迎您扫一扫上面的微信公众号，订阅我的博客！</span><br></pre></td></tr></tbody></table>

## [¶](#seo优化)SEO优化

seo优化对于网站是否能被搜索引擎快速收录有很大帮助，因此适当做一些seo还是有必要的，以下内容参考：https://lancelot\_lewis.coding.me/2016/08/16/blog/Hexo-NexT-SEO/

添加sitemap文件  
安装以下2个插件，然后重启hexo后，网站根目录（source）下会生成sitemap.xml与baidusitemap.xml文件，搜索引擎在爬取时会参照文件中的url去收录。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br></pre></td><td class="code"><pre><span class="line">npm install hexo-generator-sitemap --save-dev</span><br><span class="line">hexo d -g</span><br><span class="line">npm install hexo-generator-baidu-sitemap --save-dev</span><br><span class="line">hexo d -g</span><br></pre></td></tr></tbody></table>

#### [¶](#添加robots-txt)添加robots.txt

新建robots.txt文件，添加以下文件内容，把robots.txt放在hexo站点的source文件下。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br></pre></td><td class="code"><pre><span class="line">User-agent: * Allow: /</span><br><span class="line">Allow: /archives/</span><br><span class="line">Disallow: /vendors/</span><br><span class="line">Disallow: /js/</span><br><span class="line">Disallow: /css/</span><br><span class="line">Disallow: /fonts/</span><br><span class="line">Disallow: /vendors/</span><br><span class="line">Disallow: /fancybox/</span><br><span class="line">Sitemap: http:<span class="comment">//thief.one/sitemap.xml</span></span><br><span class="line">Sitemap: http:<span class="comment">//thief.one/baidusitemap.xml</span></span><br></pre></td></tr></tbody></table>

#### [¶](#首页title的优化)首页title的优化

更改index.swig文件，文件路径是your-hexo-site\\themes\\next\\layout，将下面代码

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">{% block title %}  {{ config.title }} {% endblock %}</span><br></pre></td></tr></tbody></table>

改成

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">{% block title %}  {{ config.title }}- {{ theme.description }} {% endblock}</span><br></pre></td></tr></tbody></table>

观察首页title就是标题+描述了。

### [¶](#sitemap插件)sitemap插件

Sitemap 可方便管理员通知搜索引擎他们网站上有哪些可供抓取的网页，有助于让别人更好地通过搜索到自己的博客。

sitemap安装配置

1.  安装

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ npm install hexo-generator-sitemap --save</span><br></pre></td></tr></tbody></table>

2.  修改站点配置文件

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br></pre></td><td class="code"><pre><span class="line"># Extensions</span><br><span class="line">plugins:</span><br><span class="line">- hexo-generator-sitemap</span><br></pre></td></tr></tbody></table>

使用以下命令后，你可以在站点的/public目录下找到一个sitemap.xml文件，这个文件就是你的站点地图，里面包含你的站点的网页地址。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">hexo clean</span><br><span class="line">hexo g</span><br></pre></td></tr></tbody></table>

[如何向google提交sitemap](http://fionat.github.io/blog/2013/10/23/sitemap/)

### [¶](#sitemap-xml无法生成问题)sitemap.xml无法生成问题

问题:  
使用以下命令安装sitemap插件后,按上面步骤配置，执行hexo g命令无法生成sitemap.xml文件。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ npm install hexo-generator-sitemap</span><br></pre></td></tr></tbody></table>

观察发现博客根目录下的package.json文件中dependencies并没有sitemap插件的依赖。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br></pre></td><td class="code"><pre><span class="line">{</span><br><span class="line">  <span class="string">"name"</span>: <span class="string">"hexo-site"</span>,</span><br><span class="line">  <span class="string">"version"</span>: <span class="string">"0.0.0"</span>,</span><br><span class="line">  <span class="string">"private"</span>: <span class="keyword">true</span>,</span><br><span class="line">  <span class="string">"hexo"</span>: {</span><br><span class="line">    <span class="string">"version"</span>: <span class="string">"3.1.1"</span></span><br><span class="line">  },</span><br><span class="line">  <span class="string">"dependencies"</span>: {</span><br><span class="line">    <span class="string">"hexo"</span>: <span class="string">"^3.1.0"</span>,</span><br><span class="line">    <span class="string">"hexo-deployer-git"</span>: <span class="string">"0.0.4"</span>,</span><br><span class="line">    <span class="string">"hexo-generator-archive"</span>: <span class="string">"^0.1.2"</span>,</span><br><span class="line">    <span class="string">"hexo-generator-category"</span>: <span class="string">"^0.1.2"</span>,</span><br><span class="line">    <span class="string">"hexo-generator-index"</span>: <span class="string">"^0.1.2"</span>,</span><br><span class="line">    <span class="string">"hexo-generator-tag"</span>: <span class="string">"^0.1.1"</span>,</span><br><span class="line">    <span class="string">"hexo-renderer-ejs"</span>: <span class="string">"^0.1.0"</span>,</span><br><span class="line">    <span class="string">"hexo-renderer-marked"</span>: <span class="string">"^0.2.4"</span>,</span><br><span class="line">    <span class="string">"hexo-renderer-stylus"</span>: <span class="string">"^0.3.0"</span>,</span><br><span class="line">    <span class="string">"hexo-server"</span>: <span class="string">"^0.1.2"</span></span><br><span class="line">  }</span><br><span class="line">}</span><br></pre></td></tr></tbody></table>

解决方法：  
如果已安装sitemap插件，卸载sitemap插件

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ npm uninstall hexo-generator-sitemap</span><br></pre></td></tr></tbody></table>

安装sitemap插件时，加上- -save参数，如下

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ npm install hexo-generator-sitemap --save</span><br></pre></td></tr></tbody></table>

安装完成后，我们再查看博客根目录下的package.json文件，发现dependencies中已经有了sitemap插件，然后我们再执行hexo g命令，就能够在/public目录下找到一个sitemap.xml文件了。

### [¶](#baidusitemap安装配置)baidusitemap安装配置

普通的Sitemap格式不符合百度的要求，所以我们要安装以下插件

1.  安装

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">$ npm install hexo-generator-baidu-sitemap --save</span><br></pre></td></tr></tbody></table>

2.  修改站点配置文件

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br></pre></td><td class="code"><pre><span class="line"># Extensions</span><br><span class="line">plugins:</span><br><span class="line">- hexo-generator-sitemap</span><br><span class="line">- hexo-generator-baidu-sitemap</span><br><span class="line">baidusitemap:</span><br><span class="line">    path: baidusitemap.xml</span><br></pre></td></tr></tbody></table>

同理，使用以下命令后，你可以在站点的/public目录下找到一个baidusitemap.xml文件。

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line">hexo clean</span><br><span class="line">hexo g</span><br></pre></td></tr></tbody></table>

3.  将baidusitemap.xml提交给百度

[百度搜索引擎提交入口](http://www.sousuoyinqingtijiao.com/baidu/tijiao/)

使用**hexo d**命令将博客部署到github后,这里填写**github上的baidusitemap.xml**地址即可。

![](assets/uploads/2026/05/hexo博客搭建以及next美化教程-e8d13fc-05.png)

## [¶](#参考文章)参考文章

[参考文章1](http://www.jianshu.com/p/f054333ac9e6) [参考文章2](https://neveryu.github.io/2016/09/30/hexo-next-two/) [参考文章3](https://thief.one/2017/03/03/Hexo%E6%90%AD%E5%BB%BA%E5%8D%9A%E5%AE%A2%E6%95%99%E7%A8%8B/)
