import type { ResumeDocument } from "./schema";

export const DEFAULT_TEMPLATE_PREVIEW_DOCUMENT: ResumeDocument = {
  id: "default-template-preview",
  title: "Joe Doe sample resume",
  sections: [
    {
      id: "sample-contact",
      type: "contact",
      title: "Contact",
      content: "JOE DOE\nToronto, ON | joe.doe@email.com | linkedin.com/in/joedoe | github.com/joedoe",
      order: 0,
    },
    {
      id: "sample-summary",
      type: "summary",
      title: "Professional Summary",
      content:
        "Product-minded software engineer building reliable web platforms, data workflows, and cloud services for growing teams.",
      order: 1,
    },
    {
      id: "sample-skills",
      type: "skills",
      title: "Technical Skills",
      content: "TypeScript, React, Node.js, Python, AWS, SQL, REST APIs, CI/CD",
      order: 2,
    },
    {
      id: "sample-experience",
      type: "experience",
      title: "Experience",
      content:
        "Senior Software Engineer | Acme Systems | 2022 - Present\n- Led platform improvements that reduced manual operations and improved release reliability.\n- Built customer-facing dashboards, API integrations, and automated reporting workflows.",
      order: 3,
    },
    {
      id: "sample-education",
      type: "education",
      title: "Education",
      content: "B.S. Computer Science | University of Toronto",
      order: 4,
    },
  ],
};
