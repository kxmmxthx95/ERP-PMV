export type FractionMode = 'simple' | 'mixed' | 'nested';

export function escapeFractionText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStackedBlock(num: string, den: string, fontSize = '0.88em'): string {
  const n = escapeFractionText(num.trim());
  const d = escapeFractionText(den.trim());
  if (!n || !d) return '';

  return (
    '<span style="display:inline-block;text-align:center;line-height:1;vertical-align:middle;">' +
    `<span style="display:block;border-bottom:1px solid currentColor;padding:0 4px 1px;font-size:${fontSize};line-height:1.15;">${n}</span>` +
    `<span style="display:block;padding:0 4px;font-size:${fontSize};line-height:1.15;">${d}</span>` +
    '</span>'
  );
}

/** เศษส่วน: a/b */
export function buildFractionHtml(numerator: string, denominator: string): string {
  const block = buildStackedBlock(numerator, denominator);
  return block
    ? `<span contenteditable="false" style="display:inline-block;vertical-align:middle;margin:0 3px;font-family:inherit;">${block}</span>&nbsp;`
    : '';
}

/** เศษคละ: จำนวนเต็ม + เศษส่วน เช่น 2 1/3 */
export function buildMixedFractionHtml(whole: string, numerator: string, denominator: string): string {
  const w = escapeFractionText(whole.trim());
  const block = buildStackedBlock(numerator, denominator);
  if (!w || !block) return '';

  return (
    '<span contenteditable="false" style="display:inline-flex;align-items:center;vertical-align:middle;margin:0 3px;font-family:inherit;gap:4px;">' +
    `<span style="font-size:0.95em;line-height:1;">${w}</span>${block}</span>&nbsp;`
  );
}

/** เศษซ้อน: เศษส่วนซ้อนเศษส่วน */
export function buildNestedFractionHtml(
  numNumerator: string,
  numDenominator: string,
  denNumerator: string,
  denDenominator: string,
): string {
  const top = buildStackedBlock(numNumerator, numDenominator, '0.82em');
  const bottom = buildStackedBlock(denNumerator, denDenominator, '0.82em');
  if (!top || !bottom) return '';

  const nestedBar =
    'display:block;border-top:1.5px solid currentColor;margin:3px -10px;width:calc(100% + 20px);';

  return (
    '<span contenteditable="false" style="display:inline-block;text-align:center;vertical-align:middle;margin:0 3px;line-height:1;font-family:inherit;">' +
    `<span style="display:block;padding:0 1px;">${top}</span>` +
    `<span style="${nestedBar}"></span>` +
    `<span style="display:block;padding:0 1px;">${bottom}</span></span>&nbsp;`
  );
}

function fractionSlot(part: string, role: 'num' | 'den' | 'whole'): string {
  return (
    `<span contenteditable="true" spellcheck="false" data-rte-fraction-part="${part}" ` +
    `class="rte-fraction-slot rte-fraction-${role}"></span>`
  );
}

function fractionStack(numPart: string, denPart: string, small = false): string {
  const sm = small ? ' rte-fraction-sm' : '';
  return `<span class="rte-fraction-stack${sm}">${fractionSlot(numPart, 'num')}${fractionSlot(denPart, 'den')}</span>`;
}

/** แทรกเศษส่วนแบบ Word — กล่องว่างให้พิมพ์ในตัวแก้ไขได้เลย */
export function buildFractionTemplateHtml(mode: FractionMode, options?: { superscript?: boolean }): string {
  const supClass = options?.superscript ? ' rte-fraction-sup' : '';
  switch (mode) {
    case 'mixed':
      return (
        `<span contenteditable="false" class="rte-fraction-wrap rte-fraction-mixed${supClass}" data-rte-fraction="mixed">` +
        `${fractionSlot('whole', 'whole')}${fractionStack('num', 'den')}</span>\u200B`
      );
    case 'nested':
      return (
        `<span contenteditable="false" class="rte-fraction-wrap rte-fraction-nested${supClass}" data-rte-fraction="nested">` +
        `<span class="rte-fraction-nested-top">${fractionStack('num-num', 'num-den', true)}</span>` +
        '<span class="rte-fraction-nested-bar"></span>' +
        `<span class="rte-fraction-nested-bottom">${fractionStack('den-num', 'den-den', true)}</span></span>\u200B`
      );
    default:
      return (
        `<span contenteditable="false" class="rte-fraction-wrap${supClass}" data-rte-fraction="simple">` +
        `${fractionStack('num', 'den')}</span>\u200B`
      );
  }
}

export function isInsideSuperscript(node: Node | null, root: HTMLElement): boolean {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.tagName === 'SUP') return true;
    current = current.parentNode;
  }
  return false;
}

export function isValidFractionInput(numerator: string, denominator: string): boolean {
  return numerator.trim().length > 0 && denominator.trim().length > 0;
}

export function isValidMixedFractionInput(whole: string, numerator: string, denominator: string): boolean {
  return whole.trim().length > 0 && isValidFractionInput(numerator, denominator);
}

export function isValidNestedFractionInput(
  numNumerator: string,
  numDenominator: string,
  denNumerator: string,
  denDenominator: string,
): boolean {
  return (
    isValidFractionInput(numNumerator, numDenominator)
    && isValidFractionInput(denNumerator, denDenominator)
  );
}

export const FRACTION_EDITOR_CSS = `
  .rte-fraction {
    display: inline-block;
    text-align: center;
    vertical-align: middle;
    margin: 0 3px;
    line-height: 1;
    font-family: inherit;
  }
  .rte-fraction-num {
    display: block;
    border-bottom: 1px solid currentColor;
    padding: 0 4px 1px;
    font-size: 0.88em;
    line-height: 1.15;
  }
  .rte-fraction-den {
    display: block;
    padding: 0 4px;
    font-size: 0.88em;
    line-height: 1.15;
  }
  .rte-fraction-mixed {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    vertical-align: middle;
  }
  .rte-fraction-whole {
    font-size: 0.95em;
    line-height: 1;
  }
  .rte-fraction-nested {
    display: inline-block;
    text-align: center;
    vertical-align: middle;
    line-height: 1;
  }
  .rte-fraction-nested-bar {
    display: block;
    border-top: 1.5px solid currentColor;
    margin: 3px -10px;
    width: calc(100% + 20px);
  }
  .rte-fraction-sm .rte-fraction-num,
  .rte-fraction-sm .rte-fraction-den {
    font-size: 0.82em;
    padding-left: 3px;
    padding-right: 3px;
  }
`;

export function getFractionDialogTitle(mode: FractionMode): string {
  switch (mode) {
    case 'mixed': return 'แทรกเศษคละ';
    case 'nested': return 'แทรกเศษซ้อน';
    default: return 'แทรกเศษส่วน';
  }
}
