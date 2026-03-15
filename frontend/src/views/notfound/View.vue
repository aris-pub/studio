<script setup></script>

<template>
  <div class="view">
    <div class="brand">
      <RouterLink to="/">
        <Logo type="full" />
      </RouterLink>
    </div>
    <div class="header">
      <h1 class="text-h1">404</h1>
      <h2 class="text-h2">Page not found</h2>
    </div>
    <div class="content">
      <p class="text-default">
        The research you're looking for isn't here—or maybe never was.
        <br />
        Let's get you back to the good stuff.
      </p>
    </div>
    <div class="footer">
      <Button kind="primary" class="cta">
        <RouterLink to="/">Go back home</RouterLink>
      </Button>
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

  .brand {
    margin-bottom: 32px;
  }

  .brand a {
    text-decoration: none;
    color: inherit;
  }

  .view > * {
    margin-bottom: 16px;
  }

  .cta > a {
    color: var(--almost-white);
    text-decoration: none;
  }
</style>
