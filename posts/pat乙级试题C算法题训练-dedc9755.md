---
title: "pat乙级试题，C++算法题训练"
date: 2018-04-23T14:58:12+08:00
updated: 2018-05-14T16:33:24+08:00
author: "兰州小红鸡"
tags:
  - "算法"
  - C++
  - pat
summary: "$1 素数 $1 题目描述 令Pi表示第i个素数。现任给两个正整数M <= N <= 10000，请输出PM到PN的所有素数。 $1 输入描述: 输入在一行中给出M和N，其间以空格…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/dedc9755.html
  categories: C/C++
---

### [¶](#素数)**素数**

### [¶](#题目描述)**题目描述**

令Pi表示第i个素数。现任给两个正整数M <= N <= 10000，请输出PM到PN的所有素数。

### [¶](#输入描述)**输入描述:**

输入在一行中给出M和N，其间以空格分隔。

### [¶](#输出描述)**输出描述:**

输出从PM到PN的所有素数，每10个数字占1行，其间以空格分隔，但行末不得有多余空格。

**代码**

> #include #include<math.h> using namespace std;
> 
> class prime { int pri; public: void set\_pri(int i) {pri=i;} int get\_p() { int i; for(i=1;i<=sqrt(pri);i++) { if(pri%i==0&&i!=pri&&i!=1)return pri; } return 0; } }; int main() { prime a; int i,j=0,m,n; cin>>m>>n; for(i=2;i<=1000000;i++) { a.set\_pri(i); if(a.get\_p()==0) { j++; if(m<=j&&j<n&&(j-m+1)%10!=0)cout<<i<<" "; if(m<=j&&j<n&&(j-m+1)%10==0)cout<<i<<endl; if(j==n&&j!=m)cout<<i; if(j==m&&j==n)cout<<i; } if(j>n)break; } }

### [¶](#反转链表-25)反转链表 (25)

时间限制 2000 ms内存限制 150400 KB代码长度限制 100 KB判断程序

### [¶](#题目描述-v2)**题目描述**

给定一个常数K以及一个单链表L，请编写程序将L中每K个结点反转。例如：给定L为1→2→3→4→5→6，K为3，则输出应该为

3→2→1→6→5→4；如果K为4，则输出应该为4→3→2→1→5→6，即最后不到K个元素不反转。

**输入描述:**

每个输入包含1个测试用例。每个测试用例第1行给出第1个结点的地址、结点总个数正整数N(<= 105)、以及正整数K(<=N)，即要求反转的

子链结点的个数。结点的地址是5位非负整数，NULL地址用-1表示。

接下来有N行，每行格式为：

Address Data Next

其中Address是结点地址，Data是该结点保存的整数数据，Next是下一结点的地址。

**输出描述:**

对每个测试用例，顺序输出反转后的链表，其上每个结点占一行，格式与输入相同。

**输入例子:**

00100 6 4

00000 4 99999

00100 1 12309

68237 6 -1

33218 3 00000

99999 5 68237

12309 2 33218

**输出例子:**

00000 4 33218

33218 3 12309

12309 2 00100

00100 1 99999

99999 5 68237

68237 6 -1

代码如下

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br><span class="line">14</span><br><span class="line">15</span><br><span class="line">16</span><br><span class="line">17</span><br><span class="line">18</span><br><span class="line">19</span><br><span class="line">20</span><br><span class="line">21</span><br><span class="line">22</span><br><span class="line">23</span><br><span class="line">24</span><br></pre></td><td class="code"><pre><span class="line"><span class="meta">#<span class="meta-keyword">include</span> <span class="meta-string">&lt;iostream&gt;</span></span></span><br><span class="line"><span class="meta">#<span class="meta-keyword">include</span> <span class="meta-string">&lt;algorithm&gt;</span></span></span><br><span class="line"><span class="keyword">using</span> <span class="keyword">namespace</span> <span class="built_in">std</span>;</span><br><span class="line"><span class="function"><span class="keyword">int</span> <span class="title">main</span><span class="params">()</span></span></span><br><span class="line"><span class="function"></span>{</span><br><span class="line"> <span class="keyword">int</span> first,n,k,temp,sum=<span class="number">0</span>;</span><br><span class="line"> <span class="built_in">cin</span>&gt;&gt;first&gt;&gt;n&gt;&gt;k;</span><br><span class="line"> <span class="keyword">int</span> lis[<span class="number">100001</span>],data[<span class="number">100001</span>],next[<span class="number">100001</span>];   <span class="comment">//程序关键在于将数组下标作为节点地址</span></span><br><span class="line"> <span class="keyword">for</span>(<span class="keyword">int</span> i=<span class="number">0</span>;i&lt;n;i++) </span><br><span class="line"> { </span><br><span class="line"> 	<span class="built_in">cin</span>&gt;&gt;temp; </span><br><span class="line"> 	<span class="built_in">cin</span>&gt;&gt;data[temp]&gt;&gt;next[temp]; </span><br><span class="line"> }</span><br><span class="line"> <span class="keyword">while</span>(first!=<span class="number">-1</span>) </span><br><span class="line"> { </span><br><span class="line"> 	lis[sum++]=first;</span><br><span class="line">    first=next[first]; </span><br><span class="line"> }</span><br><span class="line"> <span class="keyword">for</span>(<span class="keyword">int</span> i=<span class="number">0</span>;i &lt;(sum - sum % k);i=i+k)</span><br><span class="line"> reverse(begin(lis) + i, begin(lis) + i + k);</span><br><span class="line"> <span class="keyword">for</span>(<span class="keyword">int</span> i=<span class="number">0</span>;i&lt;sum<span class="number">-1</span>;i++)</span><br><span class="line"> <span class="built_in">printf</span>(<span class="string">"%05d %d %05d\n"</span>, lis[i], data[lis[i]], lis[i + <span class="number">1</span>]);</span><br><span class="line"> <span class="built_in">printf</span>(<span class="string">"%05d %d -1"</span>, lis[sum - <span class="number">1</span>], data[lis[sum - <span class="number">1</span>]]);</span><br><span class="line">}</span><br></pre></td></tr></tbody></table>

**有几个PAT（25）**

时间限制 1000 ms内存限制 32768 KB代码长度限制 100 KB判断程序

### [¶](#题目描述-v3)**题目描述**

字符串APPAPT中包含了两个单词“PAT”，其中第一个PAT是第2位§,第4位(A),第6位(T)；第二个PAT是第3位§,第4位(A),第6位(T)。

现给定字符串，问一共可以形成多少个PAT？

### [¶](#输入描述-v2)**输入描述:**

输入只有一行，包含一个字符串，长度不超过105，只包含P、A、T三种字母。

### [¶](#输出描述-v2)**输出描述:**

在一行中输出给定字符串中包含多少个PAT。由于结果可能比较大，只输出对1000000007取余数的结果。

### [¶](#输入例子)**输入例子:**

APPAPT

### [¶](#输出例子)**输出例子:**

2

这题我本以为挺简单，用三个循环就可以完成了  
后来用三个循环来做，对于短的字符串确实可以，但是对于长的字符创  
比如长度为105，那么循环的次数会超大，所以直接段错误  
后来看了大佬的算法，才发现原来可以这样

代码：

<table><tbody><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br><span class="line">3</span><br><span class="line">4</span><br><span class="line">5</span><br><span class="line">6</span><br><span class="line">7</span><br><span class="line">8</span><br><span class="line">9</span><br><span class="line">10</span><br><span class="line">11</span><br><span class="line">12</span><br><span class="line">13</span><br></pre></td><td class="code"><pre><span class="line"><span class="meta">#<span class="meta-keyword">include</span> <span class="meta-string">&lt;iostream&gt;</span></span></span><br><span class="line"><span class="keyword">using</span> <span class="keyword">namespace</span> <span class="built_in">std</span>;</span><br><span class="line"><span class="function"><span class="keyword">int</span> <span class="title">main</span><span class="params">()</span> </span>{</span><br><span class="line"> <span class="keyword">char</span> data[<span class="number">100001</span>];</span><br><span class="line"> <span class="keyword">long</span> <span class="keyword">int</span> a=<span class="number">0</span>,b=<span class="number">0</span>,c=<span class="number">0</span>;</span><br><span class="line"> <span class="built_in">cin</span>&gt;&gt;data;</span><br><span class="line"> <span class="keyword">for</span>(<span class="keyword">int</span> i=<span class="number">0</span>;data[i]!=<span class="string">'\0'</span>;i++){</span><br><span class="line"> <span class="keyword">if</span>(data[i]==<span class="string">'P'</span>)a++;</span><br><span class="line"> <span class="keyword">if</span>(data[i]==<span class="string">'A'</span>)b+=a;</span><br><span class="line"> <span class="keyword">if</span>(data[i]==<span class="string">'T'</span>)c+=b;</span><br><span class="line"> }</span><br><span class="line"> cou**t&lt;&lt;c%<span class="number">1000000007</span>;</span><br><span class="line">}</span><br></pre></td></tr></tbody></table>
