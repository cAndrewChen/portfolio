// Everything a visitor reads lives here. Edit freely: nothing in the animation depends on it.
// Which destination shows which section is set by `section:` in journey/journey.ts.

export const site = {
  name: 'Andrew Chen',
  intro: 'Computer Engineering at UC San Diego, interested in software engineering, robotics, ML and AI.',
  resume: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/resume.pdf`, // put the file in /public
  email: 'you@example.com',
}

export type Project = {
  title: string
  kind: 'Software' | 'Robotics' | 'Research'
  summary: string
  stack: string[]
  links?: { label: string; href: string }[] // GitHub, live demo, case study, paper, video…
  media?: { src: string; alt: string } // screenshot in /public; a .mp4 or .webm plays as a video
}

export type Section = { title: string; hanzi: string; body?: string; projects?: Project[] }

export const sections: Record<string, Section> = {
  work: {
    title: 'Work',
    hanzi: '作品',
    body: 'Software, robotics and research, in one place.',
    projects: [
      {
        title: 'Software project title',
        kind: 'Software',
        summary: 'Placeholder. One or two sentences on what it does, your part in it, and what came of it.',
        stack: ['TypeScript', 'React'],
        links: [{ label: 'GitHub', href: '#' }, { label: 'Live demo', href: '#' }],
      },
      {
        title: 'Robotics project title',
        kind: 'Robotics',
        summary: 'Placeholder. The machine, the problem it solved, and the result you measured.',
        stack: ['ROS 2', 'C++', 'Python'],
        links: [{ label: 'Case study', href: '#' }, { label: 'Video', href: '#' }],
      },
      {
        title: 'Research title',
        kind: 'Research',
        summary: 'Placeholder. The question, the method, and the finding.',
        stack: ['PyTorch'],
        links: [{ label: 'Paper', href: '#' }],
      },
    ],
  },
  // Not yet assigned to a destination.
  about: { title: 'About', hanzi: '自述', body: 'Placeholder.' },
  experience: { title: 'Experience', hanzi: '经历', body: 'Placeholder.' },
  contact: { title: 'Contact', hanzi: '联络', body: 'Placeholder.' },
}
