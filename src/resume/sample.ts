import type { ResumeDocument } from "./schema";

export const DEFAULT_TEMPLATE_PREVIEW_DOCUMENT: ResumeDocument = {
  id: "default-template-preview",
  title: "John Doe software engineer sample resume",
  sections: [
    {
      id: "sample-contact",
      type: "contact",
      title: "Contact",
      content:
        "JOHN DOE\nToronto, ON | +1 (416) 555-0198 | john.doe@email.com | linkedin.com/in/johndoe | github.com/johndoe | johndoe.dev",
      order: 0,
    },
    {
      id: "sample-summary",
      type: "summary",
      title: "Professional Summary",
      content:
        "Software engineer with 8+ years of experience designing scalable web applications, backend services, and cloud-native platforms. Strong background in TypeScript, React, Node.js, Python, distributed systems, and production operations. Known for translating product requirements into reliable systems, improving developer workflows, and mentoring engineers through pragmatic architecture, testing, and release practices.",
      order: 1,
    },
    {
      id: "sample-skills",
      type: "skills",
      title: "Technical Skills",
      content:
        "Languages: TypeScript, JavaScript, Python, Java, SQL, Bash\nFrontend: React, Next.js, Vite, HTML5, CSS3, Tailwind CSS, Accessibility, Design Systems\nBackend: Node.js, Express, FastAPI, Spring Boot, REST APIs, GraphQL, WebSockets\nCloud and Data: AWS Lambda, ECS, S3, RDS, CloudWatch, PostgreSQL, Redis, Kafka, Docker\nQuality and Delivery: Jest, Playwright, CI/CD, Observability, Security Reviews, Agile Delivery",
      order: 2,
    },
    {
      id: "sample-experience",
      type: "experience",
      title: "Professional Experience",
      content:
        "Senior Software Engineer | Northstar Cloud | Toronto, ON | 2022 - Present\n- Led the redesign of a customer-facing workflow platform used by 40,000+ monthly users, improving task completion time by 28% and reducing support escalations by 19%.\n- Built TypeScript and Node.js services for event-driven document processing, integrating S3, Kafka, PostgreSQL, and serverless workers for high-volume background jobs.\n- Partnered with product and design teams to ship accessible React interfaces, reusable form patterns, and dashboard components across three product lines.\n- Improved API reliability by adding request tracing, structured logs, retry policies, and service-level dashboards, reducing production incident resolution time by 35%.\n- Mentored five engineers through architecture reviews, pairing sessions, testing strategy, and incremental migration plans.\n- Created deployment guardrails with GitHub Actions, automated smoke tests, feature flags, and rollback playbooks for safer weekly releases.\n\nSoftware Engineer | Acme Financial Systems | Toronto, ON | 2019 - 2022\n- Developed secure account onboarding and payment operations tools with React, Node.js, Java Spring Boot, PostgreSQL, and Redis.\n- Implemented role-based access controls, audit logging, and approval workflows that supported compliance reviews for enterprise clients.\n- Replaced manual reporting spreadsheets with automated data pipelines and scheduled exports, saving operations teams 12+ hours per week.\n- Refactored legacy UI modules into shared React components, improving consistency and reducing duplicate code across internal applications.\n- Collaborated with SRE partners to harden service monitoring, tune database indexes, and improve API latency for peak traffic periods.\n\nAssociate Software Developer | Maple Analytics | Waterloo, ON | 2017 - 2019\n- Built analytics dashboards for sales and customer success teams using JavaScript, Python, Flask, SQL, and Chart.js.\n- Integrated third-party CRM and billing APIs, normalizing customer data and improving reporting accuracy across business units.\n- Wrote unit and integration tests for critical data transforms, reducing regressions during monthly reporting cycles.\n- Documented onboarding guides, local development setup, and troubleshooting steps for new engineers joining the platform team.",
      order: 3,
    },
    {
      id: "sample-projects",
      type: "projects",
      title: "Selected Projects",
      content:
        "CareerOps Platform | React, Node.js, PostgreSQL, AWS\n- Built a resume tailoring and job tracking prototype that parses documents, maps sections into structured data, and renders ATS-safe templates.\n\nObservability Starter Kit | OpenTelemetry, CloudWatch, Grafana\n- Created a reusable logging and tracing package for service teams, standardizing correlation IDs, alert dashboards, and incident review metrics.\n\nResume Rendering Engine | TypeScript, DOCX, HTML, PDF\n- Designed a template renderer that separates canonical resume data from layout-specific preview and export logic.",
      order: 4,
    },
    {
      id: "sample-education",
      type: "education",
      title: "Education",
      content:
        "Bachelor of Science in Computer Science | University of Toronto | Toronto, ON | 2017\nRelevant coursework: Distributed Systems, Databases, Human-Computer Interaction, Software Engineering",
      order: 5,
    },
    {
      id: "sample-certifications",
      type: "certifications",
      title: "Certifications",
      content:
        "AWS Certified Developer - Associate | 2024\nCertified Kubernetes Application Developer | 2023\nProfessional Scrum Master I | 2022",
      order: 6,
    },
    {
      id: "sample-awards",
      type: "awards",
      title: "Awards and Leadership",
      content:
        "Engineering Excellence Award | Northstar Cloud | 2025\nRecognized for leading a cross-team reliability initiative and mentoring engineers through a major platform migration.\n\nInternal Tech Talks\nPresented sessions on API observability, pragmatic test coverage, and designing resilient background processing systems.",
      order: 7,
    },
    {
      id: "sample-languages",
      type: "languages",
      title: "Languages",
      content: "English (Fluent), French (Professional working proficiency)",
      order: 8,
    },
  ],
};
