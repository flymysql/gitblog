---
title: "windows上的vim配置，打造超级舒心又有逼格的编辑器"
date: 2018-06-21T09:03:49+08:00
updated: 2018-06-21T09:03:49+08:00
author: "兰州小红鸡"
tags:
  - "教程"
  - "前端"
summary: "之前用的是spf13的方案 不过自己也删删减减了好多 就修改成比较适合自己的 其中vim scripts是vim的一些基本插件，包括语法高亮的支持、缩进等等。 当然我也可以使用其他…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/1a3fd97.html
  categories: C/C++
---

之前用的是spf13的方案 不过自己也删删减减了好多 就修改成比较适合自己的 其中vim-scripts是vim的一些基本插件，包括语法高亮的支持、缩进等等。 当然我也可以使用其他的安装命令 sudo apt-get install vim sudo apt-get install vim-gtk 等等，其实本质都是相同的，只是安装的包多包少的问题 其他Linux发行版用户亦可使用自家的包管理器进行安装vim，这里我们就不多说了，我们下面讲下源码安装vim的过程

源码安装vim

## [¶](#more)

* * *

### [¶](#下载源码包)下载源码包

到[ftp://ftp.vim.org/pub/vim/unix/](ftp://ftp.vim.org/pub/vim/unix/)下载最新的vim包，当前我下载时最新版是vim-7.4

### [¶](#解压缩源码包)解压缩源码包

解压至 ~/downloads/vim74/

```
tar -xjvf vim-7.4.tar.bz2
```

### [¶](#编译安装)编译安装

进入解压缩的源码目录

```
cd ~/downloads/vim74/
```

设置Vim源码的编译属性

```
./configure --with-features=huge --enable-rubyinterp --enable-pythoninterp --with-python-config-dir=/usr/lib/python2.7/config-i386-linux-gnu/ --enable-perlinterp --enable-gui=gtk2 --enable-cscope --enable-luainterp --enable-perlinterp --enable-multibyte --prefix=/usr
```

其中参数说明如下：

```cpp
–with-features=huge：支持最大特性 –enable-rubyinterp：启用Vim对ruby编写的插件的支持 –enable-pythoninterp：启用Vim对python编写的插件的支持 –enable-luainterp：启用Vim对lua编写的插件的支持 –enable-perlinterp：启用Vim对perl编写的插件的支持 –enable-multibyte：多字节支持 可以在Vim中输入中文 –enable-cscope：Vim对cscope支持 –enable-gui=gtk2：gtk2支持,也可以使用gnome，表示生成gvim –with-python-config-dir=/usr/lib/python2.7/config-i386-linux-gnu/ 指定 python 路径 –prefix=/usr：编译安装路径 需要重新配置时，可以输入 make distclean #清理一下上一次编译生成的所有文件，这些其实都是GNU Make的命令我们就不细讲了
```

```
sudo make VIMRUNTIMEDIR=/usr/share/vim/vim74

sudo make install
```

```cpp

" CUSTOMIZE SETTINGS
====================

"set wrap " 自动折行

" macOS: brew tap caskroom/fonts && brew cask install font-hack-nerd-font "set guifont=Knack:h18

let g:indent guides auto_colors = 1 "colorscheme wombat "颜色方案

set termencoding=utf-8 autocmd VimEnter * NERDTree set encoding=utf-8 " 编码设置 set fileencodings=utf-8,ucs-bom,shift-jis,gb18030,gbk,gb2312,cp936,utf-16,big5,euc-jp,latin1 set langmenu=zn CN.UTF-8 set helplang=cn " 语言设置 "inoremap <expr><CR> neosnippet#expandable() ? neosnippet#mappings#expand or jump impl() : pumvisible() ? neocomplete#close popup() : "\<CR>" nnoremap <F6> :TagbarToggle<CR> let g:tagbar autoclose=1 filetyp on

"let g:tagbar ctags bin='/usr/bin/ctags' let g:tagbar width=27 "let g:tagbar left=1

set guiheadroom=0 let g:indent guides enable on vim_startup = 0

autocmd BufReadPost *.cpp,*.c,*.h,*.hpp,*.cc,*.cxx call tagbar#autoopen() let g:ycm server python interpreter='/usr/bin/python' let g:ycm global ycm extra conf='~/.vim/.ycm extra conf.py' let g:completor python_binary = '/path/to/python/with/jedi/installed'

wincmd w autocmd VimEnter * wincmd w

"更改配置后立即生效 autocmd BufWritePost $MYVIMRC source $MYVIMRC

"解决菜单乱码

source $VIMRUNTIME/delmenu.vim source $VIMRUNTIME/menu.vim

imap kk <C-k> nmap 11 :bp<CR> nmap 22 :bn<CR> nmap qq :wq<CR>

set guioptions-=L " 隐藏左侧滚动条 set guioptions-=r " 隐藏右侧滚动条

"新建.c,.h,.sh,.java文件，自动插入文件头

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""" au GUIEnter * simalt ~x

"""""新文件标题""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

"新建.c,.h,.sh,.java文件，自动插入文件头

autocmd BufNewFile *.cpp,*.[ch],*.sh,*.java exec ":call SetTitle()"

""定义函数SetTitle，自动插入文件头

func SetTitle()

"如果文件类型为.sh文件

if &filetype == 'sh'

call setline(1,"\#########################################################################")

call append(line("."), "\# File Name: ".expand("%"))

call append(line(".")+1, "\# Author: 小金")

call append(line(".")+2, "\# mail: flyphp@outlook.com")

call append(line(".")+3, "\# Created Time: ".strftime("%c"))

call append(line(".")+4, "\#########################################################################")

call append(line(".")+5, "\#!/bin/bash")

call append(line(".")+6, "")

else

call setline(1, "/*************************************************************************")

call append(line("."), " > File Name: ".expand("%"))

call append(line(".")+1, " > Author: 小金")

call append(line(".")+2, " > Mail: flyphp@outlook.com ")

call append(line(".")+3, " > Created Time: ".strftime("%c"))

call append(line(".")+4, " ************************************************************************/")

call append(line(".")+5, "")

endif

if &filetype == 'cpp'

call append(line(".")+6, "#include <iostream>")

call append(line(".")+7, "using namespace std;")

call append(line(".")+8, "") call append(line(".")+9, "int main()") call append(line(".")+10, "{") call append(line(".")+11, " ") call append(line(".")+12, " return 0;") call append(line(".")+13, "}")

endif

if &filetype == 'c'

call append(line(".")+6, "#include <stdio.h>")

call append(line(".")+7, "#include <stdlib.h>")

call append(line(".")+8, "") call append(line(".")+9, "int main()") call append(line(".")+10, "{") call append(line(".")+11, " ") call append(line(".")+12, " return 0;") call append(line(".")+13, "}")

endif if &filetype == 'ch' call append(line(".")+6, "#ifndef ".expand("%"))

call append(line(".")+7, "#define ".expand("%"))

call append(line(".")+8, " ") call append(line(".")+9, " ") call append(line(".")+10, "#endif")

endif

"新建文件后，自动定位到文件末尾

autocmd BufNewFile * normal G

endfunc

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

"键盘命令

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

nmap <leader>w :w!<cr>

nmap <leader>f :find<cr>

" 映射全选+复制 ctrl+a

map <C-A> ggVGY

map! <C-A> <Esc>ggVGY

map <F12> gg=G

" 选中状态下 Ctrl+c 复制

vmap <C-c> "+y

"去空行

nnoremap <F2> :g/^\s*$/d<CR>

"比较文件

nnoremap <C-F2> :vert diffsplit

"新建标签

map <M-F2> :tabnew<CR>

"列出当前目录文件

map <F3> :tabnew .<CR>

"打开树状文件目录

map <C-F3> \be

"C，C++ 按F9编译运行

map <F9> :call CompileRunGcc()<CR>

func! CompileRunGcc()

exec "w"

if &filetype == 'c'

exec "!g++ % -o %<"

exec "! ./%<"

elseif &filetype == 'cpp'

exec "!g++ % -o %<"

exec "! ./%<"

elseif &filetype == 'java'

exec "!javac %"

exec "!java %<"

elseif &filetype == 'sh'

:!./%

endif

endfunc

"C,C++的调试

map <F8> :call Rungdb()<CR>

func! Rungdb()

exec "w"

exec "!g++ % -g -o %<"

exec "!gdb ./%<"

endfunc

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

""实用设置

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" 设置当文件被改动时自动载入

set autoread

" quickfix模式

autocmd FileType c,cpp map <buffer> <leader><space> :w<cr>:make<cr>

"代码补全

set completeopt=preview,menu

"允许插件

filetype plugin on

"共享剪贴板

set clipboard+=unnamed

"从不备份

set nobackup

"make 运行

:set makeprg=g++\ -Wall\ \ %

"自动保存

set autowrite

set ruler " 打开状态栏标尺

set cursorline " 突出显示当前行

set magic " 设置魔术

set guioptions-=T " 隐藏工具栏

set guioptions-=m " 隐藏菜单栏

"set statusline=\ %<%F[%1*%M%*%n%R%H]%=\ %y\ %0(%{&fileformat}\ %{&encoding}\ %c:%l/%L%)\

" 设置在状态行显示的信息

set foldcolumn=0

set foldmethod=indent

set foldlevel=3

set foldenable " 开始折叠

" 不要使用vi的键盘模式，而是vim自己的

set nocompatible

" 语法高亮

"set syntax on set term=ansi syntax on

" 去掉输入错误的提示声音

set noeb

" 在处理未保存或只读文件的时候，弹出确认

set confirm

" 自动缩进

set autoindent

set cindent

" Tab键的宽度

set tabstop=4

" 统一缩进为4

set softtabstop=4

set shiftwidth=4

" 不要用空格代替制表符

set noexpandtab

" 在行和段开始处使用制表符

set smarttab

" 显示行号

set number

" 历史记录数

set history=1000

"禁止生成临时文件

set nobackup

set noswapfile

"搜索忽略大小写

set ignorecase

"搜索逐字符高亮

set hlsearch

set incsearch

"行内替换

set gdefault

"编码设置

set enc=utf-8

set fencs=utf-8,ucs-bom,shift-jis,gb18030,gbk,gb2312,cp936

"语言设置

set langmenu=zh_CN.UTF-8

set helplang=cn

" 我的状态行显示的内容（包括文件类型和解码）

"set statusline=%F%m%r%h%w\ [FORMAT=%{&ff}]\ [TYPE=%Y]\ [POS=%l,%v][%p%%]\ %{strftime(\"%d/%m/%y\ -\ %H:%M\")}

"set statusline=[%F]%y%r%m%*%=[Line:%l/%L,Column:%c][%p%%]

" 总是显示状态行

set laststatus=2

" 命令行（在状态行下）的高度，默认为1，这里是2

set cmdheight=2

" 侦测文件类型

filetype on

" 载入文件类型插件

filetype plugin on

set nospell

" 为特定文件类型载入相关缩进文件

filetype indent on

" 保存全局变量

set viminfo+=!

" 带有如下符号的单词不要被换行分割

set iskeyword+=_,$,@,%,#,-

" 字符间插入的像素行数目

set linespace=0

" 增强模式中的命令行自动完成操作

set wildmenu

" 使回格键（backspace）正常处理indent, eol, start等

set backspace=2

" 允许backspace和光标键跨越行边界

set whichwrap+=<,>,h,l

" 可以在buffer的任何地方使用鼠标（类似office中在工作区双击鼠标定位）

set mouse=a

set selection=exclusive

set selectmode=mouse,key

" 通过使用: commands命令，告诉我们文件的哪一行被改变过

set report=0

" 在被分割的窗口间显示空白，便于阅读

set fillchars=vert:\ ,stl:\ ,stlnc:\

" 高亮显示匹配的括号

set showmatch

" 匹配括号高亮的时间（单位是十分之一秒）

set matchtime=1

" 光标移动到buffer的顶部和底部时保持3行距离

set scrolloff=3

" 为C程序提供自动缩进

set smartindent

" 高亮显示普通txt文件（需要txt.vim脚本）

au BufRead,BufNewFile * setfiletype txt

"自动补全

:inoremap ( ()<ESC>i

:inoremap ) <c-r>=ClosePair(')')<CR>

:inoremap { {<CR>}<ESC>O

:inoremap } <c-r>=ClosePair('}')<CR>

:inoremap [ []<ESC>i

:inoremap ] <c-r>=ClosePair(']')<CR>

:inoremap " ""<ESC>i

:inoremap ' ''<ESC>i

function! ClosePair(char)

if getline('.')[col('.') - 1] == a:char

return "\<Right>"

else

return a:char

endif

endfunction

filetype plugin indent on

"打开文件类型检测, 加了这句才可以用智能补全

set completeopt=longest,menu

" 判断当前系统类型是Windows还是Linux " return OS type, eg: windows, or linux, mac, et.st.. function! MySys( )

if has("win16") || has("win32") || has("win64") || has("win95")

return "windows"

elseif has("unix")

return "linux"

endif

endfunction

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" CTags的设定

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

let Tlist Sort Type = "name" " 按照名称排序

let Tlist Use Right_Window = 1 " 在左侧显示窗口

let Tlist Compart Format = 1 " 压缩方式

let Tlist Exist OnlyWindow = 1 " 如果只有一个buffer，kill窗口也kill掉buffer

let Tlist File Fold Auto Close = 0 " 不要关闭其他文件的tags

let Tlist Enable Fold_Column = 0 " 不要显示折叠树

autocmd FileType java set tags+=D:\tools\java\tags

"autocmd FileType h,cpp,cc,c set tags+=D:\tools\cpp\tags

"let Tlist Show One_File=1 "不同时显示多个文件的tag，只显示当前文件的

"设置tags

set tags=tags

"set autochdir

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

"其他东东

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" minibufexpl插件的一般设置

let g:miniBufExplMapWindowNavVim = 1

let g:miniBufExplMapWindowNavArrows = 1

let g:miniBufExplMapCTabSwitchBufs = 1 let g:miniBufExplModSelTarget = 1

"----------------------------------------------------------------- " plugin - bufexplorer.vim Buffers切换 " \be 全屏方式查看全部打开的文件列表 " \bv 左右方式查看 \bs 上下方式查看 "-----------------------------------------------------------------

"----------------------------------------------------------------- " plugin - taglist.vim 查看函数列表，需要ctags程序 " F4 打开隐藏taglist窗口 "----------------------------------------------------------------- if MySys() == "windows" " 设定windows系统中ctags程序的位置 let Tlist Ctags Cmd = '"'.$VIMRUNTIME.'/ctags.exe"' elseif MySys() == "linux" " 设定windows系统中ctags程序的位置 let Tlist Ctags Cmd = '/usr/bin/ctags' endif nnoremap <silent><F4> :TlistToggle<CR>

nnoremap k j nnoremap j h

"默认打开Taglist let Tlist Auto Open=1

let Tlist Show One File = 1 " 不同时显示多个文件的tag，只显示当前文件的 let Tlist Exit OnlyWindow = 1 " 如果taglist窗口是最后一个窗口，则退出vim let Tlist Use Right Window = 0 " 在左侧窗口中显示taglist窗口 let Tlist File Fold Auto Close=1 " 自动折叠当前非编辑文件的方法列表

let Tlist Auto Update = 1

let Tlist Hightlight Tag On BufEnter = 1 let Tlist Enable Fold Column = 0 let Tlist Process File Always = 1 let Tlist Display Prototype = 0 let Tlist Compact Format = 1

"----------------------------------------------------------------- " plugin - mark.vim 给各种tags标记不同的颜色，便于观看调式的插件。 " \m mark or unmark the word under (or before) the cursor " \r manually input a regular expression. 用于搜索. " \n clear this mark (i.e. the mark under the cursor), or clear all highlighted marks . " \* 当前MarkWord的下一个 \# 当前MarkWord的上一个 " \/ 所有MarkWords的下一个 \? 所有MarkWords的上一个 "-----------------------------------------------------------------

"----------------------------------------------------------------- " plugin - NERD tree.vim 以树状方式浏览系统中的文件和目录 " :ERDtree 打开NERD tree :NERDtreeClose 关闭NERD_tree " o 打开关闭文件或者目录 t 在标签页中打开 " T 在后台标签页中打开 ! 执行此文件 " p 到上层目录 P 到根目录 " K 到第一个节点 J 到最后一个节点 " u 打开上层目录 m 显示文件系统菜单（添加、删除、移动操作） " r 递归刷新当前目录 R 递归刷新当前根目录 "----------------------------------------------------------------- " F3 NERDTree 切换 map <F3> :NERDTreeToggle<CR> imap <F3> <ESC>:NERDTreeToggle<CR>

let NERDTreeWinSize=22 "----------------------------------------------------------------- " plugin - NERD_commenter.vim 注释代码用的， " [count],cc 光标以下count行逐行添加注释(7,cc) " [count],cu 光标以下count行逐行取消注释(7,cu) " [count],cm 光标以下count行尝试添加块注释(7,cm) " ,cA 在行尾插入 /* */,并且进入插入模式。 这个命令方便写注释。 " 注：count参数可选，无则默认为选中行或当前行 "----------------------------------------------------------------- let NERDSpaceDelims=1 " 让注释符与语句之间留一个空格 let NERDCompactSexyComs=1 " 多行注释时样子更好看

"----------------------------------------------------------------- " plugin - DoxygenToolkit.vim 由注释生成文档，并且能够快速生成函数标准注释 "----------------------------------------------------------------- let g:DoxygenToolkit authorName="Asins - asinsimple AT gmail DOT com" let g:DoxygenToolkit briefTag_funcName="yes" map <leader>da :DoxAuthor<CR> map <leader>df :Dox<CR> map <leader>db :DoxBlock<CR> map <leader>dc a /* */<LEFT><LEFT><LEFT>

"----------------------------------------------------------------- " plugin – ZenCoding.vim 很酷的插件，HTML代码生成 " 插件最新版：http://github.com/mattn/zencoding-vim " 常用命令可看：http://nootn.com/blog/Tool/23/ "-----------------------------------------------------------------

"----------------------------------------------------------------- " plugin – checksyntax.vim JavaScript常见语法错误检查 " 默认快捷方式为 F5 "----------------------------------------------------------------- let g:checksyntax_auto = 0 " 不自动检查

"----------------------------------------------------------------- " plugin - NeoComplCache.vim 自动补全插件 "----------------------------------------------------------------- let g:AutoComplPop NotEnableAtStartup = 1 let g:NeoComplCache EnableAtStartup = 1 let g:NeoComplCache SmartCase = 1 let g:NeoComplCache TagsAutoUpdate = 1 let g:NeoComplCache EnableInfo = 1 let g:NeoComplCache EnableCamelCaseCompletion = 1 let g:NeoComplCache MinSyntaxLength = 3 let g:NeoComplCache EnableSkipCompletion = 1 let g:NeoComplCache SkipInputTime = '0.5' let g:NeoComplCache SnippetsDir = $VIMFILES.'/snippets' " <TAB> completion. inoremap <expr><TAB> pumvisible() ? "\<C-n>" : "\<TAB>" " snippets expand key imap <silent> <C-e> <Plug>(neocomplcache snippets expand) smap <silent> <C-e> <Plug>(neocomplcache snippets expand)
```
