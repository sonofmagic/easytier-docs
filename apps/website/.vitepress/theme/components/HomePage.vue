<script setup lang="ts">
import CourseMap from './CourseMap.vue'
</script>

<template>
  <main class="learning-home">
    <section class="home-hero">
      <div class="hero-copy">
        <p class="eyebrow">
          从网络基础开始 · EasyTier v2.6.4
        </p>
        <h1>跟着一个数据包，<br><span>看懂 EasyTier。</span></h1>
        <p class="hero-lead">
          两台电脑都能上网，为什么却不能互访？<br>从 IP、路由和 NAT 出发，一步步理解异地组网。
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/chapters/01-why">从第一章开始 <span aria-hidden="true">→</span></a><a class="secondary-link" href="/labs">先动手看三个实验</a>
        </div>
        <div class="hero-facts">
          <span>20 章完整教程</span><span>图解与带答案练习</span><span>无需先安装</span>
        </div>
      </div>
      <div class="hero-network">
        <p class="diagram-title">
          同一个业务包，两层网络。
        </p>
        <div class="network-row virtual-row">
          <div><b>A</b><code>10.144.144.1</code></div><div class="network-wire">
            <span>虚拟 IP · 业务 TCP</span><i />
          </div><div><b>B</b><code>10.144.144.2</code></div>
        </div>
        <div class="encapsulation">
          <span>↓ 封装到隧道</span><span>解封装 ↑</span>
        </div>
        <div class="network-row physical-row">
          <div><span class="node-outline">家庭网络 A</span></div><div class="network-wire">
            <span>互联网 · 外层传输</span><i />
          </div><div><span class="node-outline">家庭网络 B</span></div>
        </div>
        <div class="diagram-bottom">
          <span class="packet-symbol" aria-hidden="true">▤</span><p>虚拟地址指向业务目标。<br>外层端点负责把包送到另一边。</p>
        </div>
      </div>
    </section>
    <section class="home-intro">
      <p class="eyebrow">
        一条贯穿全书的主线
      </p><h2>A 想访问 B 的 8080 服务。</h2><p>我们始终使用同一组电脑和地址。从“为什么不通”出发，看到 EasyTier 改变了哪一步，再用模型和状态输出验证。每章只向前迈一步，新术语会当场解释。</p>
    </section>
    <CourseMap />
    <section class="home-ending">
      <div><h2>看懂之后，试着解释出来。</h2><p>改变 NAT 过滤条件，切断一条链路，追踪一次回程。比起记住名词，知道原因更有用。</p></div><a class="primary-link" href="/labs">进入交互实验 →</a>
    </section>
    <footer class="home-footer">
      独立学习资料，非 EasyTier 官方网站。实现说明固定依据 v2.6.4；模型边界与资料来源见各章。
    </footer>
  </main>
</template>
