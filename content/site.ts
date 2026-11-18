// Everything a visitor reads lives here. Edit freely: nothing in the animation depends on it.
// Which destination shows which section is set by `section:` in journey/journey.ts.

export const site = {
  name: 'Andrew Chen',
  intro: 'Computer Engineering at UC San Diego, interested in software engineering, robotics, ML and AI.',
  resume: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/resume.pdf`, // put the file in /public
  email: 'you@example.com',
  github: 'https://github.com/cAndrewChen',
}

export type Project = {
  title: string
  kind?: string // small red line above the title
  summary: string
  stack?: string[]
  links?: { label: string; href: string }[] // GitHub, live demo, case study, paper, video…
  media?: { src: string; alt: string } // screenshot in /public; a .mp4 or .webm plays as a video
}

export type Section = { title: string; hanzi?: string; body?: string; projects?: Project[] }

export const sections: Record<string, Section> = {
  projects: {
    title: 'Projects',
    projects: [
      {
        title: 'Halo',
        kind: 'Software',
        summary: "Shows a first-timer what tonight's aurora will look like from where they are, where to stand and how to photograph it: one 0–50 score, a 360° sky, an hour-by-hour night and camera settings for their own phone or camera.",
        stack: ['JavaScript', 'Gemma', 'Gemini API'],
        links: [{ label: 'GitHub', href: 'https://github.com/cAndrewChen/hacktober-halo' }],
      },
      {
        title: 'GridRewind',
        kind: 'Software',
        summary: 'Replays any Formula 1 race since 2023 from the free OpenF1 API, with the cars moving round a map of the track, plus a live mode that records F1’s public timing feed through a small Node server.',
        stack: ['JavaScript', 'Node.js', 'OpenF1 API'],
        links: [{ label: 'GitHub', href: 'https://github.com/cAndrewChen/gridrewind' }],
      },
      {
        title: 'FRC Team 3647',
        kind: 'Robotics',
        summary: 'Head of Programming of the team. Wrote the subsystems (swerve drive, shooter, indexer, climb) and state machines grouping actions together. Used Limelight AprilTag pose estimation, weighting three cameras to fuse them into one pose estimate, and led and trained a team of five. Won the 2024 San Diego Regional, Port Hueneme Regional, and Battle at the Border.',
        stack: ['Java', 'WPILib', 'AdvantageKit', 'Limelight'],
      },
    ],
  },
  research: {
    title: 'Research',
    projects: [
      {
        title: 'Analysis of Interpretable Machine Learning Classifiers for Myocardial Infarction Detection Using 12-Lead ECG Features',
        kind: 'Medinformatics, 2026',
        summary: 'With Valentina L. Kouznetsova and Igor F. Tsigelny. Heart-rate-variability and waveform features from 12-lead ECGs, classified with interpretable models: Random Forest reached 87.4% accuracy, and about 84.5% on independent datasets. Published as Chutian Chen.',
        stack: ['Weka'],
        links: [{ label: 'Paper', href: 'https://doi.org/10.47852/bonviewMEDIN62029651' }],
      },
      {
        title: 'Looking for research opportunities',
        summary: 'Open to research positions in machine learning, AI and robotics.',
        links: [{ label: 'GitHub', href: site.github }],
      },
    ],
  },
  // Not yet assigned to a destination.
  about: { title: 'About', hanzi: '自述', body: 'Placeholder.' },
  experience: { title: 'Experience', hanzi: '经历', body: 'Placeholder.' },
  contact: { title: 'Contact', hanzi: '联络', body: 'Placeholder.' },
}
