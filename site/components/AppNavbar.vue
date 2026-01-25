<template>
  <nav class="navbar">
    <a href="/" class="nav-brand">
      <img src="/brand/studio-logo-64.svg" alt="RSM Studio Logo" class="nav-logo" />
      <div class="nav-text">
        <span class="nav-rsm">RSM</span>
        <span class="nav-studio">Studio</span>
      </div>
    </a>

    <div class="nav-links">
      <a href="/#what-is-rsm" class="nav-link">What is RSM</a>
      <a href="/#studio-features" class="nav-link">Features</a>
      <a href="/#faq" class="nav-link">FAQ</a>
    </div>

    <div class="nav-actions">
      <DarkModeToggle />
      <a href="/#signup" class="nav-cta-button">Join the waitlist</a>
    </div>

    <button class="nav-hamburger" :aria-expanded="mobileMenuOpen" @click="toggleMobileMenu">
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    </button>

    <div class="nav-mobile" :class="{ 'nav-mobile-open': mobileMenuOpen }">
      <a href="/#what-is-rsm" class="nav-link" @click="closeMobileMenu">What is RSM</a>
      <a href="/#studio-features" class="nav-link" @click="closeMobileMenu">Features</a>
      <a href="/#faq" class="nav-link" @click="closeMobileMenu">FAQ</a>
      <div class="nav-mobile-toggle">
        <DarkModeToggle />
      </div>
      <a href="/#signup" class="nav-cta-button" @click="closeMobileMenu">Join the waitlist</a>
    </div>
  </nav>
</template>

<script setup>
  import { ref } from "vue";

  const mobileMenuOpen = ref(false);

  const toggleMobileMenu = () => {
    mobileMenuOpen.value = !mobileMenuOpen.value;
  };

  const closeMobileMenu = () => {
    mobileMenuOpen.value = false;
  };
</script>

<style scoped>
  /* Navigation */
  .navbar {
    position: fixed;
    top: 0;
    width: 100%;
    background: var(--surface-page);
    border-bottom: var(--border-thin) solid var(--border-primary);
    z-index: 1000;
    backdrop-filter: blur(10px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 3rem;
    height: 4rem;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 0.05em;
    font-size: 1.25rem;
    font-weight: var(--weight-semi);
    color: var(--primary-900);
    text-decoration: none;
    letter-spacing: 0.02em;
  }

  .nav-logo {
    width: calc(1.25rem * 0.95);
    height: calc(1.25rem * 0.95);
  }

  .nav-text {
    display: flex;
    gap: 0.15rem;
  }

  .nav-rsm {
    font-family: "Montserrat", sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: var(--weight-bold);
  }

  .nav-studio {
    font-family: Georgia, serif;
    font-weight: var(--weight-regular);
    letter-spacing: -0.02em;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 3rem;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .nav-mobile {
    display: none;
  }

  .nav-link {
    font-family: "Source Sans 3", sans-serif;
    font-weight: var(--weight-medium);
    font-size: 0.95rem;
    color: var(--text-body);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .nav-link:hover {
    color: var(--primary-600);
  }

  .nav-cta-button {
    padding: 0.4rem 1.2rem;
    background: var(--surface-action);
    color: var(--primary-50);
    border: var(--border-thin) solid var(--surface-action);
    border-radius: 12px;
    font-family: "Source Sans 3", sans-serif;
    font-weight: var(--weight-semi);
    font-size: 0.9rem;
    text-decoration: none;
    transition: var(--transition-bg-color), var(--transition-bd-color);
  }

  .nav-cta-button:hover {
    background: var(--surface-action-hover);
    border-color: var(--surface-action-hover);
  }

  .nav-hamburger {
    display: none;
    flex-direction: column;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
  }

  .hamburger-line {
    width: 25px;
    height: 3px;
    background: var(--text-body);
    margin: 3px 0;
    transition: 0.3s;
    border-radius: 2px;
  }

  /* Mobile Responsiveness */
  @media (max-width: 768px) {
    .navbar {
      padding: 0 1rem;
    }

    .nav-links,
    .nav-actions {
      display: none;
    }

    .nav-mobile {
      display: none;
      position: fixed;
      top: 4rem;
      left: 0;
      width: 100%;
      background: var(--surface-page);
      flex-direction: column;
      align-items: center;
      padding: 2rem;
      gap: 2rem;
      border-bottom: var(--border-thin) solid var(--border-primary);
    }

    .nav-mobile.nav-mobile-open {
      display: flex;
    }

    .nav-mobile .nav-link {
      font-size: 1.5rem;
      font-weight: var(--weight-semi);
      text-align: center;
    }

    .nav-mobile .nav-cta-button {
      font-size: 1.25rem;
      padding: 1rem 2rem;
    }

    .nav-mobile-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 0;
    }

    .nav-hamburger {
      display: flex;
    }

    .nav-hamburger[aria-expanded="true"] .hamburger-line:nth-child(1) {
      transform: rotate(-45deg) translate(-5px, 6px);
    }

    .nav-hamburger[aria-expanded="true"] .hamburger-line:nth-child(2) {
      opacity: 0;
    }

    .nav-hamburger[aria-expanded="true"] .hamburger-line:nth-child(3) {
      transform: rotate(45deg) translate(-5px, -6px);
    }
  }
</style>
