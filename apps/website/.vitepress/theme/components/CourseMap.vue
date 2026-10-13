<script setup lang="ts">
import { chapterLink, chapters, stages } from '../../data/course.ts'
</script>

<template>
  <div class="course-map">
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
