<script>
  import { h, useTemplateRef } from "vue";
  import FeedbackIcon from "./FeedbackIcon.vue";

  // Simple hash function for generating keys
  const hashString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  };

  export default {
    name: "Manuscript",

    props: {
      htmlString: {
        type: String,
        required: true,
      },
      settings: {
        type: Object,
        default: () => {
          return {
            background: "var(--surface-page)",
            fontSize: "16px",
            lineHeight: "1.5",
            fontFamily: "'Source Sans 3'",
            marginWidth: "16px",
          };
        },
      },
    },

    emits: ["mounted-at"],

    setup(props, { expose }) {
      const mountPointRef = useTemplateRef("mountPointRef");
      expose({ mountPoint: mountPointRef });

      const makeRenderFn = (htmlString) => {
        const createVNode = (node) => {
          // Handle text nodes
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
          }

          // Handle element nodes
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Extract attributes
            const data = {};
            const attrs = {};
            const compProps = {};

            // Check if this is a div with a class that should be replaced
            const replacementComponent = null;
            let isHrInfo = false;

            if (node.tagName.toLowerCase() === "div" && node.hasAttribute("class")) {
              const classNames = node.getAttribute("class").split(/\s+/).filter(Boolean);

              // Check for hr-info class
              if (classNames.includes("hr-info")) {
                isHrInfo = true;
              }
            }

            Array.from(node.attributes || []).forEach((attr) => {
              // Handle event handlers (on*)
              if (attr.name.startsWith("on") && attr.name.length > 2) {
                const eventName = attr.name.substring(2).toLowerCase();
                attrs[attr.name] = attr.value; // Keep as attribute since we can't eval
              }
              // Handle style attribute
              else if (attr.name === "style") {
                const styleObj = {};
                attr.value.split(";").forEach((style) => {
                  const [prop, val] = style.split(":");
                  if (prop && val) {
                    // Convert kebab-case to camelCase for style properties
                    const camelProp = prop
                      .trim()
                      .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                    styleObj[camelProp] = val.trim();
                  }
                });
                data.style = styleObj;
              }
              // Handle class attribute
              else if (attr.name === "class") {
                data.class = attr.value.split(/\s+/).filter(Boolean);
              }
              // Handle misc. attributes that need no processing
              else if (["id", "href", "data-nodeid", "tabindex"].includes(attr.name)) {
                data[attr.name] = attr.value;
              }
              // Handle other attributes
              else {
                attrs[attr.name] = attr.value;
              }
            });

            if (Object.keys(attrs).length) {
              data.attrs = attrs;
            }

            // Key math elements to force Vue replacement when document changes
            const isMathElement =
              (node.tagName.toLowerCase() === "span" && node.classList?.contains("math")) ||
              (node.tagName.toLowerCase() === "div" && node.classList?.contains("mathblock"));
            if (isMathElement) {
              data.key = `math-${hashString(node.textContent)}-${hashString(htmlString)}`;
            }

            // Get child nodes recursively
            const children = Array.from(node.childNodes)
              .map(createVNode)
              .filter((vnode) => vnode !== null && vnode !== "");

            // If this is hr-info, append FeedbackIcon to children
            if (isHrInfo) {
              children.push(h(FeedbackIcon));
            }

            return h(node.tagName.toLowerCase(), data, children.length ? children : undefined);
          }

          // Skip comment nodes and other node types
          return null;
        };

        // Process HTML string
        const parser = new DOMParser();
        const dom = parser.parseFromString(htmlString, "text/html");
        const bodyContent = Array.from(dom.body.childNodes)
          .map(createVNode)
          .filter((vnode) => vnode !== null && vnode !== "");

        // Attach a ref to the root node -- and remember to return a render function
        return () => h("div", { ref: "mountPointRef" }, bodyContent);
      };

      return () => makeRenderFn(props.htmlString)();
    },
  };
</script>

<style>
  /* Overwrite RSM's CSS but be CAREFUL!!! */
  .manuscriptwrapper {
    overflow: visible;

    /* The background color comes from the user's choice within the settings overlay */
    background-color: v-bind(settings.background) !important;
    font-size: v-bind(settings.fontSize) !important;
    line-height: v-bind(settings.lineHeight) !important;
    font-family: v-bind(settings.fontFamily) !important;
    padding: 0 v-bind(settings.marginWidth) 0 v-bind(settings.marginWidth) !important;

    /* Overwrite size and whitespace */
    margin: 0 !important;
    max-width: unset !important;
    padding-bottom: 48px !important;
    border-radius: 0px !important;

    & section.level-1 {
      margin-block: 0px !important;
    }

    /* Patches - for some reason the RSM CSS is broken? */
    & .hr .hr-border-zone .hr-border-dots .icon.dots {
      padding-bottom: 0 !important;
    }

    & .hr .hr-collapse-zone .hr-collapse .icon.collapse {
      padding-bottom: 0 !important;
    }
  }
</style>
