import { config } from "./config";
import { renderDocx } from "./docx";
import { Preview } from "./Preview";
import type { ResumeTemplateDefinition } from "../../shared/types";

export const template = {
  ...config,
  Preview,
  renderDocx,
} satisfies ResumeTemplateDefinition;
