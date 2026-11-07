/** Только реально используемый договор Reveal/DOM; внешние JSON остаются unknown. */
interface CourseRevealConfig {
  navigationMode?: string | undefined;
  showNotes?: boolean | string | undefined;
  view?: string | undefined;
  width?: number | string | undefined;
  height?: number | string | undefined;
  courseNav?: CourseNavigationOptions | false | undefined;
  'course-nav'?: CourseNavigationOptions | false | undefined;
}
interface CourseReveal {
  getConfig(): CourseRevealConfig;
  configure(config: Partial<CourseRevealConfig>): void;
  getRevealElement(): HTMLElement;
  getCurrentSlide(): HTMLElement | undefined;
  getSlides(): HTMLElement[];
  getIndices(slide: Element): { h: number; v?: number | undefined };
  slide(h: number, v?: number | undefined, f?: number | undefined): void;
  isSpeakerNotes(): boolean;
  isReady(): boolean;
  on(name: string, handler: () => void): void;
  off(name: string, handler: () => void): void;
  availableFragments(): { prev: boolean; next: boolean };
  prev(): void;
  next(): void;
  layout(): void;
  toggleOverview(show: boolean): void;
  getPlugin?(name: string): { open?: (() => void) | undefined } | undefined;
}
interface CourseNavLink { id?: string | undefined; text: string; href: string; current?: boolean | undefined; scope?: string | undefined }
interface CourseNavigationOptions {
  language?: 'ru' | 'en' | undefined;
  sidebar?: boolean | undefined;
  title?: string | undefined;
  links?: CourseNavLink[] | undefined;
  slideWidth?: number | string | undefined;
  slideHeight?: number | string | undefined;
}
interface CourseGroupingEntry { section?: string | null | undefined; sectionStart?: boolean | undefined; isTitle?: boolean | undefined }
type CourseGroupedSlide<T> = T & { index: number; group: number };
interface CourseGrouping<T> { slides: CourseGroupedSlide<T>[]; groups: { index: number; title: string; start: number; slides: CourseGroupedSlide<T>[] }[] }
interface CourseCollectAncestor {
  tagName: string;
  parentElement: CourseCollectAncestor | null;
  getAttribute(name: string): string | null;
}
interface CourseCollectClone {
  textContent: string | null;
  querySelectorAll(selector: string): { forEach(callback: (node: { remove(): void }) => void): void };
}
interface CourseCollectElement extends CourseCollectAncestor {
  id: string;
  children: Iterable<{tagName: string}>;
  classList: {contains(name: string): boolean};
  querySelector(selector: string): {tagName: string; textContent: string | null} | null;
  cloneNode(deep: boolean): Node | CourseCollectClone;
}
interface CourseSlideEntry<T extends CourseCollectElement = HTMLElement> extends CourseGroupingEntry { element: T; title: string; h: number; v: number; search: string }
type CourseSlide = CourseGroupedSlide<CourseSlideEntry>;
type CourseSlideModel = CourseGrouping<CourseSlideEntry>;
interface CourseVisitHistory { record(index: number): void; move(direction: number): number | null; canMove(direction: number): boolean }
type CourseNavAction = 'prev' | 'next' | 'prevSection' | 'nextSection' | 'back' | 'forward' | 'overview' | 'search' | 'fullscreen' | 'speaker' | 'print' | 'topics' | 'close';
type CourseNavLabels = Record<CourseNavAction | 'start' | 'material' | 'slide' | 'controls' | 'searchPlaceholder' | 'noResults' | 'searchHint' | 'sectionProgress' | 'allProgress' | 'section' | 'resultCount' | 'presentation', string>;
type CourseNavControlAction = Exclude<CourseNavAction, 'close'>;
type CourseNavGeneratedAction = 'overview' | 'search' | 'topics';
type CourseNavInvoke = () => void | Promise<void>;
type CourseNavActions = Record<Exclude<CourseNavControlAction, CourseNavGeneratedAction | 'speaker'>, CourseNavInvoke> &
  Partial<Record<CourseNavGeneratedAction | 'speaker', CourseNavInvoke>> & {goto(index: number, target?: Element | undefined): void};
interface CourseNavUI { shell: HTMLDivElement; update(current: CourseSlide | undefined, history: CourseVisitHistory, fragmentState: {prev: boolean;next: boolean}): void; closeDialogs(): void; destroy(): void }
interface CourseNavModelAPI {
  collect<T extends CourseCollectElement>(deck: {getSlides(): T[]; getIndices(slide: NoInfer<T>): {h: number; v?: number | undefined}}, labels: Pick<CourseNavLabels, 'slide' | 'start' | 'material'>): CourseGrouping<CourseSlideEntry<T>>;
  groupEntries<T extends CourseGroupingEntry>(entries: T[], fallback: string): CourseGrouping<T>;
  findTarget(slide: CourseSlide, term: string): Element;
  VisitHistory: new(limit?: number) => CourseVisitHistory;
}
interface CourseNavUIAPI { build(model: CourseSlideModel, options: CourseNavigationOptions, actions: CourseNavActions): CourseNavUI; strings: {ru: CourseNavLabels; en: CourseNavLabels} }
interface CourseNavModules { NavigationModel?: CourseNavModelAPI | undefined; NavigationUI?: CourseNavUIAPI | undefined }
interface CourseNavigationPlugin { id: string; init(deck: CourseReveal): void; destroy(): void }
interface Window {
  Reveal?: CourseReveal | undefined;
  CoursePresentation?: {exposeNote(target: Element): Element | null | undefined} | undefined;
  CourseDisclosure?: {expose(target: Element | null): void} | undefined;
  CourseNavigation?: CourseNavigationPlugin | undefined;
  CourseNavigationModules?: CourseNavModules | undefined;
  bootstrap?: {Collapse?: {getOrCreateInstance(element: Element, options: {toggle: boolean}): {show(): void}} | undefined} | undefined;
}
declare var CourseNavigationModules: CourseNavModules | undefined;
declare var Reveal: CourseReveal;
