// scripts/build-web.ts loads .css imported from TypeScript as text.
declare module "*.css" {
  const css: string;
  export default css;
}
