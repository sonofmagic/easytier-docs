<script setup lang="ts">
import CourseMap from './CourseMap.vue'
</script>

<template>
  <main class="learning-home">
    <section class="home-hero">
      <div class="hero-copy">
        <p class="eyebrow">
          零基础起步 · 界面观察与少量命令
        </p>
        <h1>先在自己的电脑上，<br><span>看见一次网络请求。</span></h1>
        <p class="hero-lead">
          打开一个由自己电脑提供的网页，看它怎样回应、怎样失败。<br>再一步步理解：EasyTier 如何把请求送到另一台电脑。
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/basics/browser-and-programs">从本机预备课开始 <span aria-hidden="true">→</span></a><a class="secondary-link" href="/chapters/01-why">直接进入第一章</a>
        </div>
        <div class="hero-facts">
          <span>5 节预备课 + 20 章</span><span>真实本机实验</span><span>EasyTier v2.6.4</span>
        </div>
      </div>
      <div class="hero-network">
        <p class="diagram-title">
          第一站：同一台电脑里的两个程序
        </p>
        <div class="network-row virtual-row">
          <div><b>浏览器</b><small>提出请求</small></div><div class="network-wire">
            <span>请给我网页</span><i />
          </div><div><b>服务</b><small>提供网页</small></div>
        </div>
        <div class="encapsulation">
          <span>看地址栏</span><span>看终端记录</span>
        </div>
        <div class="network-row physical-row">
          <div><span class="node-outline">显示网页内容</span></div><div class="network-wire reply-wire">
            <span>把内容送回来</span><i />
          </div><div><span class="node-outline">读取演示文件</span></div>
        </div>
        <div class="diagram-bottom">
          <span class="packet-symbol" aria-hidden="true">▤</span><p>先在本机认识地址、端口和服务。<br>再把服务放到另一台电脑，理解异地连接。</p>
        </div>
      </div>
    </section>
    <section class="home-intro">
      <p class="eyebrow">
        从眼前的现象，到异地组网
      </p><h2>本机网页 → 同一网络 → 异地网络 → EasyTier</h2><p>预备课先把程序、网址和请求变成实际窗口里的现象。正文再跟着 A 访问 B 的网页，逐章解释路径和失败原因。必要的新词当场解释，计算与协议细节可以稍后选读。</p>
    </section>
    <CourseMap />
    <section class="home-ending">
      <div><h2>电脑里已经运行 EasyTier？</h2><p>对照现有 GUI 的地址和路径，再看一次真实 ICMP 往返能证明什么。基础还不熟时，先完成上面的预备课。</p></div><a class="primary-link" href="/cases/local-gui">读真实 GUI 案例 →</a>
    </section>
    <footer class="home-footer">
      独立学习资料，非 EasyTier 官方网站。实现说明固定依据 v2.6.4；模型边界与资料来源见各章。
    </footer>
  </main>
</template>
