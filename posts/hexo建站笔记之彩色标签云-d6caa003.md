---
title: "hexo建站笔记之彩色标签云"
date: 2018-11-07T20:08:34+08:00
updated: 2018-11-07T20:08:34+08:00
author: "兰州小红鸡"
tags:
  - "教程"
  - "前端"
  - javascript
  - "博客"
summary: "方法比较简单，加个js脚本就好了，至于加载哪里都无所谓了，就放在标签云的页面。 就加在标签的那个页面好了。 1. 打开themes\\\\next\\\\layout\\\\page.swig…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/d6caa003.html
  categories: "教程"
---

方法比较简单，加个js脚本就好了，至于加载哪里都无所谓了，就放在标签云的页面。  
就加在标签的那个页面好了。

1.  打开themes\\next\\layout\\page.swig
2.  找到

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br></pre></td><td class="code"><pre><span class="line">{% if page.type === "tags" %}</span><br></pre></td></tr></tbody></table>

3.  将下面这段代码

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br></pre></td><td class="code"><pre><span class="line">&lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud"</span>&gt;</span><br><span class="line"></span><br><span class="line">   &lt;!-- &lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud-title"</span>&gt;</span><br><span class="line">       {{ _p(<span class="string">'counter.tag_cloud'</span>, site.tags.length) }}</span><br><span class="line">   &lt;/div&gt; --&gt;</span><br><span class="line">   &lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud-tags"</span> id=<span class="string">"tags"</span>&gt;</span><br><span class="line">     {{ tagcloud({min_font: <span class="number">16</span>, max_font: <span class="number">16</span>, amount: <span class="number">300</span>, color: <span class="keyword">true</span>, start_color: <span class="string">'#fff'</span>, end_color: <span class="string">'#fff'</span>}) }}</span><br><span class="line">   &lt;/div&gt;</span><br><span class="line"> &lt;/div&gt;</span><br></pre></td></tr></tbody></table>

换成这段代码

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br><span class="line">25</span><br><span class="line">26</span><br><span class="line">27</span><br><span class="line">28</span><br><span class="line">29</span><br><span class="line">30</span><br><span class="line">31</span><br><span class="line">32</span><br><span class="line">33</span><br><span class="line">34</span><br><span class="line">35</span><br><span class="line">36</span><br><span class="line">37</span><br><span class="line">38</span><br><span class="line">39</span><br><span class="line">40</span><br><span class="line">41</span><br><span class="line">42</span><br><span class="line">43</span><br><span class="line">44</span><br><span class="line">45</span><br><span class="line">46</span><br><span class="line">47</span><br><span class="line">48</span><br><span class="line">49</span><br><span class="line">50</span><br><span class="line">51</span><br><span class="line">52</span><br><span class="line">53</span><br></pre></td><td class="code"><pre><span class="line">&lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud"</span>&gt;</span><br><span class="line">  &lt;!-- &lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud-title"</span>&gt;</span><br><span class="line">      {{ _p(<span class="string">'counter.tag_cloud'</span>, site.tags.length) }}</span><br><span class="line">  &lt;/div&gt; --&gt;</span><br><span class="line">  &lt;div <span class="class"><span class="keyword">class</span></span>=<span class="string">"tag-cloud-tags"</span> id=<span class="string">"tags"</span>&gt;</span><br><span class="line">    {{ tagcloud({min_font: <span class="number">16</span>, max_font: <span class="number">16</span>, amount: <span class="number">300</span>, color: <span class="keyword">true</span>, start_color: <span class="string">'#fff'</span>, end_color: <span class="string">'#fff'</span>}) }}</span><br><span class="line">  &lt;/div&gt;</span><br><span class="line">&lt;/div&gt;</span><br><span class="line">&lt;br&gt;</span><br><span class="line"></span><br><span class="line">&lt;script type=<span class="string">"text/javascript"</span>&gt;</span><br><span class="line">   var alltags=document.getElementById(<span class="string">'tags'</span>);</span><br><span class="line">   var tags=alltags.getElementsByTagName(<span class="string">'a'</span>);</span><br><span class="line"></span><br><span class="line">   <span class="keyword">for</span> (var i = tags.length - <span class="number">1</span>; i &gt;= <span class="number">0</span>; i--) {</span><br><span class="line">     var r=Math.floor(Math.random()*<span class="number">75</span>+<span class="number">130</span>);</span><br><span class="line">     var g=Math.floor(Math.random()*<span class="number">75</span>+<span class="number">100</span>);</span><br><span class="line">     var b=Math.floor(Math.random()*<span class="number">75</span>+<span class="number">80</span>);</span><br><span class="line">     tags[i].style.background = <span class="string">"rgb("</span>+r+<span class="string">","</span>+g+<span class="string">","</span>+b+<span class="string">")"</span>;</span><br><span class="line">   }</span><br><span class="line">&lt;/script&gt;</span><br><span class="line"></span><br><span class="line">&lt;style type=<span class="string">"text/css"</span>&gt;</span><br><span class="line">    div#posts.posts-expand .tag-cloud a{</span><br><span class="line">   background-color: #f5f7f1;</span><br><span class="line">   border-radius: <span class="number">6</span>px;</span><br><span class="line">   padding-left: <span class="number">10</span>px;</span><br><span class="line">   padding-right: <span class="number">10</span>px;</span><br><span class="line">   margin-top: <span class="number">18</span>px;</span><br><span class="line"></span><br><span class="line"> }</span><br><span class="line"></span><br><span class="line"> .tag-cloud a{</span><br><span class="line">   background-color: #f5f7f1;</span><br><span class="line">   border-radius: <span class="number">4</span>px;</span><br><span class="line">   padding-right: <span class="number">5</span>px;</span><br><span class="line">   padding-left: <span class="number">5</span>px;</span><br><span class="line">   margin-right: <span class="number">5</span>px;</span><br><span class="line">   margin-left: <span class="number">0</span>px;</span><br><span class="line">   margin-top: <span class="number">8</span>px;</span><br><span class="line">   margin-bottom: <span class="number">0</span>px;</span><br><span class="line"></span><br><span class="line"> }</span><br><span class="line"></span><br><span class="line"> .tag-cloud a:before{</span><br><span class="line">      content: <span class="string">"📜"</span>;</span><br><span class="line"> }</span><br><span class="line"></span><br><span class="line"> .tag-cloud-tags{</span><br><span class="line">   text-align: left;</span><br><span class="line">   counter-reset: tags;</span><br><span class="line"> }</span><br><span class="line">&lt;/style&gt;</span><br></pre></td></tr></tbody></table>

然后就好啦！  
可能需要清理缓存

1.  hexo clean
2.  hexo d -g

**下面是展示**

标签云放在主页

![兰州小红鸡](assets/uploads/2026/05/hexo建站笔记之彩色标签云-d6caa003-01.png)

标签云页面

![兰州小红鸡](assets/uploads/2026/05/hexo建站笔记之彩色标签云-d6caa003-02.png)
