---
title: "MarkDown的用法学习笔记"
date: 2018-10-06T13:12:16+08:00
updated: 2018-11-16T13:12:16+08:00
author: "兰州小红鸡"
tags:
  - "前端"
summary: "标题 一级标题 ¶二级标题 ¶三级标题 ¶四级标题 ¶五级标题 ¶六级标题 列表 无序列表用 \\ 1. 有序列表用 1. 2. 3. 引用 只需要在文本前加入 这种尖括号（大于号）…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/93e22221.html
---

# 标题


```sql
# 一级标题
## 二级标题
### 三级标题
#### 四级标题
##### 五级标题
###### 六级标题
```


# 一级标题

## [¶](#二级标题)二级标题

### [¶](#三级标题)三级标题

#### [¶](#四级标题)四级标题

##### [¶](#五级标题)五级标题

###### [¶](#六级标题)六级标题

# 列表

-   无序列表用 \*

1.  有序列表用 1. 2. 3.

# 引用

只需要在文本前加入 > 这种尖括号（大于号）即可  
`> 例如这样`

> 例如这样

当然也可以多个嵌套使用

> > > `> > > 这样子`

# 图片与链接

图片为:`![文本](链接)`  
链接为：`[文本](链接)`

### [¶](#插入链接)插入链接

[baidu](http://baidu.com)

### [¶](#插入图片)插入图片

![naidu](https://picture-1256429518.cos.ap-chengdu.myqcloud.com/blog/18112101.png)

# 插入带链接的图片

> 像这样 `[![text]("image url" "title")](your link)`

[![shili](assets/uploads/2026/05/MarkDown的用法学习笔记-93e22221-02.png)](https://me.idealli.com)

# 粗体与斜体

用个 `**` 包含一段文本就是粗体的语法，用一个 `*` 包含一段文本就是斜体的语法。

`>例如 **我是粗体** ,我不是粗体,*我是斜体*`

> 例如 **我是粗体** ,我不是粗体,_我是斜体_

# 表格

Markdown 比较累人的地方，例子如下：


```sql
| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      |   $12 |
| zebra stripes | are neat      |    $1 |
```


这种语法生成的表格如下：

| Tables | Are | Cool |
| --- | --- | --- |
| col 3 is | right-aligned | $1600 |
| col 2 is | centered | $12 |
| zebra stripes | are neat | $1 |

# 代码框

只需要用 \`\`\` 把中间的代码包裹起来  
例如

\`\`\`c++  
int main()  
{  
printf(“hello world!”);  
return 0;  
}  
\`\`\`


```sql
int main()
{
	printf("hello world!");
	return 0;
}
```


# 分割线

用`***`表示

* * *

今天的学习就到这里，告辞

# 2018-11-27更新

> 自己修改了些博客样式表，添加了一些自定义样式，做个记录避免忘记

### [¶](#tip或者danger提示)tip或者danger提示

tip提示块使用`<P class="tip"></P>`

比如这样，这是一条tip提示

note提示块使用`<P class="note"></P>`

比如这样，这是一条note提示

warn提示块使用`<P class="warn"></P>`

比如这样，这是一条warn提示

### [¶](#demo块)demo块

使用`<div class="demo"></div>`

\### demo块使用:
