<template>
  <div class="landing-page">
    <AppNavbar />

    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-brand">
          <img src="/studio-logo-64.svg" alt="RSM Studio Logo" class="hero-logo" />
          <div class="hero-text">
            <span class="brand-rsm">RSM</span>
            <span class="brand-studio">Studio</span>
          </div>
        </div>
        <h1 class="hero-title">Research manuscripts designed for pixels, not&nbsp;paper</h1>
        <p class="hero-subtitle">
          Manuscripts that adapt to any screen—with interactive figures and PDF export.
        </p>
        <a href="#signup" class="hero-cta-button">Get early access</a>
      </div>
    </section>

    <!-- What is RSM Section -->
    <section id="what-is-rsm" class="what-is-rsm-section">
      <div class="container">
        <h2 class="section-header">Introducing Readable Science Markup (RSM)</h2>
        <p class="section-subheader">
          A markup language designed for the web, not the printing press
        </p>

        <div class="rsm-intro">
          <p>
            RSM is built for how research is consumed today. While LaTeX was designed for print in
            the 1980s, RSM starts with the web—responsive layouts, interactive elements, and
            accessibility built in from day one.
          </p>
          <p>
            Your manuscripts live online, adapt to any screen size, and export to PDF when journals
            require it. The same source file works everywhere: shared with colleagues, read on
            phones, or submitted as a traditional PDF.
          </p>
        </div>

        <!-- Live RSM Demo -->
        <div class="rsm-demo-container">
          <div class="rsm-demo-panel rsm-source-panel">
            <div class="panel-header">RSM Source</div>
            <pre class="rsm-source-code" v-html="highlightedSource"></pre>
          </div>
          <div class="rsm-demo-panel rsm-output-panel">
            <div class="panel-header">Web Output</div>
            <div ref="renderedOutputRef" class="rsm-rendered-output" v-html="rsmExample.rendered"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Live Demo Section - DISABLED FOR NOW -->
    <!-- <section id="demo" class="demo-section">
      <div class="container">
        <h2 class="section-header">Introducing Readable Science Markup (RSM)</h2>
        <p class="section-subheader">Semantic markup that separates meaning from presentation</p>

        <div class="intro-content">
          <p>
            RSM is built for the post-PDF era. While other tools convert print formats to web, RSM is web-native from the ground up. Your manuscripts live on the web, adapt to any screen, and only export to PDF when journals demand it, not the other way around.
          </p>
        </div>

        <div class="philosophy-callout">
          <h3 class="philosophy-tagline">Minimal by default, powerful by choice</h3>
          <p>
            RSM completely separates your content from its presentation. Write semantic markup like <code>:claim:</code>, <code>:evidence:</code>, and <code>:method:</code> instead of formatting commands. Your content carries meaning. Themes handle presentation.
          </p>
          <p>
            When you're ready to work on styling, simply pick a theme and you're done. Or customize every detail. It's your choice, on your timeline.
          </p>
        </div>
        <div class="demo-controls">
          <div class="demo-tabs">
            <button
              :class="['tab-button', { active: activeTab === 'academic' }]"
              data-testid="tab-academic"
              @click="activeTab = 'academic'"
            >
              Academic-Grade Output
            </button>
            <button
              :class="['tab-button', { active: activeTab === 'interactive' }]"
              data-testid="tab-interactive"
              @click="activeTab = 'interactive'"
            >
              Web-Native Interactions
            </button>
          </div>

          <div class="view-controls">
            <button
              v-for="mode in viewModes"
              :key="mode.value"
              :class="['view-button', { active: viewMode === mode.value }]"
              :data-testid="`view-${mode.value}`"
              @click="viewMode = mode.value"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>

        <div class="demo-content">
          <div
            v-show="viewMode === 'markup' || viewMode === 'both'"
            class="demo-panel markup-panel"
          >
            <div class="markup-header">
              <h3>Markup</h3>
              <button
                class="reset-button"
                title="Reset to original example"
                data-testid="reset-button"
                @click="resetToExample"
              >
                Reset
              </button>
            </div>
            <textarea
              v-model="editableMarkup"
              class="markup-content editable"
              placeholder="Type RSM markup here..."
              data-testid="markup-editor"
              @input="handleMarkupInput"
            ></textarea>
          </div>

          <div
            v-show="viewMode === 'output' || viewMode === 'both'"
            class="demo-panel output-panel"
          >
            <h3>Output</h3>
            <div class="output-container">
              <div v-if="demoError" class="demo-error" data-testid="demo-error">
                <p><strong>Demo unavailable - showing static preview</strong></p>
                <p>
                  The live rendering service is temporarily unavailable. The content below shows
                  what the rendered output would look like.
                </p>
              </div>
              <div v-if="demoLoading" class="inline-loading" data-testid="demo-loading">
                <div class="inline-spinner"></div>
              </div>
              <div class="output-content" v-html="currentExample.output"></div>
            </div>
          </div>
        </div>

        <div class="demo-callouts">
          <p
            v-show="viewMode === 'markup' || viewMode === 'both'"
            class="demo-context demo-context-left"
          >
            {{ currentExample.context }}
          </p>
          <p
            v-show="viewMode === 'output' || viewMode === 'both'"
            class="demo-context demo-context-right"
          >
            Try resizing your browser or toggling dark mode (↗) to see RSM adapt
          </p>
        </div>

      </div>
    </section> -->

    <!-- RSM Studio Features Section -->
    <section id="studio-features" class="studio-features-section">
      <div class="container">
        <h2 class="section-header">RSM Studio</h2>
        <p class="section-subheader">A collaborative editor for web-native manuscripts</p>

        <div class="studio-intro">
          <p>
            Studio brings familiar collaborative editing to RSM. Write with your team in real-time,
            preview your web-formatted output as you type, and export to any format journals
            require. No learning curve for collaboration—just write.
          </p>
        </div>

        <!-- Screenshot placeholder for studio interface -->
        <div class="studio-screenshot">
          <div class="screenshot-placeholder">
            <div class="placeholder-label">RSM Studio editor interface</div>
          </div>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <h3>Collaborate in real-time</h3>
            <p>
              Multiple cursors, instant sync, no merge conflicts—see your co-authors' changes as
              they type
            </p>
          </div>

          <div class="feature-card">
            <h3>Preview as you write</h3>
            <p>Live preview shows your web-formatted manuscript while you work</p>
          </div>

          <div class="feature-card">
            <h3>Comments that stay put</h3>
            <p>
              Thread discussions on specific paragraphs—comments move with the text they reference
            </p>
          </div>

          <div class="feature-card">
            <h3>Complete version history</h3>
            <p>Track every change with full history of who changed what and when</p>
          </div>

          <div class="feature-card">
            <h3>Export to any format</h3>
            <p>One click to PDF, LaTeX, or Word for journal submission</p>
          </div>

          <div class="feature-card">
            <h3>Work from anywhere</h3>
            <p>Browser-based—works on any device without installation</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Signup Section -->
    <section class="signup-section">
      <div class="container">
        <div class="signup-content">
          <h2 id="signup" class="section-header">Be notified at launch</h2>
          <p class="signup-subtitle">Coming mid 2026</p>

          <!-- Success Message -->
          <div v-if="signupComplete" class="thank-you-message">
            <h3>Thank you for your interest!</h3>
            <p>We'll be in touch with early access details as we approach the mid 2026 launch.</p>
          </div>

          <!-- Signup Form -->
          <form
            class="signup-form"
            :class="{ 'form-submitted': signupComplete }"
            @submit.prevent="handleSignup"
          >
            <div class="form-group">
              <label for="email">Email <span class="required-asterisk">*</span></label>
              <input
                id="email"
                v-model="formData.email"
                type="email"
                required
                class="form-input"
                :disabled="submitting || signupComplete"
              />
            </div>

            <div class="form-group">
              <label>Which tools will you use for your next publication?</label>
              <div class="checkbox-group">
                <label v-for="tool in authoringTools" :key="tool" class="checkbox-label">
                  <input
                    v-model="formData.authoringTools"
                    :value="tool"
                    type="checkbox"
                    class="checkbox-input"
                    :disabled="submitting || signupComplete"
                  />
                  {{ tool }}
                </label>
                <div class="other-tool">
                  <label class="checkbox-label">
                    <input
                      v-model="formData.otherToolSelected"
                      type="checkbox"
                      class="checkbox-input"
                      :disabled="submitting || signupComplete"
                    />
                    Other:
                  </label>
                  <input
                    v-model="formData.otherTool"
                    type="text"
                    placeholder="Please specify"
                    class="form-input other-input"
                    :disabled="!formData.otherToolSelected || submitting || signupComplete"
                  />
                </div>
              </div>
            </div>

            <div v-if="signupError" class="error-message">
              {{ signupError }}
            </div>

            <button v-if="!signupComplete" type="submit" class="cta-button" :disabled="submitting">
              {{ submitting ? "Submitting..." : "Be notified at launch" }}
            </button>
          </form>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section id="faq" class="faq-section">
      <div class="container">
        <h2 class="section-header">Frequently Asked Questions</h2>
        <div class="faq-grid">
          <div v-for="(faq, index) in faqs" :key="index" class="faq-item">
            <button class="faq-question" @click="toggleFaq(index)">
              <h3>{{ faq.question }}</h3>
              <svg
                class="faq-chevron"
                :class="{ open: isFaqOpen(index) }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </button>
            <div class="faq-answer" :class="{ open: isFaqOpen(index) }">
              <p>
                <template v-if="faq.hasScrollPress">
                  RSM documents can export to traditional formats like PDF when needed for journal
                  submission, while also offering modern web publishing options through platforms
                  like
                  <a href="https://scroll.press" target="_blank" rel="noopener noreferrer"
                    >Scroll Press</a
                  >.
                </template>
                <template v-else-if="faq.hasArisProgram">
                  <a href="https://aris.pub" target="_blank" rel="noopener noreferrer"
                    >The Aris Program</a
                  >{{ faq.answer }}
                </template>
                <template v-else>
                  {{ faq.answer }}
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CLI Callout Section -->
    <section class="cli-callout-section">
      <div class="container">
        <h2 class="section-header">Want to try RSM today?</h2>
        <p class="cli-callout-text">
          The
          <a href="https://github.com/aris-pub/rsm" target="_blank" rel="noopener noreferrer"
            >command-line tools are open source</a
          >. Install with <code>pip install rsm</code> and start writing.
        </p>
      </div>
    </section>

    <AppFooter />
  </div>
</template>

<script setup>
  /* global $fetch */
  import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
  import { useHead, useRuntimeConfig } from "#imports";

  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl || "http://localhost:8000";

  // Load MathJax and RSM CSS for rendering the RSM demo
  useHead({
    link: [
      {
        rel: "stylesheet",
        href: `${backendUrl}/static/rsm.css`,
      },
      {
        rel: "stylesheet",
        href: `${backendUrl}/static/pygments.css`,
      },
    ],
    script: [
      {
        src: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
        async: true,
        id: "MathJax-script",
      },
    ],
  });

  // Reactive data
  const activeTab = ref("academic");
  const viewMode = ref("both");
  const signupComplete = ref(false);
  const submitting = ref(false);
  const signupError = ref("");
  const openFaqs = ref(new Set());

  // RSM Demo Example (meta, self-documenting)
  const rsmExample = reactive({
    source: `:rsm:
# Writing with RSM

Readable Science Markup is built with the full power of the modern web in mind. % Try resizing your browser or switching to dark mode.

:figure:
  :label: fig1
  :path: fig1.html
  :caption: You can embed interactive figures.
::

Write equations using LaTeX syntax. Display equations get automatic numbering.

$$ :label: gaussian
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

References such as :ref:fig1:: and :ref:gaussian,Eqn. (1):: appear as clickable tooltips.

::`,
    rendered: '',
  });

  // Syntax highlighted source
  const highlightedSource = computed(() => {
    let text = rsmExample.source;

    // Highlight :figure: block with its closing ::
    text = text.replace(/(:figure:[\s\S]*?)(::)/g, (match, content, close) => {
      return content
        .replace(/(:label:)\s+(\w+)/g, '<span class="rsm-directive">$1</span> <span class="rsm-value">$2</span>')
        .replace(/(:figure:|:path:|:caption:)/g, '<span class="rsm-directive">$1</span>') +
             '<span class="rsm-directive">::</span>';
    });

    // Highlight :rsm: and its closing ::
    text = text.replace(/:rsm:/g, '<span class="rsm-delimiter">:rsm:</span>');
    text = text.replace(/^::$/gm, '<span class="rsm-delimiter">::</span>');

    // Highlight comments (both line and inline)
    text = text.replace(/(%.*?)$/gm, '<span class="rsm-comment">$1</span>');

    // Highlight headers
    text = text.replace(/^(#\s+.+)$/gm, '<span class="rsm-header">$1</span>');

    // Highlight :ref: tags (with optional custom text)
    text = text.replace(/(:ref:)(\w+)(,[^:]*?)?(::)/g, '<span class="rsm-directive">$1</span><span class="rsm-value">$2</span>$3<span class="rsm-directive">$4</span>');

    // Highlight math delimiters and :label: inside math blocks
    text = text.replace(/(\$\$)\s+(:label:)\s+(\w+)/g, '<span class="rsm-math-delim">$1</span> <span class="rsm-directive">$2</span> <span class="rsm-value">$3</span>');

    // Highlight LaTeX syntax in the equation (do this before general $$ replacement)
    text = text.replace(/(\\(?:int|sqrt|infty|pi))/g, '<span class="rsm-latex-command">$1</span>');
    text = text.replace(/([_^])/g, '<span class="rsm-latex-operator">$1</span>');
    text = text.replace(/([{}])/g, '<span class="rsm-latex-brace">$1</span>');

    text = text.replace(/(\$\$|\$)/g, '<span class="rsm-math-delim">$1</span>');

    return text;
  });

  // Demo rendering state
  const demoLoading = ref(false);
  const demoError = ref(false);
  const demoInitialized = ref(false);
  const renderedOutputRef = ref(null);

  // Editable markup state
  const editableMarkup = ref("");
  const renderTimer = ref(null);

  // Form data
  const formData = ref({
    email: "",
    authoringTools: [],
    otherToolSelected: false,
    otherTool: "",
  });

  // Static data
  const authoringTools = [
    "LaTeX (including Overleaf)",
    "Markdown (any variant)",
    "Typst",
    "Quarto",
    "MS Word",
    "Google Docs",
  ];

  const faqs = [
    {
      question: "Why should my manuscripts be web-native if journals only accept PDFs?",
      answer:
        "Web-native manuscripts are for your readers, not just journals. Most research is read online, shared via links, and accessed on phones and tablets. RSM lets you share living, accessible documents with colleagues while still exporting to PDF when journals require it. The same manuscript serves both audiences.",
    },
    {
      question: "How is RSM different from LaTeX?",
      answer:
        "LaTeX was designed for print publishing in the 1980s. RSM is built for the web from day one, with responsive layouts, interactive elements, and accessibility features that work automatically without additional packages or configuration.",
    },
    {
      question: "How is RSM different from other modern alternatives?",
      answer:
        "RSM is the only markup language built exclusively for web-native scientific publishing. Unlike Typst (designed for beautiful PDFs), Quarto (focused on computational notebooks), or MyST (built for technical documentation), RSM starts and ends with semantic web research documents. Complete separation of content and presentation means your manuscripts adapt to any reading context automatically.",
    },
    {
      question: "Will journals accept RSM submissions?",
      answer:
        "RSM documents can export to traditional formats like PDF when needed for journal submission, while also offering modern web publishing options through platforms like Scroll Press.",
      hasScrollPress: true,
    },
    {
      question: "Is RSM suitable for complex mathematical content?",
      answer:
        "Absolutely. RSM supports LaTeX-style math notation that renders beautifully on the web with proper accessibility support, including screen reader compatibility for mathematical expressions.",
    },
    {
      question: "Can I import my existing LaTeX documents?",
      answer:
        "Yes! RSM Studio will include conversion tools to help migrate your existing LaTeX manuscripts, preserving your content while upgrading to web-native formatting.",
    },
    {
      question: "When will RSM Studio be available?",
      answer:
        "We're targeting a mid 2026 launch with full registration open to all academic writers. Sign up above to be notified when we go live.",
    },
    {
      question: "What's The Aris Program?",
      answer:
        " is our initiative to modernize academic publishing infrastructure, with RSM Studio as the flagship writing platform designed for the web era.",
      hasArisProgram: true,
    },
  ];

  const isMobile = ref(false);

  const viewModes = computed(() => {
    if (isMobile.value) {
      return [
        { label: "Show Markup", value: "markup" },
        { label: "Show Output", value: "output" },
      ];
    }
    return [
      { label: "Markup", value: "markup" },
      { label: "Output", value: "output" },
      { label: "Both", value: "both" },
    ];
  });

  // Cache for rendered content to avoid duplicate API calls
  const renderCache = new Map();

  const examples = {
    academic: {
      markup: `:rsm:

# Climate Change Impacts on Marine Ecosystems

:author:
  :name: Sarah Chen
  :affiliation: Marine Biology Institute, University of California
::

:author:
  :name: Maria Rodriguez
  :affiliation: Marine Biology Institute, University of California
::

:abstract:
Recent climate change has significantly altered marine ecosystems worldwide. We analyzed temperature data from 50+ monitoring stations over 20 years and found accelerating warming trends in surface waters. These changes correlate strongly with species migration patterns and biodiversity shifts.
::

## Introduction

Ocean warming represents one of the most pressing environmental challenges of our time :cite:ipcc2021::. Our research quantifies regional impacts through comprehensive temperature monitoring.

### Methods

Temperature measurements were collected using automated sensors deployed across major oceanic regions. Statistical analysis employed regression models to identify trends.

## Results

Surface temperatures increased by 0.8°C ± 0.2°C over the study period. Migration patterns show clear northward shifts in 15 key species.

:bibliography: ::

::

:bibtex:

@book{ipcc2021,
  title={Climate Change 2021: The Physical Science Basis},
  author={IPCC},
  year={2023},
  publisher={Cambridge University Press},
  doi={10.1017/9781009157896}
}

::
`,
      output: ref(`<div class="manuscript-header">
<h1 class="manuscript-title">Climate Change Impacts on Marine Ecosystems</h1>
<div class="manuscript-authors">Sarah Chen, David Williams, Maria Rodriguez</div>
<div class="manuscript-affiliation">Marine Biology Institute, University of California</div>
</div>
<div class="abstract">
<h2>Abstract</h2>
<p>Recent climate change has significantly altered marine ecosystems worldwide. We analyzed temperature data from 50+ monitoring stations over 20 years and found accelerating warming trends in surface waters. These changes correlate strongly with species migration patterns and biodiversity shifts.</p>
</div>
<h1>Introduction</h1>
<p>Ocean warming represents one of the most pressing environmental challenges of our time <a href="#ipcc2021" class="citation">[1]</a>. Our research builds on previous studies <a href="#chen2020" class="citation">[2]</a> to quantify regional impacts.</p>
<h2>Methods</h2>
<p>Temperature measurements were collected using automated sensors deployed across major oceanic regions. Statistical analysis employed regression models to identify trends.</p>
<h1>Results</h1>
<p>Surface temperatures increased by 0.8°C ± 0.2°C over the study period. Migration patterns show clear northward shifts in 15 key species.</p>
<div class="bibliography">
<h2>References</h2>
<div class="reference" id="ipcc2021">[1] IPCC. Climate Change 2021: The Physical Science Basis. Cambridge University Press, 2021.</div>
<div class="reference" id="chen2020">[2] Chen, S. and Lopez, M. Marine Temperature Trends in Pacific Waters. Ocean Science, 16:234-267, 2020.</div>
</div>`),
      context: "Write once, read anywhere",
    },
    interactive: {
      markup: `:rsm:

# Interactive Marine Data

## Temperature Trends
:label: temp-trends

Global sea surface temperatures have risen dramatically. Click the chart below to explore regional variations.

:figure:
  :path: temperature-data.json
  :caption: foobar
::

## Species Migration
:label: migration

As waters warm, species migrate toward cooler regions. The :ref:temp-trends, temperature data:: shows clear correlations with migration patterns.

### Key Finding

Our analysis of 15 species shows northward migration averaging 2.3 km/year. This rate has :span:{:label:acceleration}accelerated since 2015:: to 3.8 km/year.

## Discussion

The :ref:acceleration, accelerated migration rate:: suggests climate impacts are intensifying. Interactive exploration of our dataset reveals regional hotspots where adaptation strategies are most urgent.

::
`,
      output: ref(`<h1>Interactive Marine Data</h1>
<h2>Temperature Trends</h2>
<p>Global sea surface temperatures have risen dramatically. Click the chart below to explore regional variations.</p>
<div class="interactive-chart" data-src="temperature-data.json">
<svg viewBox="0 0 400 200" class="chart-placeholder">
<rect x="20" y="20" width="360" height="160" fill="none" stroke="#ccc"/>
<line x1="40" y1="160" x2="380" y2="40" stroke="#e74c3c" stroke-width="2"/>
<text x="200" y="195" text-anchor="middle" font-size="12">Years (2000-2020)</text>
<text x="10" y="100" text-anchor="middle" font-size="12" transform="rotate(-90, 10, 100)">Temperature (°C)</text>
</svg>
</div>
<h2>Species Migration</h2>
<p>As waters warm, species migrate toward cooler regions. The <a href="#temp-trends">temperature data</a> shows clear correlations with migration patterns.</p>
<h3>Key Finding</h3>
<details class="collapsible">
<summary>Click for details</summary>
<p>Our analysis of 15 species shows northward migration averaging 2.3 km/year. This rate has <span class="tooltip-trigger">accelerated since 2015</span> to 3.8 km/year.</p>
</details>
<h2>Discussion</h2>
<p>The <a href="#acceleration">accelerated migration rate</a> suggests climate impacts are intensifying. Interactive exploration of our dataset reveals regional hotspots where adaptation strategies are most urgent.</p>`),
      context: "Write once, read anywhere",
    },
  };

  const currentExample = computed(() => {
    const example = examples[activeTab.value];
    return {
      markup: editableMarkup.value || example.markup,
      output: example.output.value,
      context: example.context,
    };
  });

  // RSM Rendering Functions
  const renderRsm = async (source) => {
    // Check cache first
    if (renderCache.has(source)) {
      return renderCache.get(source);
    }

    try {
      // Get runtime config for backend URL
      const config = useRuntimeConfig();
      const backendUrl = config.public.backendUrl || "http://localhost:8000";

      const result = await $fetch(`${backendUrl}/render`, {
        method: "POST",
        body: { source },
        timeout: 8000, // 8 second timeout
      });

      // Strip body tags from RSM response to get clean HTML
      // Extract content between body tags
      const bodyMatch = result.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const cleanedResult = bodyMatch ? bodyMatch[1].trim() : result.trim();

      // Cache the cleaned result
      renderCache.set(source, cleanedResult);
      return cleanedResult;
    } catch (error) {
      console.error("Failed to render RSM:", error);
      throw error;
    }
  };

  // Real-time markup input handler
  const handleMarkupInput = (event) => {
    // Auto-resize textarea
    if (event && event.target) {
      event.target.style.height = "auto";
      event.target.style.height = event.target.scrollHeight + "px";
    }

    // Clear existing timer
    if (renderTimer.value) {
      clearTimeout(renderTimer.value);
    }

    // Set new timer for blazing fast debounced rendering
    renderTimer.value = setTimeout(async () => {
      if (editableMarkup.value.trim()) {
        try {
          demoLoading.value = true;
          demoError.value = false;

          const result = await renderRsm(editableMarkup.value);
          const example = examples[activeTab.value];
          example.output.value = result;

          // Re-initialize RSM features after new content is rendered
          await nextTick();
          const outputElement = document.querySelector(".output-content");
          if (outputElement) {
            await initializeRsmContent(outputElement);
          }
        } catch (error) {
          console.error("Failed to render user markup:", error);
          demoError.value = true;
        } finally {
          demoLoading.value = false;
        }
      }
    }, 150); // Ultra-fast debounce for real-time feel
  };

  // Reset to original example
  const resetToExample = () => {
    const example = examples[activeTab.value];
    editableMarkup.value = example.markup;

    // Trigger re-render with original content
    handleMarkupInput();
  };

  // RSM Initialization Function
  const initializeRsmContent = async (element) => {
    if (!element) return;

    try {
      // Get backend URL for static assets
      const config = useRuntimeConfig();
      const backendUrl = config.public.backendUrl || "http://localhost:8000";

      // Load RSM onload function from backend static assets
      const onloadModule = await import(`${backendUrl}/static/onload.js`);

      // Initialize RSM features for this element
      await onloadModule.onload(element, {
        path: `${backendUrl}/static/`,
        keys: false, // Disable keyboard shortcuts in demo
      });
    } catch (error) {
      console.error("Failed to initialize RSM content:", error);
      // Gracefully continue without RSM features
    }
  };

  const initializeDemo = async () => {
    if (demoInitialized.value) return;

    demoLoading.value = true;
    demoError.value = false;

    try {
      // Render both examples in parallel
      const [academicResult, interactiveResult] = await Promise.all([
        renderRsm(examples.academic.markup),
        renderRsm(examples.interactive.markup),
      ]);

      examples.academic.output.value = academicResult;
      examples.interactive.output.value = interactiveResult;
      demoInitialized.value = true;

      // Initialize RSM features after content is rendered
      await nextTick(); // Wait for DOM update
      const outputElement = document.querySelector(".output-content");
      if (outputElement) {
        await initializeRsmContent(outputElement);
      }
    } catch (error) {
      console.error("Failed to initialize demo content:", error);
      demoError.value = true;
      // Keep static fallback content that's already in the refs
    } finally {
      demoLoading.value = false;
    }
  };

  // Initialize demo on mount
  // Execute embedded scripts in rendered HTML (needed for Plotly charts)
  const executeEmbeddedScripts = async () => {
    if (!renderedOutputRef.value) return;

    await nextTick();

    // Find all script tags within the rendered output
    const scripts = renderedOutputRef.value.querySelectorAll('script');

    for (const script of scripts) {
      try {
        if (script.src) {
          // External script - create new script element and append to head
          const newScript = document.createElement('script');
          newScript.src = script.src;

          // Copy other attributes
          Array.from(script.attributes).forEach((attr) => {
            if (attr.name !== 'src') {
              newScript.setAttribute(attr.name, attr.value);
            }
          });

          // Wait for script to load
          await new Promise((resolve, reject) => {
            newScript.onload = resolve;
            newScript.onerror = reject;
            document.head.appendChild(newScript);
          });
        } else if (script.textContent && script.textContent.trim()) {
          // Inline script - create new script element and replace in place
          const newScript = document.createElement('script');
          newScript.textContent = script.textContent;

          // Copy attributes
          Array.from(script.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });

          // Replace the old script with the new one to trigger execution
          script.parentNode.insertBefore(newScript, script);
          script.parentNode.removeChild(script);
        }
      } catch (error) {
        console.error('Error executing embedded script:', error);
      }
    }
  };

  // Initialize tooltips using jQuery and Tooltipster
  const initializeTooltips = async () => {
    // Load jQuery from CDN if not already loaded
    if (!window.jQuery) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js';
        script.onload = () => {
          window.$ = window.jQuery;
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Load RSM CSS for tooltip content styling
    if (!document.querySelector('link[href*="rsm.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/rsm.css';
      document.head.appendChild(link);
    }

    // Load Tooltipster CSS
    if (!document.querySelector('link[href*="tooltipster"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tooltipster@4.2.8/dist/css/tooltipster.bundle.min.css';
      document.head.appendChild(link);
    }

    // Load Tooltipster JS
    if (!window.jQuery.fn.tooltipster) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tooltipster@4.2.8/dist/js/tooltipster.bundle.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Helper to strip handrail UI elements from tooltip content
    const stripHandrails = (element) => {
      const $el = $(element);
      $el.find('.hr-collapse-zone').remove();
      $el.find('.hr-menu-zone').remove();
      $el.find('.hr-border-zone').remove();
      $el.find('.hr-spacer-zone').remove();
      $el.find('.hr-info-zone').remove();
      return $el;
    };

    // Create tooltips on reference links
    const $ = window.jQuery;
    $('.manuscriptwrapper a.reference:not(.tooltipstered)').tooltipster({
      theme: ['tooltipster-shadow', 'tooltipster-shadow-rsm'],
      minWidth: 100,
      maxWidth: 600,
      contentAsHTML: true,
      trigger: 'custom',
      triggerOpen: {
        mouseenter: true,
        touchstart: true
      },
      triggerClose: {
        click: true,
        mouseleave: true,
        originClick: true,
        touchleave: true
      },
      functionInit: function (instance, helper) {
        const target = $(helper.origin).attr('href');
        if (!target || target === '#') return;

        // Escape special characters for jQuery selector
        const escapedTarget = target.replaceAll('.', '\\.').replaceAll(':', '\\:');
        const targetEl = $(escapedTarget)[0];

        if (!targetEl) return;

        let content = '';
        const tag = targetEl.tagName;

        // Handle different element types
        if (tag === 'DIV' && targetEl.classList.contains('mathblock')) {
          const clone = $(targetEl).clone();
          stripHandrails(clone);
          // Get content from the content zone
          const contentZone = clone.find('.hr-content-zone');
          content = contentZone.length > 0 ? contentZone.html() : clone.html();
        } else if (tag === 'FIGURE') {
          content = $(targetEl).html();
        } else {
          content = targetEl.innerHTML;
        }

        // Wrap content in manuscriptwrapper for proper styling
        content = `<div class="manuscriptwrapper">${content}</div>`;
        const $content = $(content);

        instance.content($content);
      },
      functionReady: async function(instance, helper) {
        // Trigger MathJax after tooltip is rendered in DOM
        if (window.MathJax && window.MathJax.typesetPromise) {
          try {
            const tooltipContent = document.querySelector('.tooltipster-content');
            if (tooltipContent) {
              await window.MathJax.typesetPromise([tooltipContent]);
              // Reposition tooltip after MathJax changes content size
              instance.reposition();
            }
          } catch (e) {
            console.warn('MathJax rendering failed in tooltip:', e);
          }
        }
      }
    });
  };

  onMounted(async () => {
    // Load rendered HTML from public directory
    try {
      const response = await fetch('/demo-rendered.html');
      rsmExample.rendered = await response.text();

      // Execute scripts after HTML is rendered
      await nextTick();
      await executeEmbeddedScripts();

      // Initialize tooltips after content is rendered
      await nextTick();
      await initializeTooltips();
    } catch (error) {
      console.error('Failed to load demo rendered HTML:', error);
    }

    // Set initial mobile state
    isMobile.value = window.innerWidth < 768;

    // Initialize editable markup with current example
    editableMarkup.value = examples[activeTab.value].markup;

    // Set initial textarea height after next tick
    nextTick(() => {
      const textarea = document.querySelector('[data-testid="markup-editor"]');
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      }

      // Trigger MathJax to process the CLT demo math
      if (window.MathJax) {
        window.MathJax.typesetPromise();
      } else {
        // Wait for MathJax to load then typeset
        setTimeout(() => {
          if (window.MathJax) {
            window.MathJax.typesetPromise();
          }
        }, 1000);
      }
    });

    // Add resize listener
    const handleResize = () => {
      isMobile.value = window.innerWidth < 768;
    };
    window.addEventListener("resize", handleResize);

    // Cleanup on unmount
    const cleanup = () => {
      window.removeEventListener("resize", handleResize);
    };

    initializeDemo();

    return cleanup;
  });

  // Watch for tab changes and update editable content
  watch(activeTab, async (newTab) => {
    const example = examples[newTab];

    // Update editable markup to show the new tab's example
    editableMarkup.value = example.markup;

    // Resize textarea to fit new content
    await nextTick();
    const textarea = document.querySelector('[data-testid="markup-editor"]');
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }

    // Ensure the output is rendered if not cached
    if (!renderCache.has(example.markup) && !demoError.value) {
      demoLoading.value = true;
      try {
        const result = await renderRsm(example.markup);
        example.output.value = result;
      } catch (error) {
        console.error("Failed to render tab content:", error);
        demoError.value = true;
      } finally {
        demoLoading.value = false;
      }
    }

    // Always re-initialize RSM features when switching tabs
    await nextTick(); // Wait for DOM update
    const outputElement = document.querySelector(".output-content");
    if (outputElement && !demoError.value) {
      await initializeRsmContent(outputElement);
    }
  });

  // Methods
  const handleSignup = async () => {
    submitting.value = true;
    signupError.value = "";

    try {
      // Prepare authoring tools data
      const tools = [...formData.value.authoringTools];
      if (formData.value.otherToolSelected && formData.value.otherTool.trim()) {
        tools.push(formData.value.otherTool.trim());
      }

      // Get runtime config for backend URL
      const config = useRuntimeConfig();
      const backendUrl = config.public.backendUrl || "http://localhost:8000";

      const response = await fetch(`${backendUrl}/signup/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.value.email,
          authoring_tools: tools.length > 0 ? tools : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || "Signup failed");
      }

      signupComplete.value = true;
    } catch (error) {
      console.error("Signup error:", error);
      signupError.value = error.message || "Something went wrong. Please try again.";
    } finally {
      submitting.value = false;
    }
  };

  const toggleFaq = (index) => {
    if (openFaqs.value.has(index)) {
      openFaqs.value.delete(index);
    } else {
      openFaqs.value.add(index);
    }
  };

  const isFaqOpen = (index) => {
    return openFaqs.value.has(index);
  };
</script>

<style scoped>
  .landing-page {
    min-height: 100vh;
    background: var(--surface-page);
    overflow-x: hidden;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  /* Hero Section */
  .hero-section {
    padding: 8rem 0;
    padding-top: calc(8rem + 4rem);
    text-align: center;
    background: linear-gradient(135deg, var(--primary-200) 0%, var(--purple-50) 100%);
    min-height: 60vh;
    display: flex;
    align-items: center;
    position: relative;
  }

  /* Dark mode general background */
  .dark-theme {
    background-color: #1f2937 !important;
  }

  /* Dark mode hero background */
  .dark-theme .hero-section {
    background: linear-gradient(
      135deg,
      #1f2937 40%,
      var(--primary-900) 85%,
      var(--purple-900) 100%
    );
  }

  /* Dark mode hero text colors */
  .dark-theme .hero-brand {
    color: var(--primary-100);
  }

  .dark-theme .hero-title {
    color: var(--text-body);
  }

  .dark-theme .hero-subtitle {
    color: var(--text-muted);
  }

  /* Section Dividers */
  .hero-section::after,
  .demo-section::after,
  .studio-features-section::after,
  .benefits-section::after,
  .signup-section::after {
    content: "";
    position: absolute;
    bottom: -1.5px;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
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

  .hero-section::after {
    width: 240px;
  }

  .hero-brand {
    font-size: 3.5rem;
    font-weight: var(--weight-semi);
    color: var(--primary-900);
    margin: 0 0 2rem 0;
    letter-spacing: 0.05em;
    line-height: var(--header-line-height);
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
  }

  .hero-logo {
    width: 56px;
    height: 56px;
  }

  .hero-text {
    display: flex;
    gap: 0.15rem;
  }

  .brand-rsm {
    font-family: "Montserrat", sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: var(--weight-bold);
  }

  .brand-studio {
    font-family: Georgia, serif;
    font-weight: var(--weight-regular);
    letter-spacing: -0.02em;
  }

  .hero-title {
    font-family: "Montserrat", sans-serif;
    font-size: 2.25rem;
    font-weight: var(--weight-semi);
    color: var(--extra-dark);
    margin: 0 0 2rem 0;
    line-height: var(--header-line-height);
  }

  .hero-subtitle {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.25rem;
    color: var(--extra-dark);
    margin: 0 0 2rem 0;
    line-height: var(--body-line-height);
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .hero-cta-button {
    display: inline-block;
    padding: 0.75rem 2rem;
    background: var(--surface-action);
    color: var(--primary-50);
    border: var(--border-thin) solid var(--surface-action);
    border-radius: 16px;
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    font-weight: var(--weight-semi);
    text-decoration: none;
    cursor: pointer;
    transition: var(--transition-bg-color), var(--transition-bd-color);
    box-shadow: var(--shadow-soft), var(--shadow-strong);
  }

  .hero-cta-button:hover {
    background: var(--surface-action-hover);
    border-color: var(--surface-action-hover);
  }

  /* Section Headers */
  .section-header {
    font-family: "Georgia", serif;
    font-size: var(--h2-size);
    font-weight: var(--weight-semi);
    color: var(--text-body);
    text-align: center;
    margin: 3rem 0 0.75rem 0;
    line-height: var(--header-line-height);
  }

  .section-subheader {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    color: var(--dark);
    text-align: center;
    margin: 0 0 3rem 0;
    line-height: var(--body-line-height);
  }

  /* Common Section Styles */
  .demo-section,
  .what-is-rsm-section,
  .studio-features-section,
  .benefits-section,
  .signup-section,
  .faq-section,
  .cli-callout-section {
    padding: 7rem 0;
    background: var(--surface-page);
    position: relative;
  }

  .intro-content {
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
  }

  .intro-content p {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    color: var(--text-body);
    line-height: var(--body-line-height);
    margin: 0 0 1.5rem 0;
  }

  /* RSM Section Styles */
  .rsm-intro {
    max-width: 800px;
    margin: 0 auto 3rem;
    text-align: center;
  }

  .rsm-intro p {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    color: var(--text-body);
    line-height: var(--body-line-height);
    margin: 0 0 1.5rem 0;
  }

  .rsm-intro p:last-child {
    margin-bottom: 0;
  }

  .rsm-intro a {
    color: var(--primary-600);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .rsm-intro a:hover {
    color: var(--primary-700);
    text-decoration: underline;
  }

  /* RSM Live Demo */
  .rsm-demo-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    max-width: 1100px;
    margin: 0 auto;
  }

  .rsm-demo-panel {
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      var(--shadow-soft),
      0 8px 24px rgba(0, 0, 0, 0.08);
  }

  .panel-header {
    background: var(--primary-600);
    color: var(--primary-50);
    padding: 0.75rem 1.5rem;
    font-family: "Montserrat", sans-serif;
    font-weight: var(--weight-semi);
    font-size: 0.95rem;
  }

  .rsm-source-code {
    font-family: "Source Code Pro", monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    padding: 2rem;
    margin: 0;
    background: var(--surface-page);
    color: var(--text-body);
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* RSM Syntax Highlighting */
  :deep(.rsm-source-code .rsm-delimiter) {
    color: var(--primary-700);
    font-weight: var(--weight-semi);
  }

  :deep(.rsm-source-code .rsm-header) {
    color: var(--primary-800);
    font-weight: var(--weight-bold);
  }

  :deep(.rsm-source-code .rsm-directive) {
    color: var(--primary-600);
  }

  :deep(.rsm-source-code .rsm-value) {
    color: var(--secondary-400);
  }

  :deep(.rsm-source-code .rsm-math-delim) {
    color: var(--primary-700);
    font-weight: var(--weight-semi);
  }

  :deep(.rsm-source-code .rsm-latex-command) {
    color: var(--orange-600);
    font-weight: var(--weight-semi);
  }

  :deep(.rsm-source-code .rsm-latex-operator) {
    color: var(--orange-500);
  }

  :deep(.rsm-source-code .rsm-latex-brace) {
    color: var(--gray-500);
  }

  :deep(.rsm-source-code .rsm-comment) {
    color: var(--gray-500);
    font-style: italic;
  }

  .rsm-rendered-output {
    padding: 1.5rem;
    padding-left: 2.5rem;
    padding-right: 0.5rem;
    background: var(--surface-page);
  }

  :deep(.rsm-rendered-output p),
  :deep(.rsm-rendered-output h1),
  :deep(.rsm-rendered-output figcaption),
  :deep(.rsm-rendered-output .mathblock) {
    color: var(--gray-1000) !important;
  }

  /* Override manuscriptwrapper padding in demo */
  :deep(.rsm-rendered-output .manuscriptwrapper) {
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    overflow: visible !important;
  }

  :deep(.rsm-rendered-output .manuscript) {
    padding: 0 !important;
  }

  :deep(.rsm-rendered-output .manuscriptwrapper.embedded .level-1) {
    margin-block: 0 !important;
  }

  :deep(.rsm-rendered-output .manuscriptwrapper.embedded h1) {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }

  :deep(.rsm-rendered-output .heading.hr) {
    margin-bottom: 0 !important;
  }

  :deep(.rsm-rendered-output .paragraph.hr.hr-hidden) {
    margin-bottom: 0 !important;
  }

  /* Hide handrail UI elements but keep structure */
  :deep(.rsm-rendered-output .hr-collapse-zone) {
    display: none !important;
  }

  :deep(.rsm-rendered-output .hr-menu-zone) {
    display: none !important;
  }

  :deep(.rsm-rendered-output .hr-border-zone) {
    display: none !important;
  }

  :deep(.rsm-rendered-output .hr-spacer-zone) {
    display: none !important;
  }

  /* Position equation number closer to equation */
  :deep(.rsm-rendered-output .hr-offset > .hr-info-zone) {
    left: calc(100% - 3rem) !important;
  }

  /* Remove figure margins */
  :deep(.rsm-rendered-output figure) {
    margin-block: 0 !important;
  }

  /* Hide hr-info-zone in figcaption */
  :deep(.rsm-rendered-output figcaption .hr-info-zone) {
    display: none !important;
  }

  /* Plotly chart styling for theme compatibility */
  :deep(.plotly-graph-div .xtick text),
  :deep(.plotly-graph-div .ytick text),
  :deep(.plotly-graph-div .xtitle),
  :deep(.plotly-graph-div .ytitle),
  :deep(.plotly-graph-div .legendtext) {
    fill: var(--text-body) !important;
  }

  :deep(.plotly-graph-div .xgrid),
  :deep(.plotly-graph-div .ygrid) {
    stroke: var(--border-primary) !important;
  }

  :deep(.plotly-graph-div .crisp) {
    stroke: var(--text-body) !important;
  }

  /* Screenshot Placeholders */
  .studio-screenshot {
    max-width: 900px;
    margin: 0 auto 3rem;
    border-radius: 16px;
    overflow: hidden;
    border: var(--border-extrathin) solid var(--border-primary);
    box-shadow:
      var(--shadow-soft),
      0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .screenshot-placeholder {
    width: 100%;
    height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-100) 0%, var(--secondary-100) 100%);
    position: relative;
  }

  .placeholder-label {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    font-weight: var(--weight-medium);
    color: var(--medium);
    background: var(--surface-page);
    padding: 1rem 2rem;
    border-radius: 8px;
    border: var(--border-thin) solid var(--border-primary);
    box-shadow: var(--shadow-soft);
  }

  .philosophy-callout {
    max-width: 800px;
    margin: 2rem auto 3rem;
    padding: 2rem;
    background: var(--surface-information);
    border-radius: 16px;
    border: var(--border-extrathin) solid var(--border-information);
    text-align: center;
  }

  .philosophy-tagline {
    font-family: "Montserrat", sans-serif;
    font-size: 1.25rem;
    font-weight: var(--weight-semi);
    color: var(--primary-700);
    margin: 0 0 1rem 0;
    line-height: var(--header-line-height);
  }

  .philosophy-callout p {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1rem;
    color: var(--text-body);
    line-height: var(--body-line-height);
    margin: 0 0 1rem 0;
    text-align: left;
  }

  .philosophy-callout p:last-child {
    margin-bottom: 0;
  }

  .philosophy-callout code {
    background: var(--surface-page);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: "Source Code Pro", monospace;
    font-size: 0.9rem;
    color: var(--primary-600);
    border: var(--border-thin) solid var(--border-primary);
  }

  .demo-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .demo-tabs {
    display: flex;
    gap: 0.5rem;
  }

  .tab-button {
    padding: 6px 8px;
    border: var(--border-thin) solid var(--border-action);
    background: var(--surface-page);
    color: var(--text-action);
    border-radius: 8px;
    cursor: pointer;
    font-family: "Source Sans 3", sans-serif;
    font-weight: var(--weight-medium);
    transition: var(--transition-bg-color), var(--transition-bd-color);
    outline: none;
  }

  .tab-button:hover {
    background: var(--surface-information);
    border-color: var(--border-action-hover);
    color: var(--text-action-hover);
  }

  .tab-button:focus-visible {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
  }

  .tab-button.active {
    background: var(--surface-action);
    color: var(--primary-50);
    border-color: var(--surface-action);
  }

  .view-controls {
    display: flex;
    gap: 0.5rem;
  }

  .view-button {
    padding: 6px 8px;
    border: var(--border-thin) solid var(--border-primary);
    background: var(--surface-page);
    color: var(--text-body);
    border-radius: 8px;
    cursor: pointer;
    font-family: "Source Sans 3", sans-serif;
    font-weight: var(--weight-medium);
    transition: var(--transition-bg-color), var(--transition-bd-color);
    outline: none;
  }

  .view-button:hover {
    background: var(--surface-hover);
    border-color: var(--secondary-400);
  }

  .view-button:focus-visible {
    outline: var(--border-med) solid var(--secondary-400);
    outline-offset: var(--border-extrathin);
  }

  .view-button.active {
    background: var(--secondary-500);
    color: var(--white);
    border-color: var(--secondary-500);
  }

  .demo-content {
    display: flex;
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .demo-panel {
    flex: 1;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 16px;
    overflow: hidden;
    background: var(--surface-page);
    display: flex;
    flex-direction: column;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .demo-panel h3 {
    margin: 0;
    padding: 0.75rem 1rem;
    font-family: "Montserrat", sans-serif;
    font-size: var(--h6-size);
    font-weight: var(--weight-semi);
    color: var(--text-body);
    border-bottom: var(--border-extrathin) solid var(--border-primary);
  }

  .markup-panel h3 {
    background: var(--primary-600);
    color: var(--primary-50);
  }

  .output-panel h3 {
    background: var(--secondary-600);
    color: var(--secondary-50);
  }

  .markup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: var(--border-extrathin) solid var(--border-primary);
    background: var(--primary-600);
    color: var(--primary-50);
  }

  .markup-header h3 {
    margin: 0;
    padding: 0;
    background: none;
    border: none;
  }

  .reset-button {
    background: transparent;
    border: none;
    padding: 0.25rem 0.5rem;
    font-family: "Source Sans 3", sans-serif;
    font-size: 0.75rem;
    font-weight: var(--weight-medium);
    color: var(--primary-100);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-thickness: 1px;
  }

  .reset-button:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--primary-50);
    text-decoration-thickness: 2px;
  }

  .reset-button:active {
    transform: translateY(1px);
  }

  .markup-content {
    padding: 1rem;
    font-family: "Source Code Pro", monospace;
    font-size: 0.875rem;
    line-height: var(--body-line-height);
    margin: 0;
    background: var(--surface-page);
    color: var(--text-body);
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    flex: 1;
  }

  .markup-content.editable {
    border: none;
    outline: none;
    resize: vertical;
    min-height: 200px;
    transition: box-shadow 0.2s ease;
  }

  .markup-content.editable:focus {
    box-shadow: inset 0 0 0 2px var(--primary-300);
  }

  .markup-content.editable::placeholder {
    color: var(--medium);
    font-style: italic;
  }

  .output-content {
    padding: 1rem;
    font-family: "Source Sans 3", sans-serif;
    line-height: var(--body-line-height);
    flex: 1;
  }

  .output-content .citation {
    color: #007acc;
    text-decoration: none;
  }

  .output-content .footnote {
    color: #007acc;
    text-decoration: none;
    font-size: 0.8rem;
    vertical-align: super;
  }

  .output-content .references {
    margin-top: 2rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }

  .output-content .footnotes {
    margin-top: 1.5rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
    font-size: 0.9rem;
  }

  /* Override RSM manuscriptwrapper padding when inside demo output panel */
  :deep(.output-content .manuscriptwrapper) {
    --side-padding: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    border-radius: 0 !important;
  }

  :deep(.output-content .manuscriptwrapper .manuscript) {
    padding: 0 !important;
    margin: 0 !important;
  }

  :deep(.output-content section.level-1) {
    margin-block: 0.5rem !important;
  }

  .demo-callouts {
    display: flex;
    gap: 2rem;
    margin-top: 1rem;
  }

  .demo-context {
    font-family: "Source Sans 3", sans-serif;
    font-style: italic;
    color: var(--medium);
    margin: 0;
    font-size: 0.875rem;
    flex: 1;
  }

  .demo-context-left {
    text-align: left;
  }

  .demo-context-right {
    text-align: right;
  }

  .benefits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .benefit-card {
    background: var(--surface-page);
    padding: 2rem;
    border-radius: 16px;
    border: var(--border-extrathin) solid var(--border-primary);
    box-shadow: var(--shadow-soft);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .benefit-card:hover {
    transform: translateY(-2px);
    border-color: var(--primary-400);
    box-shadow:
      var(--shadow-soft),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .benefit-card h3 {
    font-family: "Montserrat", sans-serif;
    font-size: var(--h5-size);
    font-weight: var(--weight-semi);
    color: var(--text-body);
    margin: 0 0 1rem 0;
    line-height: var(--header-line-height);
  }

  .benefit-card p {
    font-family: "Source Sans 3", sans-serif;
    color: var(--dark);
    line-height: var(--body-line-height);
    margin: 0;
  }

  .signup-content {
    max-width: 600px;
    margin: 0 auto 3rem auto;
    text-align: center;
  }

  .signup-subtitle {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    color: var(--medium);
    margin: 0 0 2rem 0;
    font-weight: var(--weight-medium);
  }

  .signup-form {
    text-align: left;
  }

  .form-group {
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-family: "Source Sans 3", sans-serif;
    font-weight: var(--weight-semi);
    color: var(--text-body);
    font-size: 1rem;
    line-height: 1.5rem;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 8px;
    font-family: "Source Sans 3", sans-serif;
    font-size: 1rem;
    background: transparent;
    color: var(--text-body);
    transition: var(--transition-bd-color);
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--border-action);
    background-color: var(--surface-page);
  }

  .checkbox-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    font-weight: var(--weight-regular) !important;
    cursor: pointer;
    font-family: "Source Sans 3", sans-serif;
    height: 28px;
  }

  .checkbox-input {
    width: auto;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }

  .other-tool {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 28px;
  }

  .other-tool .checkbox-label {
    margin-bottom: 0;
    flex-shrink: 0;
  }

  .other-input {
    flex: 1;
    margin-left: 0;
    padding: 0;
    font-size: 0.9rem;
    height: 28px;
    line-height: 1;
    box-sizing: border-box;
    padding: 0 0.5rem;
  }

  .other-input:disabled {
    background: #f5f5f5;
    color: #999;
  }

  .required-asterisk {
    color: var(--primary-600);
    font-weight: var(--weight-bold);
  }

  .cta-button {
    width: 100%;
    padding: 0.75rem 2rem;
    background: var(--surface-action);
    color: var(--primary-50);
    border: var(--border-thin) solid var(--surface-action);
    border-radius: 16px;
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    font-weight: var(--weight-semi);
    cursor: pointer;
    transition: var(--transition-bg-color), var(--transition-bd-color);
    box-shadow: var(--shadow-soft), var(--shadow-strong);
    outline: none;
  }

  .cta-button:hover:not(:disabled) {
    background: var(--surface-action-hover);
    border-color: var(--surface-action-hover);
  }

  .cta-button:focus-visible {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
  }

  .cta-button:disabled {
    background: var(--surface-disabled);
    border-color: var(--surface-disabled);
    color: var(--text-disabled);
    cursor: not-allowed;
    box-shadow: none;
  }

  .error-message {
    padding: 1rem;
    background: var(--red-50);
    border: var(--border-thin) solid var(--red-300);
    border-radius: 12px;
    color: var(--red-700);
    font-size: 0.95rem;
    margin-bottom: 1rem;
  }

  .thank-you-message {
    padding: 2rem;
    background: var(--surface-success);
    border-radius: 16px;
    border: var(--border-extrathin) solid var(--border-success);
    margin-bottom: 2rem;
  }

  .thank-you-message h3 {
    font-family: "Montserrat", sans-serif;
    font-size: var(--h4-size);
    font-weight: var(--weight-semi);
    color: var(--success-700);
    margin: 0 0 1rem 0;
  }

  .thank-you-message p {
    font-family: "Source Sans 3", sans-serif;
    color: var(--text-body);
    margin: 0;
    line-height: var(--body-line-height);
  }

  /* Submitted form styling */
  .form-submitted {
    opacity: 0.6;
    pointer-events: none;
  }

  .form-submitted .form-input,
  .form-submitted .form-textarea,
  .form-submitted .checkbox-input {
    background-color: var(--surface-disabled);
    border-color: var(--border-disabled);
    color: var(--text-disabled);
  }

  .faq-section::before {
    content: "";
    position: absolute;
    top: -1.5px;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
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

  .faq-grid {
    display: block;
    margin-top: 2rem;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .faq-item {
    border-bottom: 1px solid var(--border-primary);
    transition: var(--transition-bd-color);
  }

  .faq-item:last-child {
    border-bottom: none;
  }

  .faq-question {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: var(--transition-bg-color);
  }

  .faq-question:hover {
    background: var(--surface-hover);
  }

  .faq-question h3 {
    font-family: "Montserrat", sans-serif;
    font-size: 1.1rem;
    font-weight: var(--weight-semi);
    color: var(--text-body);
    margin: 0;
    line-height: 1.4;
    flex: 1;
  }

  .faq-chevron {
    width: 20px;
    height: 20px;
    color: var(--medium);
    transition:
      transform 0.3s ease,
      color 0.2s ease;
    flex-shrink: 0;
    margin-left: 1rem;
  }

  .faq-question:hover .faq-chevron {
    color: var(--primary-400);
  }

  .faq-chevron.open {
    transform: rotate(180deg);
  }

  .faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }

  .faq-answer.open {
    max-height: 200px;
  }

  .faq-answer p {
    font-family: "Source Sans 3", sans-serif;
    font-size: 0.95rem;
    color: var(--text-body);
    margin: 0;
    padding: 0 1.5rem 1.5rem 1.5rem;
    line-height: var(--body-line-height);
  }

  .faq-answer p a {
    color: var(--primary-600);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .faq-answer p a:hover {
    color: var(--primary-600);
    text-decoration: underline;
  }

  /* CLI Callout Section */
  .cli-callout-section {
    text-align: center;
  }

  .cli-callout-section::before {
    content: "";
    position: absolute;
    top: -1.5px;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
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

  .cli-callout-text {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    color: var(--text-body);
    line-height: var(--body-line-height);
    margin: 0;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .cli-callout-text a {
    color: var(--primary-600);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .cli-callout-text a:hover {
    color: var(--primary-700);
    text-decoration: underline;
  }

  .cli-callout-text code {
    background: var(--surface-page);
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-family: "Source Code Pro", monospace;
    font-size: 1rem;
    color: var(--primary-600);
    border: var(--border-thin) solid var(--border-primary);
    font-weight: var(--weight-medium);
  }

  /* Mobile Responsiveness */
  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    .hero-section {
      padding-top: calc(4rem + 4rem) !important;
      padding-bottom: 4rem !important;
    }

    .hero-title {
      font-size: 2.5rem;
    }

    .hero-subtitle {
      font-size: 1.1rem;
    }

    .screenshot-placeholder {
      height: 250px;
    }

    .placeholder-label {
      font-size: 0.9rem;
      padding: 0.75rem 1.5rem;
    }

    .rsm-demo-container {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .rsm-source-code {
      font-size: 0.75rem;
    }

    .demo-controls {
      flex-direction: column;
      align-items: stretch;
    }

    .demo-content {
      flex-direction: column;
    }

    .demo-callouts {
      flex-direction: column;
      gap: 1rem;
    }

    .demo-context-left,
    .demo-context-right {
      text-align: center;
    }

    .benefits-grid,
    .features-grid {
      grid-template-columns: 1fr;
    }

    .checkbox-group {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .other-tool {
      gap: 0.5rem;
    }

    .other-input {
      margin-top: 0;
    }
  }

  @media (max-width: 480px) {
    .hero-section,
    .demo-section,
    .benefits-section,
    .signup-section,
    .faq-section {
      padding: 2rem 0;
    }

    .hero-title {
      font-size: 1.75rem;
    }
  }

  /* Demo Loading and Error States */
  .output-container {
    position: relative;
  }

  .inline-loading {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    pointer-events: none;
    z-index: 10;
  }

  .inline-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-primary);
    border-top: 2px solid var(--primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    opacity: 0.8;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .demo-error {
    padding: 1rem;
    background: var(--warning-50);
    border: var(--border-thin) solid var(--warning-200);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .demo-error p {
    margin: 0.5rem 0;
    font-family: "Source Sans 3", sans-serif;
    font-size: 0.85rem;
    color: var(--warning-700);
    line-height: 1.4;
  }

  .demo-error p:first-child {
    margin-top: 0;
  }

  .demo-error p:last-child {
    margin-bottom: 0;
  }

  /* Transition Text */
  .transition-text {
    max-width: 800px;
    margin: 3rem auto 0;
    text-align: center;
    padding: 2rem;
    background: var(--surface-information);
    border-radius: 16px;
    border: var(--border-extrathin) solid var(--border-information);
  }

  .transition-text p {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    color: var(--text-body);
    line-height: var(--body-line-height);
    margin: 0;
    font-style: italic;
  }

  /* RSM Studio Features Section */
  .studio-intro {
    max-width: 800px;
    margin: 0 auto 3rem;
    text-align: center;
  }

  .studio-intro p {
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    color: var(--text-body);
    line-height: var(--body-line-height);
    margin: 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .feature-card {
    background: var(--surface-page);
    padding: 2rem;
    border-radius: 16px;
    border: var(--border-extrathin) solid var(--border-primary);
    box-shadow: var(--shadow-soft);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    border-color: var(--primary-400);
    box-shadow:
      var(--shadow-soft),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .feature-screenshot {
    height: 200px;
    background: var(--very-light);
    border-bottom: var(--border-extrathin) solid var(--border-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .screenshot-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-100) 0%, var(--secondary-100) 100%);
  }

  .placeholder-content {
    width: 80%;
    height: 80%;
    background: var(--surface-page);
    border-radius: 8px;
    box-shadow: var(--shadow-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }

  /* Feature mockup styles */
  .editor-mockup,
  .comment-mockup,
  .preview-mockup,
  .history-mockup {
    width: 100%;
    padding: 0.5rem;
  }

  .editor-header {
    background: var(--surface-action);
    color: var(--primary-50);
    padding: 0.25rem 0.5rem;
    border-radius: 4px 4px 0 0;
    font-size: 0.7rem;
    font-weight: var(--weight-medium);
  }

  .editor-content {
    background: var(--surface-page);
    padding: 0.5rem;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 0 0 4px 4px;
    position: relative;
  }

  .cursor {
    position: absolute;
    width: 2px;
    height: 12px;
    background: var(--primary-500);
    font-size: 0.6rem;
    color: var(--primary-700);
    font-weight: var(--weight-semi);
  }

  .cursor-1 {
    top: 0.5rem;
    left: 3rem;
  }

  .cursor-2 {
    top: 1.5rem;
    left: 5rem;
  }

  .text-line {
    font-family: "Source Code Pro", monospace;
    font-size: 0.7rem;
    margin: 0.25rem 0;
    color: var(--text-body);
  }

  .comment-mockup {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .document-text {
    background: var(--surface-page);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    border-left: 3px solid var(--primary-400);
  }

  .comment-thread {
    background: var(--surface-information);
    border-radius: 4px;
    padding: 0.5rem;
  }

  .comment {
    margin-bottom: 0.5rem;
  }

  .comment:last-child {
    margin-bottom: 0;
  }

  .comment-author {
    font-size: 0.6rem;
    font-weight: var(--weight-semi);
    color: var(--primary-600);
    margin-bottom: 0.25rem;
  }

  .comment-text {
    font-size: 0.7rem;
    color: var(--text-body);
  }

  .split-view {
    display: flex;
    gap: 0.5rem;
  }

  .editor-side,
  .preview-side {
    flex: 1;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .editor-side {
    background: var(--surface-page);
    border: var(--border-thin) solid var(--border-primary);
  }

  .preview-side {
    background: var(--very-light);
  }

  .code-line {
    font-family: "Source Code Pro", monospace;
    font-size: 0.7rem;
    margin: 0.25rem 0;
    color: var(--text-body);
  }

  .rendered-content h1 {
    font-size: 0.8rem;
    margin: 0 0 0.25rem 0;
    font-weight: var(--weight-semi);
  }

  .rendered-content p {
    font-size: 0.7rem;
    margin: 0;
  }

  .history-header {
    font-size: 0.7rem;
    font-weight: var(--weight-semi);
    color: var(--text-body);
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: var(--border-thin) solid var(--border-primary);
  }

  .history-entry {
    margin-bottom: 0.5rem;
    padding: 0.25rem;
    border-radius: 4px;
    background: var(--surface-hover);
  }

  .history-time {
    font-size: 0.6rem;
    color: var(--medium);
  }

  .history-author {
    font-size: 0.7rem;
    font-weight: var(--weight-medium);
    color: var(--text-body);
  }

  .history-change {
    font-size: 0.7rem;
    color: var(--dark);
  }

  .feature-card h3 {
    font-family: "Montserrat", sans-serif;
    font-size: var(--h5-size);
    font-weight: var(--weight-semi);
    color: var(--text-body);
    margin: 0 0 1rem 0;
    line-height: var(--header-line-height);
  }

  .feature-card p {
    font-family: "Source Sans 3", sans-serif;
    color: var(--dark);
    line-height: var(--body-line-height);
    margin: 0;
    font-size: 1rem;
  }

  .studio-cta {
    text-align: center;
    margin-top: 2rem;
  }

  .studio-cta-button {
    display: inline-block;
    padding: 0.75rem 2rem;
    background: var(--surface-action);
    color: var(--primary-50);
    border: var(--border-thin) solid var(--surface-action);
    border-radius: 16px;
    font-family: "Source Sans 3", sans-serif;
    font-size: 1.1rem;
    font-weight: var(--weight-semi);
    text-decoration: none;
    cursor: pointer;
    transition: var(--transition-bg-color), var(--transition-bd-color);
    box-shadow: var(--shadow-soft), var(--shadow-strong);
  }

  .studio-cta-button:hover {
    background: var(--surface-action-hover);
    border-color: var(--surface-action-hover);
  }
</style>
