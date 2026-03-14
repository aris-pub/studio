import MultiSelectTags from "./MultiSelectTags.vue";
import { action } from "@storybook/addon-actions";
import { ref, reactive } from "vue";

// Mock tags data
const mockTags = [
  { id: 1, name: "Frontend", color: "blue" },
  { id: 2, name: "Backend", color: "green" },
  { id: 3, name: "Critical", color: "red" },
  { id: 4, name: "Design", color: "purple" },
  { id: 5, name: "Testing", color: "orange" },
  { id: 6, name: "Documentation", color: "blue" },
  { id: 7, name: "Bug Fix", color: "red" },
  { id: 8, name: "Feature", color: "green" },
];

// Mock file data
const mockFile = {
  id: 123,
  name: "important-document.pdf",
  tags: [mockTags[0], mockTags[2]], // Frontend and Critical
};

// Create mock fileStore
const createMockFileStore = (initialTags = mockTags) => {
  const store = reactive({
    tags: [...initialTags],
    createTag: (name) => {
      const newTag = {
        id: Date.now(),
        name,
        color: ["blue", "green", "red", "purple", "orange"][Math.floor(Math.random() * 5)],
      };
      store.tags.push(newTag);
      action("createTag")(newTag);
      return newTag;
    },
    toggleFileTag: (file, tagId) => {
      const tag = store.tags.find((t) => t.id === tagId);
      action("toggleFileTag")(file, tag);

      if (file.tags.some((t) => t.id === tagId)) {
        file.tags = file.tags.filter((t) => t.id !== tagId);
      } else {
        file.tags.push(tag);
      }
    },
  });

  return { value: store };
};

export default {
  title: "Tags/MultiSelectTags",
  component: MultiSelectTags,
  tags: ["autodocs"],
  argTypes: {
    file: {
      control: "object",
      description: "File object to associate tags with (null for filter context)",
    },
    icon: {
      control: "select",
      options: ["Tag", "Filter", "Hash", "Bookmark"],
      description: "Icon for the trigger button",
    },
    modelValue: {
      control: "object",
      description: "Array of currently selected tags (v-model)",
    },
  },
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        const fileStore = createMockFileStore();
        return {
          fileStore,
        };
      },
      provide() {
        return {
          fileStore: this.fileStore,
        };
      },
      template: "<story />",
    }),
  ],
  args: {
    file: null,
    icon: "Tag",
    modelValue: [],
  },
};

export const FilterContext = {
  render: (args) => ({
    components: { MultiSelectTags },
    setup() {
      const selectedTags = ref(args.modelValue || []);
      return { args, selectedTags };
    },
    template: `
      <div style="max-width: 400px;">
        <h3>Filter Context (No File)</h3>
        <p>Select tags to filter content:</p>
        
        <MultiSelectTags
          v-model="selectedTags"
          :icon="args.icon"
        />
        
        <div v-if="selectedTags.length > 0" style="margin-top: 20px;">
          <h4>Selected Filter Tags:</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span
              v-for="tag in selectedTags"
              :key="tag.id"
              :style="{
                background: tag.color === 'blue' ? '#2196f3' : 
                           tag.color === 'green' ? '#4caf50' :
                           tag.color === 'red' ? '#f44336' :
                           tag.color === 'purple' ? '#9c27b0' : '#ff9800',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px'
              }"
            >
              {{ tag.name }}
            </span>
          </div>
        </div>
      </div>
    `,
  }),
};

export const FileTagging = {
  args: {
    file: mockFile,
    icon: "Tag",
  },
  render: (args) => ({
    components: { MultiSelectTags },
    setup() {
      const selectedTags = ref(args.modelValue || args.file?.tags || []);
      const fileData = ref({ ...args.file });

      return { args, selectedTags, fileData };
    },
    template: `
      <div style="max-width: 400px;">
        <h3>File Tagging Mode</h3>
        <p>Tag a specific file:</p>
        
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
          <div style="font-size: 24px;">📄</div>
          <div style="flex: 1;">
            <strong>{{ fileData.name }}</strong>
          </div>
          <MultiSelectTags
            :file="fileData"
            v-model="selectedTags"
            :icon="args.icon"
          />
        </div>
        
        <div v-if="selectedTags.length > 0">
          <h4>File Tags:</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span
              v-for="tag in selectedTags"
              :key="tag.id"
              :style="{
                background: tag.color === 'blue' ? '#2196f3' : 
                           tag.color === 'green' ? '#4caf50' :
                           tag.color === 'red' ? '#f44336' :
                           tag.color === 'purple' ? '#9c27b0' : '#ff9800',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px'
              }"
            >
              {{ tag.name }}
            </span>
          </div>
        </div>
      </div>
    `,
  }),
};

export const DifferentIcons = {
  render: () => ({
    components: { MultiSelectTags },
    setup() {
      const filterTags = ref([]);
      const hashTags = ref([]);
      const bookmarkTags = ref([]);

      return { filterTags, hashTags, bookmarkTags };
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 400px;">
        <div>
          <h4>Filter Icon</h4>
          <MultiSelectTags v-model="filterTags" icon="Filter" />
        </div>
        
        <div>
          <h4>Tag Icon (Default)</h4>
          <MultiSelectTags v-model="hashTags" icon="Tag" />
        </div>
        
        <div>
          <h4>Hash Icon</h4>
          <MultiSelectTags v-model="hashTags" icon="Hash" />
        </div>
        
        <div>
          <h4>Bookmark Icon</h4>
          <MultiSelectTags v-model="bookmarkTags" icon="Bookmark" />
        </div>
      </div>
    `,
  }),
};

export const TagCreation = {
  render: () => ({
    components: { MultiSelectTags },
    setup() {
      const selectedTags = ref([]);
      const createdTags = ref([]);

      return { selectedTags, createdTags };
    },
    template: `
      <div style="max-width: 400px;">
        <h3>Tag Creation Demo</h3>
        <p>Open the menu and click "new tag..." to create custom tags:</p>
        
        <MultiSelectTags v-model="selectedTags" />
        
        <div v-if="selectedTags.length > 0" style="margin-top: 20px;">
          <h4>Selected Tags ({{ selectedTags.length }}):</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span
              v-for="tag in selectedTags"
              :key="tag.id"
              :style="{
                background: tag.color === 'blue' ? '#2196f3' : 
                           tag.color === 'green' ? '#4caf50' :
                           tag.color === 'red' ? '#f44336' :
                           tag.color === 'purple' ? '#9c27b0' : '#ff9800',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }"
            >
              {{ tag.name }}
              <span v-if="tag.id > 1000" style="background: rgba(255,255,255,0.3); padding: '2px 4px'; borderRadius: '8px'; fontSize: '10px'">
                NEW
              </span>
            </span>
          </div>
        </div>
        
        <div style="margin-top: 20px; padding: 16px; background: #e7f3ff; border-radius: 8px;">
          <strong>Tag Creation:</strong><br>
          • Click "new tag..." at the bottom of the menu<br>
          • Type a name and press Enter<br>
          • New tags get random colors<br>
          • Tags are automatically added to your selection
        </div>
      </div>
    `,
  }),
};

export const MultipleFiles = {
  render: () => ({
    components: { MultiSelectTags },
    setup() {
      const files = ref([
        {
          id: 1,
          name: "frontend-guide.pdf",
          tags: [mockTags[0], mockTags[3]], // Frontend, Design
          selectedTags: ref([mockTags[0], mockTags[3]]),
        },
        {
          id: 2,
          name: "api-documentation.md",
          tags: [mockTags[1], mockTags[5]], // Backend, Documentation
          selectedTags: ref([mockTags[1], mockTags[5]]),
        },
        {
          id: 3,
          name: "bug-report.txt",
          tags: [mockTags[6]], // Bug Fix
          selectedTags: ref([mockTags[6]]),
        },
      ]);

      return { files };
    },
    template: `
      <div style="max-width: 500px;">
        <h3>Multiple Files Tagging</h3>
        <p>Manage tags for different files independently:</p>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div
            v-for="file in files"
            :key="file.id"
            style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;"
          >
            <div style="font-size: 20px;">
              {{ file.name.endsWith('.pdf') ? '📄' : file.name.endsWith('.md') ? '📝' : '📋' }}
            </div>
            <div style="flex: 1;">
              <strong>{{ file.name }}</strong>
              <div v-if="file.selectedTags.length > 0" style="margin-top: 4px;">
                <span
                  v-for="tag in file.selectedTags"
                  :key="tag.id"
                  :style="{
                    background: tag.color === 'blue' ? '#2196f3' : 
                               tag.color === 'green' ? '#4caf50' :
                               tag.color === 'red' ? '#f44336' :
                               tag.color === 'purple' ? '#9c27b0' : '#ff9800',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    marginRight: '4px'
                  }"
                >
                  {{ tag.name }}
                </span>
              </div>
            </div>
            <MultiSelectTags
              :file="file"
              v-model="file.selectedTags"
            />
          </div>
        </div>
      </div>
    `,
  }),
};

export const InteractiveWorkflow = {
  render: () => ({
    components: { MultiSelectTags },
    setup() {
      const workspaceFiles = ref([
        { id: 1, name: "project-proposal.docx", tags: [], selectedTags: ref([]) },
        { id: 2, name: "design-mockups.fig", tags: [], selectedTags: ref([]) },
        { id: 3, name: "development-notes.md", tags: [], selectedTags: ref([]) },
      ]);

      const filterTags = ref([]);
      const tagStats = ref({});

      // Update tag statistics
      const updateStats = () => {
        const stats = {};
        workspaceFiles.value.forEach((file) => {
          file.selectedTags.forEach((tag) => {
            stats[tag.name] = (stats[tag.name] || 0) + 1;
          });
        });
        tagStats.value = stats;
      };

      const filteredFiles = ref([]);

      // Filter files based on selected filter tags
      const updateFilteredFiles = () => {
        if (filterTags.value.length === 0) {
          filteredFiles.value = workspaceFiles.value;
        } else {
          filteredFiles.value = workspaceFiles.value.filter((file) => {
            return filterTags.value.some((filterTag) =>
              file.selectedTags.some((fileTag) => fileTag.id === filterTag.id)
            );
          });
        }
      };

      // Watch for changes
      workspaceFiles.value.forEach((file) => {
        file.selectedTags.value.$watch?.(() => {
          updateStats();
          updateFilteredFiles();
        });
      });

      return {
        workspaceFiles,
        filterTags,
        tagStats,
        filteredFiles,
        updateStats,
        updateFilteredFiles,
      };
    },
    template: `
      <div style="max-width: 700px;">
        <h3>Interactive Workspace Demo</h3>
        
        <div style="display: flex; gap: 24px;">
          <!-- Files Panel -->
          <div style="flex: 2;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <h4 style="margin: 0;">Files</h4>
              <span style="background: #e0e0e0; padding: '2px 8px'; borderRadius: '12px'; fontSize: '12px';">
                {{ filteredFiles.length }} shown
              </span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div
                v-for="file in workspaceFiles"
                :key="file.id"
                :style="{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: filteredFiles.includes(file) ? '#f9f9f9' : '#f0f0f0',
                  opacity: filteredFiles.includes(file) ? 1 : 0.6
                }"
              >
                <div style="font-size: 20px;">
                  {{ file.name.includes('proposal') ? '📄' : 
                     file.name.includes('design') ? '🎨' : '📝' }}
                </div>
                <div style="flex: 1;">
                  <strong>{{ file.name }}</strong>
                  <div v-if="file.selectedTags.length > 0" style="margin-top: 4px;">
                    <span
                      v-for="tag in file.selectedTags"
                      :key="tag.id"
                      :style="{
                        background: tag.color === 'blue' ? '#2196f3' : 
                                   tag.color === 'green' ? '#4caf50' :
                                   tag.color === 'red' ? '#f44336' :
                                   tag.color === 'purple' ? '#9c27b0' : '#ff9800',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontSize: '10px',
                        marginRight: '4px'
                      }"
                    >
                      {{ tag.name }}
                    </span>
                  </div>
                </div>
                <MultiSelectTags
                  :file="file"
                  v-model="file.selectedTags"
                  @update:model-value="updateStats(); updateFilteredFiles();"
                />
              </div>
            </div>
          </div>
          
          <!-- Sidebar -->
          <div style="flex: 1; border-left: 1px solid #eee; padding-left: 24px;">
            <div style="margin-bottom: 24px;">
              <h4>Filter Files</h4>
              <MultiSelectTags
                v-model="filterTags"
                icon="Filter"
                @update:model-value="updateFilteredFiles"
              />
              <p v-if="filterTags.length > 0" style="font-size: 12px; color: #666; margin-top: 8px;">
                Showing files with ALL selected tags
              </p>
            </div>
            
            <div v-if="Object.keys(tagStats).length > 0">
              <h4>Tag Usage</h4>
              <div style="font-size: 12px;">
                <div
                  v-for="(count, tagName) in tagStats"
                  :key="tagName"
                  style="display: flex; justify-content: space-between; margin-bottom: 4px;"
                >
                  <span>{{ tagName }}</span>
                  <span style="background: #e0e0e0; padding: '1px 6px'; borderRadius: '8px';">
                    {{ count }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
};
