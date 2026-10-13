<script setup lang="ts">
import { basics, chapterLink, chapters, stages } from '../../data/course.ts'
</script>

<template>
  <div class="course-map">
    <section class="course-stage">
      <div class="stage-heading">
        <span class="eyebrow">预备 1—5</span><h2>先在本机看见</h2><p>从网页启停和界面读数开始，知道请求者、服务、地址、端口各是什么。</p><a href="/basics">准备说明与实验包 →</a>
      </div>
      <ol class="chapter-list">
        <li v-for="(lesson, index) in basics" :key="lesson.route">
          <a :href="lesson.route"><span class="chapter-number">预备 {{ index + 1 }}</span><span><strong>{{ lesson.title.split(' · ')[1] }}</strong><small>{{ lesson.goal }}</small></span><span class="chapter-arrow" aria-hidden="true">↗</span></a>
        </li>
      </ol>
    </section>
    <section v-for="stage in stages" :key="stage.title" class="course-stage">
      <div class="stage-heading">
        <span class="eyebrow">{{ stage.range }}</span><h2>{{ stage.title }}</h2><p>{{ stage.goal }}</p>
      </div>
      <ol :start="stage.start + 1" class="chapter-list">
        <li v-for="[slug, title, description] in chapters.slice(stage.start, stage.end)" :key="slug">
          <a :href="chapterLink(slug)"><span class="chapter-number">{{ slug.slice(0, 2) }}</span><span><strong>{{ title }}</strong><small>{{ description }}</small></span><span class="chapter-arrow" aria-hidden="true">↗</span></a>
        </li>
      </ol>
    </section>
  </div>
</template>
