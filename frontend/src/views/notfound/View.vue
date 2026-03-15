<script setup>
  import { useRouter } from "vue-router";

  const router = useRouter();
</script>

<template>
  <div class="view">
    <div class="header">
      <h1 class="text-h1">404</h1>
      <h2 class="text-h2">Page not found</h2>
    </div>
    <div class="content">
      <p class="text-default">
        The research you’re looking for isn’t here—or maybe never was.
        <br />
        Let’s get you back to the good stuff.
      </p>
    </div>
    <div class="footer">
      <Button kind="primary" text="Go back home" @click="router.push('/')" />
    </div>
  </div>
</template>

<style scoped>
  .view {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--surface-primary);
    color: var(--extra-dark);
    padding: 32px;
    text-align: center;
  }

  .view > * {
    margin-bottom: 16px;
  }
</style>
