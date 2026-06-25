import { config } from "./config";
import { Preview } from "./Preview";
import { renderDocx } from "./docx";
export const template = { ...config, Preview, renderDocx };
