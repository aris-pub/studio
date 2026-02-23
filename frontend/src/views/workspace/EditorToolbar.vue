<script setup>
  import { inject, toRaw, useTemplateRef } from "vue";
  import { useScrollShadows } from "@/composables/useScrollShadows.js";
  import {
    insertBold,
    insertItalic,
    insertHeading,
    insertCitation,
    insertMathInline,
    insertMathBlock,
    insertItemize,
    insertEnumerate,
    insertFigure,
    insertTable,
    insertCodeInline,
    insertCodeBlock,
    insertComment,
    insertCrossRef,
    insertUrl,
    insertAuthor,
    insertAbstract,
    insertToc,
    insertAppendix,
    insertReferences,
    insertBibEntry,
    insertTheorem,
    insertProposition,
    insertLemma,
    insertCorollary,
    insertProblem,
    insertExercise,
    insertProof,
    insertProofStep,
    insertSubproof,
    insertAssume,
    insertCase,
    insertClaim,
    insertDefine,
    insertLet,
    insertNew,
    insertPick,
    insertProve,
    insertSuchThat,
    insertSuffices,
    insertSuppose,
    insertThen,
    insertWlog,
    insertWrite,
  } from "@/composables/useRSMCommands.js";

  const props = defineProps({
    mini: { type: Boolean, default: false },
  });

  const cmView = inject("cmView", null);
  const { scrollElementRef: toolbarRef, showLeftShadow, showRightShadow } = useScrollShadows();

  // Template refs for tooltip anchors
  const btnHeadingRef = useTemplateRef("btn-heading");
  const btnBoldRef = useTemplateRef("btn-bold");
  const btnItalicRef = useTemplateRef("btn-italic");
  const btnMathBlockRef = useTemplateRef("btn-math-block");
  const btnMathInlineRef = useTemplateRef("btn-math-inline");

  function exec(command) {
    const view = cmView?.value;
    if (!view) return;
    command(toRaw(view));
    toRaw(view).focus();
  }
</script>

<template>
  <div class="toolbar-container">
    <div ref="toolbarRef" class="toolbar">
      <span ref="btn-heading">
        <Button kind="tertiary" size="sm" icon="Heading" @click="exec(insertHeading)" />
      </span>
      <Tooltip :anchor="btnHeadingRef" content="Heading (⌘⇧H)" />

      <span ref="btn-bold">
        <Button kind="tertiary" size="sm" icon="Bold" @click="exec(insertBold)" />
      </span>
      <Tooltip :anchor="btnBoldRef" content="Bold (⌘B)" />

      <span ref="btn-italic">
        <Button kind="tertiary" size="sm" icon="Italic" @click="exec(insertItalic)" />
      </span>
      <Tooltip :anchor="btnItalicRef" content="Italic (⌘I)" />

      <template v-if="!mini">
        <span ref="btn-math-block">
          <Button kind="tertiary" size="sm" icon="LayoutRows" @click="exec(insertMathBlock)" />
        </span>
        <Tooltip :anchor="btnMathBlockRef" content="Math Block (⌘⇧M)" />

        <span ref="btn-math-inline">
          <Button kind="tertiary" size="sm" icon="LayoutGrid" @click="exec(insertMathInline)" />
        </span>
        <Tooltip :anchor="btnMathInlineRef" content="Math Inline (⌘M)" />
      </template>

      <HSeparator />

      <ContextMenu variant="slot" placement="bottom-start">
        <template #trigger="{ toggle, isOpen }">
          <ButtonToggle :model-value="isOpen" text="Insert" @click="toggle" />
        </template>
        <template v-if="mini">
          <ContextMenuItem caption="Block Tag" icon="LayoutRows" @click="exec(insertMathBlock)" />
          <ContextMenuItem caption="Inline Tag" icon="LayoutGrid" @click="exec(insertMathInline)" />
        </template>
        <ContextMenuItem caption="List" icon="List" @click="exec(insertItemize)" />
        <ContextMenuItem
          caption="Numbered List"
          icon="ListNumbers"
          @click="exec(insertEnumerate)"
        />
        <ContextMenuItem caption="Figure" icon="Photo" @click="exec(insertFigure)" />
        <ContextMenuItem caption="Table" icon="Table" @click="exec(insertTable)" />
        <ContextMenuItem
          caption="Code Inline"
          icon="Code"
          shortcut="⌘E"
          @click="exec(insertCodeInline)"
        />
        <ContextMenuItem caption="Code Block" icon="SourceCode" @click="exec(insertCodeBlock)" />
        <ContextMenuItem
          caption="Comment"
          icon="SquareRoundedPercentage"
          shortcut="⌘/"
          @click="exec(insertComment)"
        />
        <Separator />
        <ContextMenuItem
          caption="Cross-Reference"
          icon="FileSymlink"
          @click="exec(insertCrossRef)"
        />
        <ContextMenuItem
          caption="Citation"
          icon="Quote"
          shortcut="⌘⇧C"
          @click="exec(insertCitation)"
        />
        <ContextMenuItem caption="URL" icon="Link" shortcut="⌘K" @click="exec(insertUrl)" />
      </ContextMenu>

      <ContextMenu v-if="!mini" variant="slot" placement="bottom-start">
        <template #trigger="{ toggle, isOpen }">
          <ButtonToggle :model-value="isOpen" text="Sections" @click="toggle" />
        </template>
        <ContextMenuItem caption="Author" icon="UserEdit" @click="exec(insertAuthor)" />
        <ContextMenuItem caption="Abstract" icon="FileDescription" @click="exec(insertAbstract)" />
        <ContextMenuItem caption="Table of Contents" icon="ListDetails" @click="exec(insertToc)" />
        <ContextMenuItem caption="Appendix" icon="SectionSign" @click="exec(insertAppendix)" />
        <ContextMenuItem caption="References" icon="SectionSign" @click="exec(insertReferences)" />
        <ContextMenuItem caption="Bib Entry" icon="Book2" @click="exec(insertBibEntry)" />
      </ContextMenu>

      <ContextMenu variant="slot" placement="bottom-start" menu-class="math-panel">
        <template #trigger="{ toggle, isOpen }">
          <ButtonToggle :model-value="isOpen" text="Math" @click="toggle" />
        </template>
        <ContextMenuItem
          caption="Math Block"
          icon="LayoutRows"
          shortcut="⌘⇧M"
          @click="exec(insertMathBlock)"
        />
        <ContextMenuItem
          caption="Math Inline"
          icon="LayoutGrid"
          shortcut="⌘M"
          @click="exec(insertMathInline)"
        />
        <Separator />
        <div class="panel-header">Environments</div>
        <div class="panel-grid">
          <ContextMenuItem caption="Theorem" icon="" @click="exec(insertTheorem)" />
          <ContextMenuItem caption="Proposition" icon="" @click="exec(insertProposition)" />
          <ContextMenuItem caption="Lemma" icon="" @click="exec(insertLemma)" />
          <ContextMenuItem caption="Corollary" icon="" @click="exec(insertCorollary)" />
          <ContextMenuItem caption="Problem" icon="" @click="exec(insertProblem)" />
          <ContextMenuItem caption="Exercise" icon="" @click="exec(insertExercise)" />
        </div>
        <Separator />
        <div class="panel-header">Proofs</div>
        <div class="panel-grid">
          <ContextMenuItem caption="Proof" icon="" @click="exec(insertProof)" />
          <ContextMenuItem caption="Proof Step" icon="" @click="exec(insertProofStep)" />
          <ContextMenuItem caption="Subproof" icon="" @click="exec(insertSubproof)" />
        </div>
        <Separator />
        <div class="panel-header">Constructs</div>
        <div class="panel-grid constructs">
          <ContextMenuItem caption="Assumption" icon="" @click="exec(insertAssume)" />
          <ContextMenuItem caption="Case" icon="" @click="exec(insertCase)" />
          <ContextMenuItem caption="Claim" icon="" @click="exec(insertClaim)" />
          <ContextMenuItem caption="Definition" icon="" @click="exec(insertDefine)" />
          <ContextMenuItem caption="Let" icon="" @click="exec(insertLet)" />
          <ContextMenuItem caption="New" icon="" @click="exec(insertNew)" />
          <ContextMenuItem caption="Pick" icon="" @click="exec(insertPick)" />
          <ContextMenuItem caption="Prove" icon="" @click="exec(insertProve)" />
          <ContextMenuItem caption="Such That" icon="" @click="exec(insertSuchThat)" />
          <ContextMenuItem caption="Suffices" icon="" @click="exec(insertSuffices)" />
          <ContextMenuItem caption="Suppose" icon="" @click="exec(insertSuppose)" />
          <ContextMenuItem caption="Then" icon="" @click="exec(insertThen)" />
          <ContextMenuItem caption="WLOG" icon="" @click="exec(insertWlog)" />
          <ContextMenuItem caption="Write" icon="" @click="exec(insertWrite)" />
        </div>
      </ContextMenu>
    </div>

    <div class="shadow-overlay shadow-left" :class="{ active: showLeftShadow }"></div>
    <div class="shadow-overlay shadow-right" :class="{ active: showRightShadow }"></div>
  </div>
</template>

<style scoped>
  .toolbar-container {
    position: relative;
    flex: 0;
    min-height: var(--toolbar-height);
    max-height: calc(var(--toolbar-height) * 2 + 8px);
    border-radius: 0 8px 0 0;
    background-color: var(--surface-hover);
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    justify-content: flex-start;
    min-height: var(--toolbar-height);
    max-height: calc(var(--toolbar-height) * 2 + 8px);
    padding: 4px;
    gap: 2px;
    flex-wrap: nowrap;
    overflow-x: auto;
    white-space: nowrap;
    -ms-overflow-style: none;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  .toolbar .h-sep {
    margin: 4px;
    height: 24px;
  }

  .toolbar > span > button.tertiary,
  .toolbar > button.tertiary,
  .toolbar > .cm-wrapper > :deep(button.cm-btn) {
    height: 32px;
  }

  .toolbar > span > :deep(button:has(> .btn-text)),
  .toolbar > :deep(button:has(> .btn-text)) {
    padding-inline: 0px !important;
    width: 32px !important;
  }

  .toolbar > span > button > :deep(.btn-text),
  .toolbar > button > :deep(.btn-text) {
    margin: 0 auto;
    font-family: "Source Code Pro", monospace !important;
    font-size: 16px;
  }

  .toolbar > span {
    display: flex;
    align-items: center;
  }

  .toolbar > .cm-wrapper > :deep(.cm-btn) {
    padding-inline: 6px;
    font-size: 16px;
    font-weight: var(--weight-regular);
    font-family: "Source Sans 3", sans-serif;
    text-transform: none;
  }

  .toolbar > .cm-wrapper {
    align-content: center;
  }

  .toolbar > .cm-wrapper :deep(> button) {
    color: var(--extra-dark);
  }

  .cm-menu {
    max-height: 400px;
    overflow-y: auto;
  }

  .panel-header {
    padding: 4px 10px 2px;
    font-size: 11px;
    font-weight: var(--weight-semi);
    color: var(--gray-600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .panel-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .panel-grid.constructs {
    grid-template-columns: 1fr 1fr 1fr;
  }

  .constructs :deep(.cmi-caption) {
    font-family: "Source Code Pro", monospace;
    text-transform: lowercase;
    font-size: 14px;
  }
</style>
