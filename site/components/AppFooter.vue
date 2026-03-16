<template>
  <footer class="footer">
    <div class="container">
      <div class="footer-links">
        <a href="/contact">Contact</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/legal">Legal (Impressum)</a>
      </div>
      <div class="footer-copyright">
        © 2026 RSM Studio. Part of
        <a href="https://aris.pub" target="_blank" rel="noopener noreferrer">The Aris Program</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .footer {
    padding: 2rem 0;
    background: var(--surface-secondary);
    border-top: var(--border-thin) solid var(--border-primary);
    position: relative;
  }

  .footer::before {
    content: "";
    position: absolute;
    top: -1.5px;
    left: 50%;
    transform: translateX(-50%);
    width: 240px;
    height: 3px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--secondary-300) 25%,
      var(--primary-300) 75%,
      transparent 100%
    );
    z-index: 10;
  }

  .footer-links {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-bottom: 1rem;
  }

  .footer-links a {
    font-family: "Source Sans 3", sans-serif;
    color: var(--text-body);
    text-decoration: none;
    transition: color 0.2s;
    font-weight: var(--weight-medium);
  }

  .footer-links a:hover {
    color: var(--primary-600);
  }

  .footer-copyright {
    text-align: center;
    font-family: "Source Sans 3", sans-serif;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .footer-copyright a {
    color: var(--primary-600);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .footer-copyright a:hover {
    color: var(--primary-600);
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .footer-links {
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }
  }
</style>
