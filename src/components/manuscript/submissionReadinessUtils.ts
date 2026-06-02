import type { ManuscriptSection } from './types';

export function isSubmissionReady(sections: ManuscriptSection[]): boolean {
  const coreIds = [
    'title',
    'authors',
    'corresponding',
    'abstract',
    'keywords',
    'introduction',
    'methods',
    'results',
    'discussion',
    'conclusion',
    'references',
  ];

  return coreIds.every((id) => {
    const section = sections.find((sec) => sec.id === id);
    return section && section.content.trim().length > 10;
  });
}
