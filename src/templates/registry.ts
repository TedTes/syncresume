import { template as academic } from "./definitions/academic";
import { template as alto } from "./definitions/alto";
import { template as anchor } from "./definitions/anchor";
import { template as arctic } from "./definitions/arctic";
import { template as beryl } from "./definitions/beryl";
import { template as brine } from "./definitions/brine";
import { template as carbon } from "./definitions/carbon";
import { template as cedar } from "./definitions/cedar";
import { template as depot } from "./definitions/depot";
import { template as dusk } from "./definitions/dusk";
import { template as glyph } from "./definitions/glyph";
import { template as jade } from "./definitions/jade";
import { template as ledger } from "./definitions/ledger";
import { template as loft } from "./definitions/loft";
import { template as mist } from "./definitions/mist";
import { template as onyx } from "./definitions/onyx";
import { template as petal } from "./definitions/petal";
import { template as prism } from "./definitions/prism";
import { template as quartz } from "./definitions/quartz";
import { template as ruby } from "./definitions/ruby";
import { template as solar } from "./definitions/solar";
import { template as stark } from "./definitions/stark";
import { template as tropic } from "./definitions/tropic";
import { template as arc } from "./definitions/arc";
import { template as bronze } from "./definitions/bronze";
import { template as atsSimple } from "./definitions/ats-simple";
import { template as block } from "./definitions/block";
import { template as card } from "./definitions/card";
import { template as chalk } from "./definitions/chalk";
import { template as chapter } from "./definitions/chapter";
import { template as classic } from "./definitions/classic";
import { template as clean } from "./definitions/clean";
import { template as cobalt } from "./definitions/cobalt";
import { template as compact } from "./definitions/compact";
import { template as copper } from "./definitions/copper";
import { template as crest } from "./definitions/crest";
import { template as crisp } from "./definitions/crisp";
import { template as dash } from "./definitions/dash";
import { template as deco } from "./definitions/deco";
import { template as editorial } from "./definitions/editorial";
import { template as ember } from "./definitions/ember";
import { template as executive } from "./definitions/executive";
import { template as flow } from "./definitions/flow";
import { template as flux } from "./definitions/flux";
import { template as forest } from "./definitions/forest";
import { template as frost } from "./definitions/frost";
import { template as gradient } from "./definitions/gradient";
import { template as grain } from "./definitions/grain";
import { template as grove } from "./definitions/grove";
import { template as herald } from "./definitions/herald";
import { template as impact } from "./definitions/impact";
import { template as ink } from "./definitions/ink";
import { template as layer } from "./definitions/layer";
import { template as leadership } from "./definitions/leadership";
import { template as linen } from "./definitions/linen";
import { template as metro } from "./definitions/metro";
import { template as minimal } from "./definitions/minimal";
import { template as mint } from "./definitions/mint";
import { template as modern } from "./definitions/modern";
import { template as moss } from "./definitions/moss";
import { template as navy } from "./definitions/navy";
import { template as nordic } from "./definitions/nordic";
import { template as ocean } from "./definitions/ocean";
import { template as outline } from "./definitions/outline";
import { template as peak } from "./definitions/peak";
import { template as pearl } from "./definitions/pearl";
import { template as plum } from "./definitions/plum";
import { template as pillar } from "./definitions/pillar";
import { template as portfolio } from "./definitions/portfolio";
import { template as product } from "./definitions/product";
import { template as retro } from "./definitions/retro";
import { template as river } from "./definitions/river";
import { template as rose } from "./definitions/rose";
import { template as ruled } from "./definitions/ruled";
import { template as sage } from "./definitions/sage";
import { template as sand } from "./definitions/sand";
import { template as scout } from "./definitions/scout";
import { template as serif } from "./definitions/serif";
import { template as shadow } from "./definitions/shadow";
import { template as shore } from "./definitions/shore";
import { template as sidebar } from "./definitions/sidebar";
import { template as signal } from "./definitions/signal";
import { template as slate } from "./definitions/slate";
import { template as smoke } from "./definitions/smoke";
import { template as spark } from "./definitions/spark";
import { template as split } from "./definitions/split";
import { template as startup } from "./definitions/startup";
import { template as steel } from "./definitions/steel";
import { template as stripe } from "./definitions/stripe";
import { template as teak } from "./definitions/teak";
import { template as technical } from "./definitions/technical";
import { template as terra } from "./definitions/terra";
import { template as timeline } from "./definitions/timeline";
import { template as typewriter } from "./definitions/typewriter";
import { template as vapor } from "./definitions/vapor";
import { template as verso } from "./definitions/verso";
import { template as zen } from "./definitions/zen";
import { orderSectionsForTemplate } from "./shared/orderSections";
import type {
  ResumeTemplateConfig,
  ResumeTemplateDefinition,
  ResumeTemplateId,
} from "./shared/types";

export const DEFAULT_TEMPLATE_ID: ResumeTemplateId = "ats-simple";

export const RESUME_TEMPLATE_DEFINITIONS = [
  atsSimple,
  classic,
  modern,
  crisp,
  compact,
  minimal,
  executive,
  leadership,
  editorial,
  academic,
  sidebar,
  portfolio,
  timeline,
  metro,
  technical,
  product,
  startup,
  split,
  typewriter,
  gradient,
  nordic,
  zen,
  deco,
  impact,
  stripe,
  frost,
  terra,
  card,
  serif,
  ruled,
  pillar,
  retro,
  block,
  outline,
  navy,
  layer,
  arc,
  clean,
  spark,
  shore,
  grove,
  smoke,
  slate,
  ember,
  sage,
  rose,
  steel,
  teak,
  ink,
  pearl,
  cobalt,
  mint,
  bronze,
  shadow,
  dash,
  flow,
  anchor,
  plum,
  ocean,
  forest,
  sand,
  copper,
  signal,
  verso,
  chapter,
  linen,
  herald,
  chalk,
  peak,
  river,
  alto,
  scout,
  crest,
  flux,
  moss,
  vapor,
  grain,
  quartz,
  onyx,
  ruby,
  jade,
  prism,
  depot,
  cedar,
  mist,
  tropic,
  stark,
  dusk,
  ledger,
  solar,
  arctic,
  brine,
  petal,
  loft,
  glyph,
  beryl,
  carbon,
] satisfies ResumeTemplateDefinition[];

export const RESUME_TEMPLATES = RESUME_TEMPLATE_DEFINITIONS.map(toTemplateConfig);

export function getResumeTemplateDefinition(templateId: string): ResumeTemplateDefinition {
  return (
    RESUME_TEMPLATE_DEFINITIONS.find((template) => template.id === templateId) ??
    RESUME_TEMPLATE_DEFINITIONS[0]
  );
}

export function getResumeTemplate(templateId: string): ResumeTemplateConfig {
  return toTemplateConfig(getResumeTemplateDefinition(templateId));
}

export function normalizeResumeTemplateId(templateId: string | null | undefined): ResumeTemplateId {
  return RESUME_TEMPLATE_DEFINITIONS.some((template) => template.id === templateId)
    ? (templateId as ResumeTemplateId)
    : DEFAULT_TEMPLATE_ID;
}

function toTemplateConfig(template: ResumeTemplateDefinition): ResumeTemplateConfig {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    isAtsSafe: template.isAtsSafe,
    density: template.density,
    className: template.className,
    thumbnailClassName: template.thumbnailClassName,
    renderer: template.renderer,
    sectionOrder: template.sectionOrder,
    pdf: template.pdf,
  };
}

export { orderSectionsForTemplate };
export type {
  ResumeTemplateConfig as ResumeTemplate,
  ResumeTemplateDefinition,
  ResumeTemplateId,
  ResumeTemplateRenderer,
} from "./shared/types";
