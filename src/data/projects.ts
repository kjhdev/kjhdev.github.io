export type ProjectLang = 'ko' | 'en';

type LocalizedText = Record<ProjectLang, string>;

export interface ProjectDefinition {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  status: LocalizedText;
}

export const projects: ProjectDefinition[] = [
  {
    id: 'stock-market-daily-briefing',
    title: {
      ko: '주식시장 데일리 브리핑 시스템',
      en: 'Stock Market Daily Briefing System',
    },
    description: {
      ko: '국내 주식시장 데이터를 수집하고 정리해 매일 브리핑을 자동으로 생성·배포하는 시스템을 만드는 과정을 기록합니다.',
      en: 'A project series documenting how to collect Korean stock-market data and automatically generate and publish a daily market briefing.',
    },
    status: {
      ko: '진행 중',
      en: 'In progress',
    },
  },
];

export function getProjectById(id: string) {
  return projects.find((project) => project.id === id);
}
