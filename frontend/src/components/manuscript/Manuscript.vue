<script>
  import { h, useTemplateRef } from "vue";
  import { parseHtmlToVNodes } from "./parseHtmlToVNodes.js";

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

      return () => {
        const children = parseHtmlToVNodes(props.htmlString);
        return h("div", { ref: "mountPointRef" }, children);
      };
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
  }
</style>
