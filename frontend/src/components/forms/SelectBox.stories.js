import SelectBox from "./SelectBox.vue";
import { action } from "@storybook/addon-actions";

export default {
  title: "Forms/SelectBox",
  component: SelectBox,
  tags: ["autodocs"],
  argTypes: {
    modelValue: {
      control: "text",
      description: "The currently selected value (v-model).",
    },
    direction: {
      control: "select",
      options: ["row", "column"],
      description: "Layout direction for the selected label and dropdown trigger.",
    },
    options: {
      control: "object",
      description: "An array of options. Can be strings/numbers or objects { value, label }.",
    },
    label: {
      control: "text",
      description: "Optional label text displayed above the select control.",
    },
    "update:modelValue": { action: "update:modelValue" },
  },
  args: {
    modelValue: "option1",
    direction: "row",
    options: ["option1", "option2", "option3"],
  },
};

export const Default = {};

export const WithObjectOptions = {
  args: {
    modelValue: 2,
    options: [
      { value: 1, label: "First Item" },
      { value: 2, label: "Second Item" },
      { value: 3, label: "Third Item" },
    ],
  },
};

export const ColumnDirection = {
  args: {
    direction: "column",
    options: ["Small", "Medium", "Large"],
  },
};

export const InitialValue = {
  args: {
    modelValue: "option2",
    options: ["option1", "option2", "option3"],
  },
};

export const WithLabel = {
  args: {
    label: "Notification method",
    modelValue: "in-app",
    options: [
      { value: "in-app", label: "In-app only" },
      { value: "email", label: "Email only" },
      { value: "both", label: "Both in-app and email" },
    ],
  },
};

export const EventHandling = {
  args: {
    "update:modelValue": action("value-changed"),
  },
};
