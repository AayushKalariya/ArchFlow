export interface MockProject {
  id: string
  name: string
  slug: string
  isOwner: boolean
}

export const MOCK_PROJECTS: MockProject[] = [
  { id: '1', name: 'E-Commerce Platform', slug: 'e-commerce-platform', isOwner: true },
  { id: '2', name: 'Auth Service', slug: 'auth-service', isOwner: true },
  { id: '3', name: 'Analytics Dashboard', slug: 'analytics-dashboard', isOwner: false },
]
