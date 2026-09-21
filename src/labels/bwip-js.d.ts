declare module 'bwip-js' {
  const bwipjs: { raw(options: Record<string, unknown>): any; toSVG(options: Record<string, unknown>): string };
  export default bwipjs;
}
