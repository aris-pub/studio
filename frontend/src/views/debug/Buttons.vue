<script setup>
  import { reactive } from "vue";
  import Button from "@/components/base/Button.vue";
  import ButtonToggle from "@/components/base/ButtonToggle.vue";
  import Icon from "@/components/base/Icon.vue";

  const toggleStates = reactive({
    a: false,
    b: true,
    c: false,
    d: true,
    e: false,
    f: true,
    g: false,
    h: true,
    i: false,
    j: true,
    k: false,
    l: true,
    m: true,
    n: false,
    o: true,
  });

  const kinds = ["primary", "secondary", "tertiary", "danger", "danger-ghost"];
  const sizes = ["xs", "sm", "md", "lg"];
</script>

<template>
  <div class="debug-buttons">
    <h1>Button Component Debug</h1>

    <!-- ── Button: All kinds × text-only ── -->
    <section>
      <h2>Button — Text Only</h2>
      <template v-for="size in sizes" :key="size">
        <div class="row">
          <span class="label">{{ size }}</span>
          <Button v-for="kind in kinds" :key="kind" :kind="kind" :size="size" text="Save Changes" />
        </div>
        <div class="row sub">
          <span class="label">disabled</span>
          <Button
            v-for="kind in kinds"
            :key="`${kind}-dis`"
            :kind="kind"
            :size="size"
            text="Save Changes"
            disabled
          />
        </div>
      </template>
    </section>

    <!-- ── Button: All kinds × icon + text ── -->
    <section>
      <h2>Button — Icon + Text</h2>
      <template v-for="size in sizes" :key="size">
        <div class="row">
          <span class="label">{{ size }}</span>
          <Button
            v-for="kind in kinds"
            :key="kind"
            :kind="kind"
            :size="size"
            icon="Plus"
            text="Add Item"
          />
        </div>
        <div class="row sub">
          <span class="label">disabled</span>
          <Button
            v-for="kind in kinds"
            :key="`${kind}-dis`"
            :kind="kind"
            :size="size"
            icon="Plus"
            text="Add Item"
            disabled
          />
        </div>
      </template>
    </section>

    <!-- ── Button: All kinds × icon only ── -->
    <section>
      <h2>Button — Icon Only</h2>
      <template v-for="size in sizes" :key="size">
        <div class="row">
          <span class="label">{{ size }}</span>
          <Button v-for="kind in kinds" :key="kind" :kind="kind" :size="size" icon="Settings" />
        </div>
        <div class="row sub">
          <span class="label">disabled</span>
          <Button
            v-for="kind in kinds"
            :key="`${kind}-dis`"
            :kind="kind"
            :size="size"
            icon="Settings"
            disabled
          />
        </div>
      </template>
    </section>

    <!-- ── Button: text-float ── -->
    <section>
      <h2>Button — Text Float (hover to see label)</h2>
      <template v-for="size in sizes" :key="size">
        <div class="row">
          <span class="label">{{ size }}</span>
          <Button
            v-for="kind in kinds"
            :key="kind"
            :kind="kind"
            :size="size"
            icon="Settings"
            text="Settings"
            text-float="bottom"
          />
        </div>
      </template>
    </section>

    <!-- ── Real-world combos ── -->
    <section>
      <h2>Real-World Combos</h2>
      <div class="row">
        <span class="label">Account</span>
        <Button kind="tertiary" text="Cancel" />
        <Button kind="secondary" text="Update Password" />
      </div>
      <div class="row">
        <span class="label">Modal</span>
        <Button kind="secondary" text="Cancel" />
        <Button kind="danger" text="Delete" />
      </div>
      <div class="row">
        <span class="label">Form</span>
        <Button kind="tertiary" text="Discard" />
        <Button kind="primary" icon="Check" text="Save Changes" />
      </div>
      <div class="row">
        <span class="label">Shadow</span>
        <Button kind="secondary" text="With Shadow" shadow />
        <Button kind="tertiary" text="With Shadow" shadow />
      </div>
    </section>

    <h1 style="margin-top: 48px">ButtonToggle Debug</h1>

    <!-- ── Toggle: text-only ── -->
    <section>
      <h2>Toggle — Text Only</h2>
      <div v-for="(size, idx) in sizes" :key="size" class="row">
        <span class="label">{{ size }}</span>
        <ButtonToggle v-model="toggleStates[['a', 'b', 'c'][idx]]" :size="size" text="Output" />
        <ButtonToggle v-model="toggleStates[['d', 'e', 'f'][idx]]" :size="size" text="Source" />
      </div>
    </section>

    <!-- ── Toggle: icon + text ── -->
    <section>
      <h2>Toggle — Icon + Text</h2>
      <div v-for="(size, idx) in sizes" :key="size" class="row">
        <span class="label">{{ size }}</span>
        <ButtonToggle
          v-model="toggleStates[['g', 'h', 'i'][idx]]"
          :size="size"
          icon="Filter"
          text="Filter"
        />
        <ButtonToggle
          v-model="toggleStates[['j', 'k', 'l'][idx]]"
          :size="size"
          icon="Eye"
          text="Preview"
        />
      </div>
    </section>

    <!-- ── Toggle: icon only ── -->
    <section>
      <h2>Toggle — Icon Only</h2>
      <div class="row">
        <span class="label">sm</span>
        <ButtonToggle v-model="toggleStates.m" size="sm" icon="Bold" />
        <ButtonToggle v-model="toggleStates.n" size="sm" icon="Italic" />
      </div>
    </section>

    <!-- ── Toggle: search tab group ── -->
    <section>
      <h2>Toggle — Tab Group (Search Bar)</h2>
      <div class="row tab-group">
        <span class="label">sm</span>
        <div class="tabs">
          <ButtonToggle v-model="toggleStates.o" size="sm" text="Output" />
          <ButtonToggle v-model="toggleStates.n" size="sm" text="Source" />
          <ButtonToggle v-model="toggleStates.m" size="sm" text="Marginalia" />
        </div>
      </div>
    </section>

    <!-- ── Toggle: disabled ── -->
    <section>
      <h2>Toggle — Disabled</h2>
      <div class="row">
        <span class="label">inactive</span>
        <ButtonToggle :model-value="false" text="Disabled" disabled />
        <ButtonToggle :model-value="false" icon="Filter" text="Disabled" disabled />
        <ButtonToggle :model-value="false" icon="Bold" disabled />
      </div>
      <div class="row">
        <span class="label">active</span>
        <ButtonToggle :model-value="true" text="Disabled" disabled />
        <ButtonToggle :model-value="true" icon="Filter" text="Disabled" disabled />
        <ButtonToggle :model-value="true" icon="Bold" disabled />
      </div>
    </section>

    <!-- ── Toggle: color variants ── -->
    <section>
      <h2>Toggle — Active Colors</h2>
      <div class="row">
        <span class="label">blue</span>
        <ButtonToggle :model-value="true" text="Active" active-color="blue" />
        <ButtonToggle :model-value="false" text="Inactive" active-color="blue" />
      </div>
      <div class="row">
        <span class="label">green</span>
        <ButtonToggle :model-value="true" text="Active" active-color="green" />
        <ButtonToggle :model-value="false" text="Inactive" active-color="green" />
      </div>
      <div class="row">
        <span class="label">purple</span>
        <ButtonToggle :model-value="true" text="Active" active-color="purple" />
        <ButtonToggle :model-value="false" text="Inactive" active-color="purple" />
      </div>
    </section>
  </div>
</template>

<style scoped>
  .debug-buttons {
    max-width: 800px;
    margin: 40px auto;
    padding: 24px;
    font-family: system-ui, sans-serif;
  }

  h1 {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 24px;
    color: var(--almost-black, #13181b);
  }

  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--gray-500, #8d9da8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }

  section {
    margin-bottom: 32px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--gray-100, #edf0f2);
  }

  .label {
    width: 64px;
    font-size: 12px;
    font-weight: 500;
    color: var(--gray-500, #8d9da8);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .row.sub {
    border-bottom-style: dashed;
  }

  .row.sub .label {
    font-size: 10px;
    color: var(--gray-400, #a3b1bb);
  }

  .separator {
    width: 1px;
    height: 24px;
    background: var(--gray-300, #c2ccd3);
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 4px;
  }
</style>
