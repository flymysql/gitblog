---
title: "使用vue.js制作carousel跑马灯组件"
date: 2018-12-02T15:53:59+08:00
updated: 2018-12-02T15:53:59+08:00
author: "兰州小红鸡"
tags:
  - 前端
  - vue.js
summary: "前几天在掘金上看到一个开源项目(PyUI)在招人，一个基于vue.js的UI库，想着反正页闲着，就硬着头皮加入了（其实我都还没学vue.js) 两天速成了一下，学了点皮毛，就开始撸…"
origin:
  from: hexo
  url: https://flymysql.github.io/post/456bc465.html
  categories: vue.js
---

前几天在掘金上看到一个开源项目(PyUI)在招人，一个基于vue.js的UI库，想着反正页闲着，就硬着头皮加入了（其实我都还没学vue.js)  
两天速成了一下，学了点皮毛，就开始撸代码了，组织给我分配的是carousel跑马灯的组件

> 边学边做，一天半撸完了，效果完全参照iview的跑马灯效果（任务要求）  
> 其实原本只要拿iview的代码过来改一改就好了，但是感觉这样页学不到什么，硬着头皮自己撸了

第一次写vue.js感觉在项目任务的督促下学的还是很快的

## [¶](#carousel组件构成)carousel组件构成

跑马灯的过渡效果主要用了`<transition>`组件  
我的主要思想是将`carousel`插槽内的代码块提取出来，用一个`<li>`列表放置在`<transition>`内，然后实现轮播效果

**html部分**


```sql
<template>
  <div :class="classes">
    <div class="py-carousel__slide-lists" ref="carousel_list">
      <slot></slot>
    </div>
    <button :class="arrowClasses" class="lefts" @click="change(currentIndex-1)">
    </button>
    <button :class="arrowClasses" class="rights" @click="change(currentIndex+1)">
    </button>
    <transition-group tag="div"  name="list" class="py-carousel__slide-current">
        <li v-for="(list,index) in slideList.length"
          class="py-carousel__slide-current-item"
          :key="index"
          v-show="index===currentIndex"
          @mouseenter="hover(1)"
          @mouseleave="hover(2)">
            <div v-html="slideList[index].outerHTML"></div>
        </li>
    </transition-group>
    <div :class="'py-carousel__positions-'+position" class="py-carousel__positions">
        <span v-for="(item,index) in slideList.length" :key="index"
        :class="positionClass(index)"
        @mouseover="hoverChange(index)"
        @mouseleave="hover(3)"
        @click="change(index)">
        </span>
    </div>
  </div>
</template>
```


### [¶](#js部分)js部分

我感觉相对于iview的代码，相同的效果我的代码量已经少了好多，当然可能人家的组件比较稳定吧，我的还没经过比较正规的测试

js部分主要就是一些函数鼠标对轮播图的操作，轮播函数是`autoplay()`和`go()`两个函数主要控制的


```sql

<script>
// 组件class前缀
const prefixCls = 'py-carousel';
const Props = {
  arrow: new Set(['hover', 'always', 'never']),
  position: new Set(['inside', 'outside', 'none', 'left', 'right']),
};

export default {
  name: 'py-carousel',
  props: {
    // 初始位置
    value: {
      type: Number,
      default: 0,
    },
    // 轮播速度
    speed: {
      type: Number,
      default: 3000,
    },
    // 初始自动轮播
    autoloop: {
      type: Boolean,
      default: true,
    },
    // 自动轮播
    loop: {
      type: Boolean,
      default: true,
    },
    // 鼠标移至界面时是否暂停
    hoverstop: {
      type: Boolean,
      default: true,
    },
    // 两侧箭头显示时机
    arrow: {
      type: String,
      default: 'hover',
      validator (value) {
        return Props.arrow.has(value);
      },
    },
    // 底部指示器位置
    position: {
      type: String,
      default: 'outside',
      validator (value) {
        return Props.position.has(value);
      },
    },
    // 圆形指示器
    radiusPosition: {
      type: Boolean,
      default: false,
    },
    // 指示器触发方式
    trigger: {
      type: Boolean,
      default: true,
    },
  },
  data () {
    return {
      slideList: [],
      currentIndex: 0,
      timer: '',
    };
  },
  computed: {
    classes() {
      return `${prefixCls}`;
    },
    arrowClasses () {
      return [
        `py-carousel__arrow`,
        `py-carousel__arrow-${this.arrow}`,
      ];
    },
  },
  methods: {
    go() {
      this.timer = setInterval(() => {
        this.autoPlay();
      }, this.speed);
    },
    stop() {
      clearInterval(this.timer);
      this.timer = null;
    },
    hover(n) {
      if (n === 1 && this.hoverstop) this.stop();
      if (n === 2 && this.hoverstop) this.go();
      if (n === 3 && this.trigger) this.go();
    },
    change(index) {
      index = (index + this.slideList.length) % this.slideList.length;
      this.currentIndex = index;
      this.stop();
    },
    hoverChange(index) {
      if (this.trigger) {
        this.change(index);
      }
    },
    autoPlay() {
      if (this.loop) {
        this.currentIndex += 1;
        if (this.currentIndex > this.slideList.length - 1) {
          this.currentIndex = 0;
        }
      }
    },
    positionClass(index) {
      const classs = [];
      if (index === this.currentIndex) classs.push(`active`);
      if (this.radiusPosition) classs.push(`radius`);
      return classs;
    },
  },
  created() {
    this.$nextTick(() => {
      this.slideList = this.$refs.carousel_list.children;
      this.currentIndex = this.value;
      if (this.autoloop) {
        this.timer = setInterval(() => {
          this.autoPlay();
        }, this.speed);
      }
    });
  },
};
</script>
```


相对来说，代码量挺少了哈

### [¶](#css部分)css部分

css部分有个小问题就是，当底部指示器的位置设置在外部时，我是从carousel的高度中拿出5%的高度作为底部指示器的空间，然后carousel的高度是向外自适应的，所以carousel1的父节点必须指定高度，而且要和内部轮播代码框的高度一致

**12月8日更新**修复了上诉问题

以下为scss代码


```sql
@charset "UTF-8";

@include b(carousel) {
  box-sizing: border-box;
  position:relative;
  height: 100%;
  width: 100%;
  display: block;
  -webkit-box-sizing: border-box;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -ms-touch-action: pan-y;
  touch-action: pan-y;

  @include e(slide) {

    @include e(slide-lists) {
      display: none;
    }

    @include e(slide-current) {
      position: relative;
      width: 100%;
      height: 100%;
      display: block;
      overflow: hidden;
      padding:0;
      margin: 0;
      li {
        position: absolute;
        width: 100%;
        height: 100%;
      }
    }

    @include e(slide-current-item) {
      list-style-type:none;
      width: 100%;
      height: 100%;
      margin:0;
      padding:0;
    }
  }

  @include e(arrow) {
    border: none;
    outline: none;
    padding: 0;
    margin: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    position: absolute;
    top: 50%;
    z-index: 10;
    transform: translateY(-50%);
    background-color: rgba(31, 45, 61, 0.11);
    text-align: center;
    color: aliceblue;
    font-size: 1em;
    font-family: inherit;
    line-height: inherit;
    &.rights {
      right: 16px;
    }
    &.lefts{
      left: 16px;
    }

    &.rights:before {
      content: ">";
    }
    &.lefts:before{
      content: "<";
    }

    @include e(arrow-hover) {
     display: inherit;
     opacity: 0;
    }

    @include e(arrow-always) {
      display: inherit;
    }
    @include e(arrow-never) {
      display: none;
    }

    &-hover > * {
      vertical-align: baseline;
    }

  }

  &:hover &__arrow-hover {
    opacity: 1;
  }

  @include e(positions) {
    display: block;
    z-index: 10;
    height: 16px;
    width: 100%;
    position: relative;
    text-align: center;

    @include e(positions-inside) {
      position: absolute;
      bottom: 8px;
      height: 12px;
    }

    @include e(positions-outside) {
      margin-top: 8px;
      width: 100%;
      position: relative;
    }

    @include e(positions-none) {
      display: none;
    }

    @include e(positions-left) {
      position: absolute;
      bottom: 8px;
      text-align: left;
      padding-left: 18px;
      height: 12px;
    }

    @include e(positions-right) {
      position: absolute;
      bottom: 8px;
      text-align: right;
      padding-right: 18px;
      height: 12px;
    }

    span {
      display: inline-block;
      vertical-align: top;
      text-align: center;
      margin: 0 2px;
      width: 20px;
      height: 3px;
      border-radius: 0;
      cursor: pointer;
      background-color:#898989;
      opacity: 0.5;
      font-size: 12px;
      &.active {
        width: 25px;
        background-color: rgb(82, 87, 74);
        opacity: 0.7;
      }
    }
    .radius {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1px solid #2b2b28;
      background: rgba(82, 87, 74, 0.1);
      &.active {
        width: 12px;
        background-color: #505042;
        opacity: 0.7;
      }
    }
  }

  .list-enter-to {
    transition: all 0.8s ease;
    transform: translateX(0);
  }

  .list-leave-active {
    transition: all 0.8s ease;
    transform: translateX(-100%)
  }

  .list-enter {
    transform: translateX(100%)
  }

  .list-leave {
    transform: translateX(0)
  }
}
```


放上GitHub地址  
[  
PyUi  
](https://github.com/flymysql/PyUI)
