import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  guideSidebar: [
    'intro',
    {
      type: 'category',
      label: 'User Guide',
      collapsed: false,
      items: [
        'user-guide/authentication',
        'user-guide/projects',
        'user-guide/kanban-board',
        'user-guide/backlog',
        'user-guide/sprints',
        'user-guide/tickets',
      ],
    },
  ],
  apiSidebar: [
    {
      type: 'category',
      label: 'API Reference',
      collapsed: false,
      items: [
        'api-reference/overview',
        'api-reference/authentication',
        'api-reference/projects',
        'api-reference/tickets',
        'api-reference/sprints',
      ],
    },
  ],
}

export default sidebars
