<template>
  <div v-if="password" class="password-strength">
    <div class="strength-bar">
      <div
        class="strength-fill"
        :class="strengthClass"
        :style="{ width: strengthPercentage + '%' }"
      ></div>
    </div>
    <div class="strength-text" :class="strengthClass">
      {{ strengthText }}
    </div>
    <div v-if="suggestions.length > 0" class="strength-suggestions">
      <ul>
        <li v-for="suggestion in suggestions" :key="suggestion">{{ suggestion }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
  import { computed } from "vue";

  const props = defineProps({
    password: { type: String, required: true },
  });

  const strengthScore = computed(() => {
    const password = props.password;
    if (!password) return 0;

    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Bonus for longer passwords
    if (password.length >= 16) score += 1;

    return Math.min(score, 5);
  });

  const strengthPercentage = computed(() => {
    return (strengthScore.value / 5) * 100;
  });

  const strengthClass = computed(() => {
    if (strengthScore.value <= 1) return "weak";
    if (strengthScore.value <= 3) return "medium";
    return "strong";
  });

  const strengthText = computed(() => {
    if (strengthScore.value <= 1) return "Weak";
    if (strengthScore.value <= 3) return "Medium";
    return "Strong";
  });

  const suggestions = computed(() => {
    const password = props.password;
    if (!password) return [];

    const suggestions = [];

    if (password.length < 8) {
      suggestions.push("Use at least 8 characters");
    }
    if (!/[a-z]/.test(password)) {
      suggestions.push("Add lowercase letters");
    }
    if (!/[A-Z]/.test(password)) {
      suggestions.push("Add uppercase letters");
    }
    if (!/[0-9]/.test(password)) {
      suggestions.push("Add numbers");
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      suggestions.push("Add special characters");
    }

    return suggestions;
  });
</script>

<style scoped>
  .password-strength {
    margin-top: 8px;
  }

  .strength-bar {
    width: 100%;
    height: 4px;
    background-color: var(--gray-200);
    border-radius: 2px;
    overflow: hidden;
  }

  .strength-fill {
    height: 100%;
    transition:
      width 0.3s ease,
      background-color 0.3s ease;
    border-radius: 2px;
  }

  .strength-fill.weak {
    background-color: var(--error-500);
  }

  .strength-fill.medium {
    background-color: var(--warning-500);
  }

  .strength-fill.strong {
    background-color: var(--success-500);
  }

  .strength-text {
    font-size: 12px;
    font-weight: var(--weight-medium);
    margin-top: 4px;
  }

  .strength-text.weak {
    color: var(--error-600);
  }

  .strength-text.medium {
    color: var(--warning-600);
  }

  .strength-text.strong {
    color: var(--success-600);
  }

  .strength-suggestions {
    margin-top: 8px;
  }

  .strength-suggestions ul {
    margin: 0;
    padding-left: 16px;
    list-style-type: disc;
  }

  .strength-suggestions li {
    font-size: 12px;
    color: var(--text-disabled);
    margin-bottom: 2px;
  }

  .strength-suggestions li:last-child {
    margin-bottom: 0;
  }
</style>
